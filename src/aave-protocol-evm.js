// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

import { LendingProtocol } from '@wdk/wallet/protocols'
import { WalletAccountEvm } from '@wdk/wdk-wallet-evm'
import { WalletAccountEvmErc4337 } from '@wdk/wdk-wallet-evm-erc-4337'

import { IAaveOracle_ABI, IAToken_ABI, IERC20_ABI, IPool_ABI } from '@bgd-labs/aave-address-book/abis'
import { Contract, isAddress, MaxInt256, ZeroAddress } from 'ethers'
import { AAVE_V3_ADDRESS_MAP, AAVE_V3_ERROR } from './constants.js'

import UiPoolDataProviderAbi from './UiPoolDataProvider.abi.json' with { type: 'json' }
import { rayMul } from './math-utils/ray-math.js'
import { percentDiv } from './math-utils/percentage-math.js'

/** @typedef {import('@wdk/wallet/protocols').BorrowOptions} BorrowOptions */
/** @typedef {import('@wdk/wallet/protocols').BorrowResult} BorrowResult */
/** @typedef {import('@wdk/wallet/protocols').SupplyOptions} SupplyOptions */
/** @typedef {import('@wdk/wallet/protocols').SupplyResult} SupplyResult */
/** @typedef {import('@wdk/wallet/protocols').WithdrawOptions} WithdrawOptions */
/** @typedef {import('@wdk/wallet/protocols').WithdrawResult} WithdrawResult */
/** @typedef {import('@wdk/wallet/protocols').RepayOptions} RepayOptions */
/** @typedef {import('@wdk/wallet/protocols').RepayResult} RepayResult */
/** @typedef {import('@wdk/wdk-wallet-evm').WalletAccountReadOnlyEvm} WalletAccountReadOnlyEvm */
/** @typedef {import('@wdk/wdk-wallet-evm').WalletAccountEvm} WalletAccountEvm */
/** @typedef {import('@wdk/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@wdk/wdk-wallet-evm-erc-4337').WalletAccountReadOnlyEvmErc4337} WalletAccountReadOnlyEvmErc4337 */
/** @typedef {import('@wdk/wdk-wallet-evm-erc-4337').WalletAccountEvmErc4337} WalletAccountEvmErc4337 */
/** @typedef {import('@wdk/wdk-wallet-evm-erc-4337').EvmErc4337WalletConfig} EvmErc4337WalletConfig */

/**
 * @typedef {Object} AccountData
 * @property {number} totalCollateralBase - The account’s total collateral base.
 * @property {number} totalDebtBase - The account’s total debt base.
 * @property {number} availableBorrowsBase - The account’s available borrows base.
 * @property {number} currentLiquidationThreshold - The account’s current liquidation threshold.
 * @property {number} ltv - The account’s loan-to-value.
 * @property {number} healthFactor - The account’s health factor.
 */

/**
 * @typedef SetUseReserveAsCollateralResult
 * @property {number} fee
 * @property {string} hash
 */

const DEFAULT_GAS_LIMIT = 300_000
const HEALTH_FACTOR_LIQUIDATION_THRESHOLD_IN_BASE_UNIT = 1e18

function isBigIntInfinity(value) {
  return value === MaxInt256
}

export default class AaveProtocolEvm extends LendingProtocol {
  /**
   * Creates a read-only handler for Aave Protocol on any EVM chain.
   *
   * @overload
   * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - The EVM wallet that interacts with Aave Protocol.
   */

  /**
   * Creates a handler for Aave Protocol on any EVM chain.
   *
   * @overload
   * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - The EVM wallet that interacts with Aave Protocol.
   */
  constructor (account) {
    super(account)

    /**
     * The address mapping by chain of Aave Protocol's contracts
     *
     * @private
     * @type {Record<string, string> | undefined}
     */
    this._addressMap = undefined

    /** The main contract to interact with Aave Protocol.
     *
     * @private
     * @type {Contract | undefined}
     */
    this._poolContract = undefined

    /**
     * The contract to query protocol and user's information.
     *
     * @private
     * @type {Contract | undefined}
     */
    this._uiPoolDataProviderContract = undefined
  }

  async _getAddressMap() {
    if (!this._addressMap) {
      const network = await this._account._account.provider.getNetwork()
      const chainId = network.chainId

      if (!AAVE_V3_ADDRESS_MAP[chainId]) {
        throw new Error('This chain is not supported')
      }

      this._addressMap = AAVE_V3_ADDRESS_MAP[chainId]
    }

    return this._addressMap
  }

  async _getPoolContract() {
    if (!this._poolContract) {
      const addressMap = await this._getAddressMap()
      this._poolContract = new Contract(addressMap.pool, IPool_ABI, this._account._account.provider)
    }

    return this._poolContract
  }

  async _getUiPoolDataProviderContract() {
    if (!this._uiPoolDataProviderContract) {
      const addressMap = await this._getAddressMap()
      this._uiPoolDataProviderContract = new Contract(addressMap.uiPoolDataProvider, UiPoolDataProviderAbi, this._account._account.provider)
    }

    return this._uiPoolDataProviderContract
  }

  /**
   * Returns a transaction for token spending approval.
   *
   * @private
   * @param {string} token - The token to request spending approval.
   * @param {string} spender - The address that spends token.
   * @param {number} amount - Amount of spending to be approved.
   * @returns {EvmTransaction} Returns the EVM transaction.
   */
  _getApproveTransaction(token, spender, amount) {
    const tokenContract = new Contract(token, IERC20_ABI, this._account._account.provider)

    return {
      data: tokenContract.interface.encodeFunctionData('approve', [spender, amount]),
      to: token,
      value: 0
    }
  }

  async _getTokenReserveData(token) {
    const uiPoolDataProviderContract = await this._getUiPoolDataProviderContract();
    const addressMap = await this._getAddressMap()

    const [reserves] = await uiPoolDataProviderContract.getReservesData(addressMap.poolAddressesProvider)

    const tokenReserve = reserves.find((reserve) => reserve.underlyingAsset === token)

    if (!tokenReserve) {
      throw new Error(AAVE_V3_ERROR.CANNOT_FIND_TOKEN_RESERVE)
    }

    return tokenReserve
  }

  /**
   *
   * @private
   * @param {SupplyOptions} options
   * @returns {Promise<void>}
   */
  async _validateSupply(options) {
    const tokenBalance = await this._account.getTokenBalance(options.token)

    if (tokenBalance < options.amount) {
      throw new Error(AAVE_V3_ERROR.INSUFFICIENT_FUND)
    }

    const tokenReserve = await this._getTokenReserveData(options.token)

    if (tokenReserve.isPaused) {
      throw new Error(AAVE_V3_ERROR.RESERVE_PAUSED)
    }

    if (tokenReserve.isFrozen) {
      throw new Error(AAVE_V3_ERROR.RESERVE_FROZEN)
    }

    if (!tokenReserve.isActive) {
      throw new Error(AAVE_V3_ERROR.RESERVE_INACTIVE)
    }

    const aTokenContract = new Contract(tokenReserve.aTokenAddress, IAToken_ABI, this._account._account.provider)
    const aTokenScaledSupply = await aTokenContract.scaledTotalSupply()

    const totalSupplyAfterDeposit = rayMul(aTokenScaledSupply + tokenReserve.accruedToTreasury, tokenReserve.liquidityIndex + BigInt(options.amount))
    const supplyCapInBaseUnit = tokenReserve.supplyCap * (10n ** tokenReserve.decimals)

    if (totalSupplyAfterDeposit > supplyCapInBaseUnit) {
      throw new Error(AAVE_V3_ERROR.SUPPLY_CAP_EXCEEDED)
    }
  }

  /**
   * @private
   * @param {WithdrawOptions} options
   * @returns {Promise<void>}
   */
  async _validateWithdraw(options) {
    const address = await this._account.getAddress()
    const tokenReserve = await this._getTokenReserveData(options.token)

    if (tokenReserve.isPaused) {
      throw new Error(AAVE_V3_ERROR.RESERVE_PAUSED)
    }

    if (tokenReserve.isFrozen) {
      throw new Error(AAVE_V3_ERROR.RESERVE_FROZEN)
    }

    if (!tokenReserve.isActive) {
      throw new Error(AAVE_V3_ERROR.RESERVE_INACTIVE)
    }

    const aTokenContract = new Contract(tokenReserve.aTokenAddress, IAToken_ABI, this._account._account.provider)
    const userScaledBalance = await aTokenContract.scaledBalanceOf(address)
    const userBalance = rayMul(userScaledBalance, tokenReserve.liquidityIndex)

    if (BigInt(options.amount) > userBalance) {
      throw new Error(AAVE_V3_ERROR.INSUFFICIENT_BALANCE_TO_WITHDRAW)
    }

    const { ltv, healthFactor } = await this.getAccountData()

    if (healthFactor < HEALTH_FACTOR_LIQUIDATION_THRESHOLD_IN_BASE_UNIT) {
      throw new Error(AAVE_V3_ERROR.HEALTH_FACTOR_TOO_LOW)
    }

    if (ltv === 0 || tokenReserve.baseLTVasCollateral === 0) {
      throw new Error(AAVE_V3_ERROR.INVALID_LTV)
    }
  }

  /**
   *
   * @private
   * @param {BorrowOptions} options
   * @returns {Promise<void>}
   */
  async _validateBorrow(options) {
    const { ltv, healthFactor, totalCollateralBase, totalDebtBase} = await this.getAccountData(options.onBehalfOf)

    if (ltv === 0) {
      throw new Error(AAVE_V3_ERROR.INSUFFICIENT_COLLATERAL)
    }

    if (totalCollateralBase === 0) {
      throw new Error(AAVE_V3_ERROR.INSUFFICIENT_COLLATERAL)
    }

    if (healthFactor < HEALTH_FACTOR_LIQUIDATION_THRESHOLD_IN_BASE_UNIT) {
      throw new Error(AAVE_V3_ERROR.HEALTH_FACTOR_TOO_LOW)
    }

    const tokenReserve = await this._getTokenReserveData(options.token)
    const addressMap = await this._getAddressMap()

    if (tokenReserve.isPaused) {
      throw new Error(AAVE_V3_ERROR.RESERVE_PAUSED)
    }

    if (tokenReserve.isFrozen) {
      throw new Error(AAVE_V3_ERROR.RESERVE_FROZEN)
    }

    if (!tokenReserve.isActive) {
      throw new Error(AAVE_V3_ERROR.RESERVE_INACTIVE)
    }

    if (!tokenReserve.borrowingEnabled) {
      throw new Error(AAVE_V3_ERROR.BORROW_DISABLED)
    }

    const borrowCapInBaseUnit = tokenReserve.borrowCap * (10n ** tokenReserve.decimals)
    const totalSupplyVariableDebt = rayMul(tokenReserve.totalScaledVariableDebt, tokenReserve.variableBorrowIndex)
    const totalDebtWithAmount = totalSupplyVariableDebt + BigInt(options.amount)

    if (totalDebtWithAmount > borrowCapInBaseUnit) {
      throw new Error(AAVE_V3_ERROR.BORROW_CAP_EXCEEDED)
    }

    const priceOracleContract = new Contract(addressMap.priceOracle, IAaveOracle_ABI, this._account._account.provider)
    const tokenPrice = await priceOracleContract.getAssetPrice(options.token)

    const amountInBaseCurrency = BigInt(options.amount) * tokenPrice / (10n ** tokenReserve.decimals) // divide by decimals first might lead to zero
    const collateralNeededInBaseCurrency = percentDiv(BigInt(totalDebtBase) + amountInBaseCurrency, BigInt(ltv))

    if (collateralNeededInBaseCurrency > totalCollateralBase) {
      throw new Error(AAVE_V3_ERROR.INSUFFICIENT_COLLATERAL)
    }
  }

  async _getUserDebtByToken(tokenReserve, address) {
    // VariableDebtToken contract inherits the same class as AToken, we only need a few overlapping methods
    const variableDebtTokenContract = new Contract(tokenReserve.variableDebtTokenAddress, IAToken_ABI, this._account._account.provider)
    const userScaledBalance = await variableDebtTokenContract.scaledBalanceOf(address)

    return rayMul(userScaledBalance, tokenReserve.variableBorrowIndex)
  }

  /**
   *
   * @private
   * @param {RepayOptions} options
   * @returns {Promise<void>}
   */
  async _validateRepay(options) {
    const tokenReserve = await this._getTokenReserveData(options.token)

    if (tokenReserve.isPaused) {
      throw new Error(AAVE_V3_ERROR.RESERVE_PAUSED)
    }

    if (!tokenReserve.isActive) {
      throw new Error(AAVE_V3_ERROR.RESERVE_INACTIVE)
    }

    const address = await this._account.getAddress()
    const userDebt = await this._getUserDebtByToken(tokenReserve, options.onBehalfOf || address)

    if (userDebt === 0n) {
      throw new Error(AAVE_V3_ERROR.DEBT_NOT_FOUND)
    }
  }

  /**
   *
   * @private
   * @param {string} token
   * @param {boolean} useAsCollateral
   * @returns {Promise<void>}
   */
  async _validateUseReserveAsCollateral(token, useAsCollateral) {
    const tokenReserve = await this._getTokenReserveData(token)

    if (useAsCollateral && tokenReserve.baseLTVasCollateral === 0) {
      throw new Error(AAVE_V3_ERROR.TOKEN_CANNOT_BE_COLLATERAL)
    }
  }

  /**
   * Returns a transaction to supply a specific token amount to the lending pool.
   *
   * @private
   * @param {SupplyOptions} options - The supply's options.
   * @returns {Promise<EvmTransaction>} Returns the EVM transaction to supply.
   */
  async _getSupplyTransaction(options) {
    const address = await this._account.getAddress()
    const poolContract = await this._getPoolContract()

    const supplyData = poolContract.interface.encodeFunctionData('supply', [
      options.token,
      options.amount,
      options.onBehalfOf || address,
      0 // Referral code - currently inactive, 0 means no 3rd party referral
    ])

    return {
      data: supplyData,
      to: poolContract.target,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }
  }

  /**
   * Returns a transaction to withdraw a specific token amount from the pool.
   *
   * @private
   * @param {WithdrawOptions} options - The withdraw's options.
   * @returns {Promise<EvmTransaction>} Returns the EVM transaction to withdraw.
   */
  async _getWithdrawTransaction(options) {
    const address = await this._account.getAddress()
    const poolContract = await this._getPoolContract()

    const withdrawData = poolContract.interface.encodeFunctionData('withdraw', [
      options.token,
      options.amount === Infinity ? MaxInt256 : options.amount,
      options.to || address
    ])

    return {
      data: withdrawData,
      to: poolContract.target,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }
  }

  /**
   * Returns a transaction to borrow a specific token amount.
   *
   * @private
   * @param {BorrowOptions} options - The borrow's options.
   * @returns {Promise<EvmTransaction>} Returns the EVM transaction to borrow.
   */
  async _getBorrowTransaction(options) {
    const address = await this._account.getAddress()
    const poolContract = await this._getPoolContract()

    const borrowData = poolContract.interface.encodeFunctionData('borrow', [
      options.token,
      options.amount,
      2, // interestRateMode - should always be passed a value of 2 (variable rate mode)
      0, // referralCode - currently inactive, 0 means no 3rd party referral
      options.onBehalfOf || address
    ])

    return {
      data: borrowData,
      to: poolContract.target,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }
  }

  /**
   * Returns a transaction to repay a specific token amount.
   *
   * @private
   * @param {RepayOptions} options - The repay's options.
   * @returns {Promise<EvmTransaction>} Return the EVM transaction to repay.
   */
  async _getRepayTransaction(options) {
    const address = await this._account.getAddress()
    const poolContract = await this._getPoolContract()

    let amount = options.amount

    if (options.amount === Infinity) {
      if (options.onBehalfOf) {
        const tokenReserve = await this._getTokenReserveData(options.token)
        const userDebt = await this._getUserDebtByToken(tokenReserve, options.onBehalfOf)

        amount = userDebt + 100n // set amount slightly above user debt so the protocol understands it's a full repay
      } else {
        amount = MaxInt256
      }
    }

    const repayData = poolContract.interface.encodeFunctionData('repay', [
      options.token,
      amount,
      2, // interestRateMode - should always be passed a value of 2 (variable rate mode)
      options.onBehalfOf || address
    ])

    return {
      data: repayData,
      to: poolContract.target,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }
  }

  /**
   * Supplies a specific token amount to the lending pool.
   *
   * @param {SupplyOptions} options - The supply's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<SupplyResult>} The supply's result.
   */
  async supply(options, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    await this._validateSupply(options)

    const addressMap = await this._getAddressMap()

    const approveTx = this._getApproveTransaction(options.token, addressMap.pool, options.amount)
    const supplyTx = await this._getSupplyTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return await this._account.sendTransaction([approveTx, supplyTx], config)
    }

    const { fee: approveFee } = await this._account.sendTransaction(approveTx)
    const { hash, fee } = await this._account.sendTransaction(supplyTx)

    return {
      fee: fee + approveFee,
      hash
    }
  }

  /**
   * Quotes the costs of a supply operation.
   *
   * @param {SupplyOptions} options - The supply's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<Omit<SupplyResult, 'hash'>>} The supply's costs.
   */
  async quoteSupply(options, config) {
    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const addressMap = await this._getAddressMap()

    const approveTx = this._getApproveTransaction(options.token, addressMap.pool, options.amount)
    const supplyTx = await this._getSupplyTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return this._account.quoteSendTransaction([approveTx, supplyTx], config)
    }

    const [approveQuote, supplyQuote] = await Promise.all([
      this._account.quoteSendTransaction(approveTx),
      this._account.quoteSendTransaction(supplyTx)
    ])

    return {
      fee: approveQuote.fee + supplyQuote.fee
    }
  }

  /**
   * Withdraws a specific token amount from the pool.
   *
   * @param {WithdrawOptions} options - The withdraw's options. Set Infinity as amount to withdraw the entire balance.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<WithdrawResult>} The withdraw's result.
   */
  async withdraw(options, config) {
    if (options.to !== undefined && (options.to === ZeroAddress || !isAddress(options.to))) {
      throw new Error('To address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    await this._validateWithdraw(options)

    const withdrawTx = await this._getWithdrawTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return await this._account.sendTransaction(withdrawTx, config)
    }

    return await this._account.sendTransaction(withdrawTx)
  }

  /**
   * Quotes the costs of a withdraw operation.
   *
   * @param {WithdrawOptions} options - The withdraw's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<Omit<WithdrawResult, 'hash'>>} The withdraw's result.
   */
  async quoteWithdraw(options, config) {
    if (options.to !== undefined && (options.to === ZeroAddress || !isAddress(options.to))) {
      throw new Error('To address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const withdrawTx = await this._getWithdrawTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return await this._account.quoteSendTransaction(withdrawTx, config)
    }

    return await this._account.quoteSendTransaction(withdrawTx)
  }

  /**
   * Borrows a specific token amount.
   *
   * @param {BorrowOptions} options - The borrow's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<BorrowResult>} The borrow's result.
   */
  async borrow(options, config) {
    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    await this._validateBorrow(options)

    const borrowTx = await this._getBorrowTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return await this._account.sendTransaction(borrowTx, config)
    }

    return await this._account.sendTransaction(borrowTx)
  }

  /**
   * Quotes the costs of a borrow operation.
   *
   * @param {BorrowOptions} options - The borrow's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<Omit<BorrowResult, 'hash'>>} The borrow's result.
   */
  async quoteBorrow(options, config) {
    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const borrowTx = await this._getBorrowTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return await this._account.quoteSendTransaction(borrowTx, config)
    }

    return await this._account.quoteSendTransaction(borrowTx)
  }

  /**
   * Repays a specific token amount.
   *
   * @param {RepayOptions} options - The borrow's options, set Infinity as amount to repay the whole debt
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<RepayResult>} The repay's result.
   */
  async repay(options, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account')
    }

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    await this._validateRepay(options)

    const addressMap = await this._getAddressMap()

    const approveTx = this._getApproveTransaction(options.token, addressMap.pool, options.amount)
    const repayTx = await this._getRepayTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return this._account.sendTransaction([approveTx, repayTx], config)
    }

    const { fee: approveFee } = await this._account.sendTransaction(approveTx)
    const { hash, fee } = await this._account.sendTransaction(repayTx)

    return {
      hash,
      fee: approveFee + fee
    }
  }

  /**
   * Quotes the costs of a repay operation.
   *
   * @param {RepayOptions} options - The repay's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<Omit<RepayResult, 'hash'>>} The repay's costs.
   */
  async quoteRepay(options, config) {
    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    const addressMap = await this._getAddressMap()

    const approveTx = this._getApproveTransaction(options.token, addressMap.pool, options.amount)
    const repayTx = await this._getRepayTransaction(options)

    if (this._account instanceof WalletAccountEvmErc4337) {
      return this._account.quoteSendTransaction([approveTx, repayTx], config)
    }

    const [approveQuote, repayQuote] = await Promise.all([
      this._account.quoteSendTransaction(approveTx),
      this._account.quoteSendTransaction(repayTx)
    ])

    return {
      fee: approveQuote.fee + repayQuote.fee
    }
  }

  /**
   * Returns the account’s data.
   *
   * @param {string} [address] - The address to query account data
   * @returns {Promise<AccountData>} Returns the account's data.
   */
  async getAccountData(address) {
    if (address !== undefined && (address === ZeroAddress || !isAddress(address))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    const userAddress = address ? address : await this._account.getAddress()
    const poolContract = await this._getPoolContract()
    const userAccountData = await poolContract.getUserAccountData(userAddress)

    return {
      totalCollateralBase: Number(userAccountData[0]),
      totalDebtBase: Number(userAccountData[1]),
      availableBorrowsBase: Number(userAccountData[2]),
      currentLiquidationThreshold: Number(userAccountData[3]),
      ltv: Number(userAccountData[4]),
      healthFactor: isBigIntInfinity(userAccountData[5])
        ? Infinity
        : Number(userAccountData[5])
    }
  }

  /**
   * Enables/disables a specific token as a collateral for the account’s borrow operations.
   *
   * @param {string} token - The token's address.
   * @param {boolean} useAsCollateral - True if the token should be a valid collateral.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
   * @returns {Promise<SetUseReserveAsCollateralResult>}
   */
  async setUseReserveAsCollateral(token, useAsCollateral, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account')
    }

    if (!isAddress(token)) {
      throw new Error('Token must be a valid EVM address')
    }

    await this._validateUseReserveAsCollateral(token, useAsCollateral)

    const poolContract = await this._getPoolContract()

    const setUseReserveData = poolContract.interface.encodeFunctionData('setUserUseReserveAsCollateral', [
      token,
      useAsCollateral
    ])

    const tx = {
      data: setUseReserveData,
      to: poolContract.target,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }

    if (this._account instanceof WalletAccountEvmErc4337) {
      return this._account.sendTransaction(tx, config)
    }

    return await this._account.sendTransaction(tx)
  }
}