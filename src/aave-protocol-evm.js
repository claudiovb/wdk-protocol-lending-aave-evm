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
import { Contract, isAddress, ZeroAddress } from 'ethers'
import {
  AAVE_V3_ADDRESS_MAP, extractConfiguration,
  HEALTH_FACTOR_LIQUIDATION_THRESHOLD_IN_BASE_UNIT, isBigIntInfinity, RESERVE_CONFIG_MAP
} from './utils.js'

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
/** @typedef {import('@wdk/wdk-wallet-evm').EvmTransaction} EvmTransaction */
/** @typedef {import('@wdk/wdk-wallet-evm-erc-4337').WalletAccountReadOnlyEvmErc4337} WalletAccountReadOnlyEvmErc4337 */

/**
 * @typedef {Object} AccountData
 * @property {number} totalCollateralBase - The account’s total collateral base.
 * @property {number} totalDebtBase - The account’s total debt base.
 * @property {number} availableBorrowsBase - The account’s available borrows base.
 * @property {number} currentLiquidationThreshold - The account’s current liquidation threshold.
 * @property {number} ltv - The account’s loan-to-value.
 * @property {number} healthFactor - The account’s health factor.
 */

const DEFAULT_GAS_LIMIT = 300_000

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
   * @returns {Promise<EvmTransaction>} Returns the EVM transaction.
   */
  async _getApproveTransaction(token, spender, amount) {
    const tokenContract = new Contract(token, IERC20_ABI, this._account._account.provider)

    return {
      data: tokenContract.interface.encodeFunctionData('approve', [spender, amount]),
      to: token,
      value: 0
    }
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
      throw new Error('Insufficient fund to supply')
    }

    const uiPoolDataProviderContract = await this._getUiPoolDataProviderContract();
    const addressMap = await this._getAddressMap()

    const [reserves] = await uiPoolDataProviderContract.getReservesData(addressMap.poolAddressesProvider)

    const supplyTokenReserve = reserves.find((reserve) => reserve.underlyingAsset === options.token)

    if (!supplyTokenReserve) {
      throw new Error('Cannot find token reserve data')
    }

    if (supplyTokenReserve.isPaused) {
      throw new Error('The reserve is paused')
    }

    if (supplyTokenReserve.isFrozen) {
      throw new Error('The reserve is frozen')
    }

    if (!supplyTokenReserve.isActive) {
      throw new Error('The reserve is inactive')
    }

    const aTokenContract = new Contract(supplyTokenReserve.aTokenAddress, IAToken_ABI, this._account._account.provider)
    const aTokenScaledSupply = await aTokenContract.scaledTotalSupply()

    const totalSupplyAfterDeposit = rayMul(aTokenScaledSupply + supplyTokenReserve.accruedToTreasury, supplyTokenReserve.liquidityIndex + BigInt(options.amount))
    const supplyCapInBaseUnit = supplyTokenReserve.supplyCap * (10n ** supplyTokenReserve.decimals)

    if (totalSupplyAfterDeposit > supplyCapInBaseUnit) {
      throw new Error('Supply cap is exceeded')
    }
  }

  /**
   * @private
   * @param {WithdrawOptions} options
   * @returns {Promise<void>}
   */
  async _validateWithdraw(options) {
    const poolContract = await this._getPoolContract()
    const [reserveConfiguration] = await poolContract.getConfiguration(options.token)

    const isPaused = extractConfiguration(reserveConfiguration, RESERVE_CONFIG_MAP.isPaused[0], RESERVE_CONFIG_MAP.isPaused[1])
    const isFrozen = extractConfiguration(reserveConfiguration, RESERVE_CONFIG_MAP.isFrozen[0], RESERVE_CONFIG_MAP.isFrozen[1])
    const isActive = extractConfiguration(reserveConfiguration, RESERVE_CONFIG_MAP.isActive[0], RESERVE_CONFIG_MAP.isActive[1])

    if (isPaused) {
      throw new Error('The reserve is paused')
    }

    if (isFrozen) {
      throw new Error('The reserve is frozen')
    }

    if (!isActive) {
      throw new Error('The reserve is inactive')
    }
  }

  /**
   *
   * @private
   * @param {BorrowOptions} options
   * @returns {Promise<void>}
   */
  async _validateBorrow(options) {
    // todo: check debt ceiling when in isolation mode
    // todo: in case of delegation, check credit delegator for collateral
    // todo: returns if user in e-mode or isolation mode
    const { ltv, healthFactor, totalCollateralBase, totalDebtBase} = await this.getAccountData() // todo: might not work in case delegation

    if (ltv === 0) {
      throw new Error('Insufficient collateral to borrow')
    }

    if (totalCollateralBase === 0) {
      throw new Error('Insufficient collateral to borrow')
    }

    if (healthFactor < HEALTH_FACTOR_LIQUIDATION_THRESHOLD_IN_BASE_UNIT) {
      throw new Error('Health factor is lower than the liquidation threshold')
    }

    const uiPoolDataProviderContract = await this._getUiPoolDataProviderContract();
    const addressMap = await this._getAddressMap()

    const [reserves] = await uiPoolDataProviderContract.getReservesData(addressMap.poolAddressesProvider)

    const supplyTokenReserve = reserves.find((reserve) => reserve.underlyingAsset === options.token)

    if (!supplyTokenReserve) {
      throw new Error('Cannot find token reserve data')
    }

    if (supplyTokenReserve.isPaused) {
      throw new Error('The reserve is paused')
    }

    if (supplyTokenReserve.isFrozen) {
      throw new Error('The reserve is frozen')
    }

    if (!supplyTokenReserve.isActive) {
      throw new Error('The reserve is inactive')
    }

    if (!supplyTokenReserve.borrowingEnabled) {
      throw new Error('Borrowing is not enabled for this token')
    }

    const borrowCapInBaseUnit = supplyTokenReserve.borrowCap * (10n ** supplyTokenReserve.decimals)
    const totalSupplyVariableDebt = rayMul(supplyTokenReserve.totalScaledVariableDebt, supplyTokenReserve.variableBorrowIndex)
    const totalDebtWithAmount = totalSupplyVariableDebt + BigInt(options.amount)

    if (totalDebtWithAmount > borrowCapInBaseUnit) {
      throw new Error('Borrow cap is exceeded')
    }

    const priceOracleContract = new Contract(addressMap.priceOracle, IAaveOracle_ABI, this._account._account.provider)
    const tokenPrice = await priceOracleContract.getAssetPrice(options.token)

    const amountInBaseCurrency = BigInt(options.amount) * tokenPrice / (10n ** supplyTokenReserve.decimals) // divide by decimals first might lead to zero
    const collateralNeededInBaseCurrency = percentDiv(BigInt(totalDebtBase) + amountInBaseCurrency, BigInt(ltv))

    if (collateralNeededInBaseCurrency > totalCollateralBase) {
      throw new Error('Not enough collateral to cover new borrow')
    }
  }

  /**
   *
   * @private
   * @param {RepayOptions} options
   * @returns {Promise<void>}
   */
  async _validateRepay(options) {
    // todo: check when repay with aToken other than underlying token
    // todo: verify borrow position and repay amount when repay max amount
    // todo: validate repay max amount

    const uiPoolDataProviderContract = await this._getUiPoolDataProviderContract();
    const addressMap = await this._getAddressMap()

    const [reserves] = await uiPoolDataProviderContract.getReservesData(addressMap.poolAddressesProvider)

    const supplyTokenReserve = reserves.find((reserve) => reserve.underlyingAsset === options.token)

    if (!supplyTokenReserve) {
      throw new Error('Cannot find token reserve data')
    }

    if (supplyTokenReserve.isPaused) {
      throw new Error('The reserve is paused')
    }

    if (!supplyTokenReserve.isActive) {
      throw new Error('The reserve is inactive')
    }

    // VariableDebtToken contract inherits the same class as AToken, we only need a few overlapping methods
    const variableDebtTokenContract = new Contract(supplyTokenReserve.variableDebtTokenAddress, IAToken_ABI, this._account._account.provider)
    const address = await this._account.getAddress()
    const userScaledBalance = await variableDebtTokenContract.scaledBalanceOf(options.onBehalfOf || address) // todo: validate
    const userDebt = rayMul(userScaledBalance, supplyTokenReserve.variableBorrowIndex)

    if (userDebt === 0n) {
      throw new Error('User has no debt of this type')
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
      options.amount,
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

    const repayData = poolContract.interface.encodeFunctionData('repay', [
      options.token,
      options.amount,
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
   * @returns {Promise<SupplyResult>} The supply's result.
   */
  async supply (options) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account.')
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

    const approveTransaction = await this._getApproveTransaction(options.token, addressMap.pool, options.amount)
    await this._account.sendTransaction(approveTransaction)

    const supplyTransaction = await this._getSupplyTransaction(options)
    const { hash, fee } = await this._account.sendTransaction(supplyTransaction)

    return {
      fee,
      hash
    }
  }

  /**
   * Quotes the costs of a supply operation.
   *
   * @param {SupplyOptions} options - The supply's options.
   * @returns {Promise<Omit<SupplyResult, 'hash'>>} The supply's costs.
   */
  async quoteSupply(options) {
    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const supplyTransaction = await this._getSupplyTransaction(options)
    const { fee } = await this._account.quoteSendTransaction(supplyTransaction)

    return {
      fee
    }
  }

  /**
   * Withdraws a specific token amount from the pool.
   *
   * @param {WithdrawOptions} options - The withdraw's options.
   * @returns {Promise<WithdrawResult>} The withdraw's result.
   */
  async withdraw(options) {
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

    const withdrawTransaction = await this._getWithdrawTransaction(options)
    const { hash, fee } = await this._account.sendTransaction(withdrawTransaction)

    return {
      hash,
      fee
    }
  }

  /**
   * Quotes the costs of a withdraw operation.
   *
   * @param {WithdrawOptions} options - The withdraw's options.
   * @returns {Promise<Omit<WithdrawResult, 'hash'>>} The withdraw's result.
   */
  async quoteWithdraw(options) {
    if (options.to !== undefined && (options.to === ZeroAddress || !isAddress(options.to))) {
      throw new Error('To address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const withdrawTransaction = await this._getWithdrawTransaction(options)
    const { fee } = await this._account.quoteSendTransaction(withdrawTransaction)

    return {
      fee
    }
  }

  /**
   * Borrows a specific token amount.
   *
   * @param {BorrowOptions} options - The borrow's options.
   * @returns {Promise<BorrowResult>} The borrow's result.
   */
  async borrow(options) {
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

    const borrowTransaction = await this._getBorrowTransaction(options)
    const { hash, fee } = await this._account.sendTransaction(borrowTransaction)

    return {
      hash,
      fee
    }
  }

  /**
   * Quotes the costs of a borrow operation.
   *
   * @param {BorrowOptions} options - The borrow's options.
   * @returns {Promise<Omit<BorrowResult, 'hash'>>} The borrow's result.
   */
  async quoteBorrow(options) {
    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const borrowTransaction = await this._getBorrowTransaction(options)
    const { fee } = await this._account.quoteSendTransaction(borrowTransaction)

    return {
      fee
    }
  }

  /**
   * Repays a specific token amount.
   *
   * @param {RepayOptions} options - The borrow's options.
   * @returns {Promise<RepayResult>} The repay's result.
   */
  async repay(options) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account.')
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

    const approveTransaction = await this._getApproveTransaction(options.token, addressMap.pool, options.amount)
    await this._account.sendTransaction(approveTransaction)

    const repayTransaction = await this._getRepayTransaction(options)
    const { hash, fee } = await this._account.sendTransaction(repayTransaction)

    return {
      hash,
      fee
    }
  }

  /**
   * Quotes the costs of a repay operation.
   *
   * @param {RepayOptions} options - The repay's options.
   * @returns {Promise<Omit<RepayResult, 'hash'>>} The repay's costs.
   */
  async quoteRepay(options) {
    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    const repayTransaction = await this._getRepayTransaction(options)
    const { fee } = await this._account.sendTransaction(repayTransaction)

    return {
      fee
    }
  }

  /**
   * Returns the account’s data.
   *
   * @returns {Promise<AccountData>} Returns the account's data.
   */
  async getAccountData() {
    const address = await this._account.getAddress()
    const poolContract = await this._getPoolContract()
    const userAccountData = await poolContract.getUserAccountData(address)

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
   * @returns {Promise<void>}
   */
  async setUseReserveAsCollateral(token, useAsCollateral) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account.')
    }

    if (!isAddress(token)) {
      throw new Error('Token must be a valid EVM address')
    }

    // todo: Review condition with isolation mode, LTV, health factor

    const poolContract = await this._getPoolContract()

    const setUseReserveData = poolContract.interface.encodeFunctionData('setUserUseReserveAsCollateral', [
      token,
      useAsCollateral
    ])

    await this._account.sendTransaction({
      data: setUseReserveData,
      to: poolContract.target,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    })
  }
}