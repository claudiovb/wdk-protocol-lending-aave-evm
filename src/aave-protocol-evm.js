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

import { IERC20_ABI, IPool_ABI } from '@bgd-labs/aave-address-book/abis'
import { Contract, isAddress, ZeroAddress } from 'ethers'
import { AAVE_V3_POOL_ADDRESS_MAP, isBigIntInfinity } from './utils.js'

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
     * The main contract to interact with Aave Protocol.
     *
     * @private
     * @type {string | undefined}
     */
    this._poolAddress = undefined

    /**
     * The contract object to interact on-chain.
     *
     * @private
     * @type {Contract | undefined}
     */
    this._poolContract = undefined
  }

  /**
   * Setup parameters to interact with Aave Protocol based on account's network.
   *
   * @private
   * @returns {Promise<void>}
   */
  async _setupProtocolConfig() {
    if (this._poolAddress) {
      return;
    }

    const network = await this._account._account.provider.getNetwork()
    const chainId = network.chainId

    if (!AAVE_V3_POOL_ADDRESS_MAP[chainId]) {
      throw new Error('Aave protocol is not supported for this chain')
    }

    this._poolAddress = AAVE_V3_POOL_ADDRESS_MAP[chainId]
    this._poolContract = new Contract(this._poolAddress, IPool_ABI, this._account._account.provider)
  }

  /**
   * Returns a transaction for token spending approval.
   *
   * @private
   * @param {string} spender - The address that spends token.
   * @param {string} token - The token to request spending approval.
   * @param {number} amount - Amount of spending to be approved.
   * @returns {Promise<EvmTransaction>} Returns the EVM transaction.
   */
  async _getApproveTransaction(spender, token, amount) {
    const tokenContract = new Contract(token, IERC20_ABI, this._account._account.provider)
    const owner = await this._account.getAddress()

    return {
      from: owner,
      data: tokenContract.interface.encodeFunctionData('approve', [spender, amount]),
      to: token,
      value: 0
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
    const poolContract = new Contract(this._poolAddress, IPool_ABI, this._account._account.provider)
    const address = await this._account.getAddress()

    const supplyData = poolContract.interface.encodeFunctionData('supply', [
      options.token,
      options.amount,
      options.onBehalfOf || address,
      0 // Referral code - currently inactive, 0 means no 3rd party referral
    ])

    return {
      from: address,
      data: supplyData,
      to: this._poolAddress,
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

    await this._setupProtocolConfig()

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    const tokenBalance = await this._account.getTokenBalance(options.token)

    if (tokenBalance < options.amount) {
      throw new Error('Insufficient fund to supply')
    }

    const approveTransaction = await this._getApproveTransaction(this._poolAddress, options.token, options.amount)

    if (approveTransaction) {
      await this._account.sendTransaction(approveTransaction)
    }

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
    await this._setupProtocolConfig()

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
   * Returns a transaction to withdraw a specific token amount from the pool.
   *
   * @private
   * @param {WithdrawOptions} options - The withdraw's options.
   * @returns {Promise<EvmTransaction>} Returns the EVM transaction to withdraw.
   */
  async _getWithdrawTransaction(options) {
    if (options.to !== undefined && (options.to === ZeroAddress || !isAddress(options.to))) {
      throw new Error('To address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    // todo: check aToken balance for withdrawal

    const address = await this._account.getAddress()
    const withdrawData = this._poolContract.interface.encodeFunctionData('withdraw', [
      options.token,
      options.amount,
      options.to || address
    ])

    return {
      from: address,
      data: withdrawData,
      to: this._poolAddress,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }
  }

  /**
   * Withdraws a specific token amount from the pool.
   *
   * @param {WithdrawOptions} options - The withdraw's options.
   * @returns {Promise<WithdrawResult>} The withdraw's result.
   */
  async withdraw(options) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account.')
    }

    await this._setupProtocolConfig()

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
    await this._setupProtocolConfig()

    const withdrawTransaction = await this._getWithdrawTransaction(options)
    const { fee } = await this._account.quoteSendTransaction(withdrawTransaction)

    return {
      fee
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
    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    // todo: check supplied collateral
    // todo: in case of delegation, check credit delegator for collateral

    const address = await this._account.getAddress()
    const borrowData = this._poolContract.interface.encodeFunctionData('borrow', [
      options.token,
      options.amount,
      2, // interestRateMode - should always be passed a value of 2 (variable rate mode)
      0, // referralCode - currently inactive, 0 means no 3rd party referral
      options.onBehalfOf || address
    ])

    return {
      from: address,
      data: borrowData,
      to: this._poolAddress,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }
  }

  /**
   * Borrows a specific token amount.
   *
   * @param {BorrowOptions} options - The borrow's options.
   * @returns {Promise<BorrowResult>} The borrow's result.
   */
  async borrow(options) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error('This method requires a non read-only account.')
    }

    await this._setupProtocolConfig()

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
    await this._setupProtocolConfig()

    const borrowTransaction = await this._getBorrowTransaction(options)
    const { fee } = await this._account.quoteSendTransaction(borrowTransaction)

    return {
      fee
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
    // todo: check borrow position
    const address = await this._account.getAddress()
    const repayData = this._poolContract.interface.encodeFunctionData('repay', [
      options.token,
      options.amount,
      2, // interestRateMode - should always be passed a value of 2 (variable rate mode)
      options.onBehalfOf || address
    ])

    return {
      from: address,
      data: repayData,
      to: this._poolAddress,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
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

    await this._setupProtocolConfig()

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    const approveTransaction = await this._getApproveTransaction(this._poolAddress, options.token, options.amount)

    if (approveTransaction) {
      await this._account.sendTransaction(approveTransaction)
    }

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
    await this._setupProtocolConfig()

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
    await this._setupProtocolConfig()

    const address = await this._account.getAddress()
    const userAccountData = await this._poolContract.getUserAccountData(address)

    return {
      totalCollateralBase: +userAccountData[0].toString(),
      totalDebtBase: +userAccountData[1].toString(),
      availableBorrowsBase: +userAccountData[2].toString(),
      currentLiquidationThreshold: +userAccountData[3].toString(),
      ltv: +userAccountData[4].toString(),
      healthFactor: isBigIntInfinity(userAccountData[5])
        ? Infinity
        : +userAccountData[5].toString()
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

    await this._setupProtocolConfig()

    if (!isAddress(token)) {
      throw new Error('Token must be a valid EVM address')
    }

    // todo: Review condition with isolation mode, LTV, health factor

    const address = await this._account.getAddress()
    const setUseReserveData = this._poolContract.interface.encodeFunctionData('setUserUseReserveAsCollateral', [
      token,
      useAsCollateral
    ])

    await this._account.sendTransaction({
      from: address,
      data: setUseReserveData,
      to: this._poolAddress,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    })
  }
}