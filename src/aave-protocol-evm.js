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

import { AbstractLendingProtocol } from '@wdk/wallet/protocols'

import { IERC20_ABI, IPool_ABI } from '@bgd-labs/aave-address-book/abis'
import { Contract, isAddress, ZeroAddress } from 'ethers'
import { AAVE_V3_ADDRESS_MAP, isBigIntInfinity } from './utils.js'
import { AaveV3Ethereum } from '@bgd-labs/aave-address-book'

import UiPoolDataProviderAbi from './UiPoolDataProvider.abi.json' with { type: 'json' }
/** @typedef {import('@wdk/wallet/protocols').BorrowOptions} BorrowOptions */
/** @typedef {import('@wdk/wallet/protocols').BorrowResult} BorrowResult */
/** @typedef {import('@wdk/wallet/protocols').SupplyOptions} SupplyOptions */
/** @typedef {import('@wdk/wallet/protocols').SupplyResult} SupplyResult */
/** @typedef {import('@wdk/wallet/protocols').WithdrawOptions} WithdrawOptions */
/** @typedef {import('@wdk/wallet/protocols').WithdrawResult} WithdrawResult */
/** @typedef {import('@wdk/wallet/protocols').RepayOptions} RepayOptions */
/** @typedef {import('@wdk/wallet/protocols').RepayResult} RepayResult */
/** @typedef {import('@wdk/wdk-wallet-evm').WalletAccountEvm} WalletAccountEvm */
/** @typedef {import('@wdk/wdk-wallet-evm').EvmTransaction} EvmTransaction */

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

export default class AaveProtocolEvm extends AbstractLendingProtocol {
  /**
   * The address mapping by chain of Aave Protocol's contracts
   *
   * @private
   * @type {Record<string, string>}
   */
  _poolAddressMap

  /**
   * The main contract to interact with Aave Protocol.
   *
   * @private
   * @type {Contract}
   */
  _poolContract

  /**
   * The contract to query protocol and user's information.
   *
   * @private
   * @type {Contract}
   */
  _uiPoolDataProviderContract

  /**
   * Creates a handle for Aave Protocol on any EVM chain.
   *
   * @param {WalletAccountEvm} account - The EVM wallet that interacts with Aave Protocol.
   */
  constructor (account) {
    super(account)
  }

  /**
   * Setup parameters to interact with Aave Protocol based on account's network.
   *
   * @private
   * @returns {Promise<void>}
   */
  async _init() {
    if (this._poolAddressMap && this._poolContract && this._uiPoolDataProviderContract) {
      return;
    }

    const network = await this._account._account.provider.getNetwork()
    const chainId = network.chainId

    if (!AAVE_V3_ADDRESS_MAP[chainId]) {
      throw new Error('Aave protocol is not supported for this chain')
    }

    this._poolAddressMap = AAVE_V3_ADDRESS_MAP[chainId]
    this._poolContract = new Contract(this._poolAddressMap.pool, IPool_ABI, this._account._account.provider)
    this._uiPoolDataProviderContract = new Contract(this._poolAddressMap.uiPoolDataProvider, UiPoolDataProviderAbi, this._account._account.provider)
  }

  /**
   * Returns a transaction for token spending approval.
   *
   * @private
   * @param {string} spender - The address that spends token.
   * @param {string} token - The token to request spending approval.
   * @param {number} amount - Amount of spending to be approved.
   * @returns {Promise<EvmTransaction | undefined>} Returns the EVM transaction.
   */
  async _getApproveTransaction(spender, token, amount) {
    const tokenContract = new Contract(token, IERC20_ABI, this._account._account.provider)
    const owner = await this._account.getAddress()
    const allowance = await tokenContract.allowance(owner, spender)

    if (BigInt(allowance) >= BigInt(amount)) {
      return;
    }

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
    const address = await this._account.getAddress()

    const supplyData = this._poolContract.interface.encodeFunctionData('supply', [
      options.token,
      options.amount,
      options.onBehalfOf || address,
      0 // Referral code - currently inactive, 0 means no 3rd party referral
    ])

    return {
      from: address,
      data: supplyData,
      to: this._poolAddressMap.pool,
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
    const withdrawData = this._poolContract.interface.encodeFunctionData('withdraw', [
      options.token,
      options.amount,
      options.to || address
    ])

    return {
      from: address,
      data: withdrawData,
      to: this._poolAddressMap.pool,
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
      to: this._poolAddressMap.pool,
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
    const repayData = this._poolContract.interface.encodeFunctionData('repay', [
      options.token,
      options.amount,
      2, // interestRateMode - should always be passed a value of 2 (variable rate mode)
      options.onBehalfOf || address
    ])

    return {
      from: address,
      data: repayData,
      to: this._poolAddressMap,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    }
  }

  async test() {
    await this._init()
    const token = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    const uiPoolDataContract = new Contract(AaveV3Ethereum.UI_POOL_DATA_PROVIDER, UiPoolDataProviderAbi, this._account._account.provider)

    // get supply cap
    const [reserves, baseCurrencyInfo] = await uiPoolDataContract.getReservesData(AaveV3Ethereum.POOL_ADDRESSES_PROVIDER)

    const supplyTokenReserve = reserves.find((reserve) => reserve[0] === token)

    // can cache reserve data for approximately 1 block
    console.log('supplyCap', supplyTokenReserve.supplyCap)
    console.log('borrowCap', supplyTokenReserve.borrowCap)
    console.log('isIsolatedAsset', supplyTokenReserve.debtCeiling === 0)
    console.log('baseCurrency decimals', baseCurrencyInfo.marketReferenceCurrencyUnit.toString().length - 1)

    const resp = await this._poolContract.getConfiguration(token)
    const tokenConfig = resp[0]
    let shiftedValue = tokenConfig >> 116n
    let mask = (1n << 36n) - 1n
    const supplyCap = shiftedValue & mask
    shiftedValue = tokenConfig >> 48n
    mask = (1n << 7n) - 1n
    const decimals = shiftedValue & mask
    console.log('from Pool', supplyCap)
    console.log(decimals)

    // const decimals = tokenConfig.slice(48,56)
    // const isIsolatedAsset = tokenConfig.slice(61)
    // const borrowCap = tokenConfig.slice(80, 116)
    // [0xdAC17F958D2ee523a2206206994597C13D831ec7,Tether USD,USDT,6,7500,7800,10450,1000,true,true,true,false,1131674900196175030040169129,1181964497924486439895605249,38895280465105000290122400,50829358665954465861444837,1753965371,0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a,0x6df1C1E379bC5a00a7b4C6e67A203333772f45A8,0x9ec6F08190DeA04A54f8Afc53Db96134e5E3FdFB,1078226969928068,5178920102483096,99997702,0x260326c220E469358846b187eE53328303Efe19C,55000000000000000000000000,225000000000000000000000000,0,920000000000000000000000000,false,false,11684505145,0,0,true,0,2,8000000000,8500000000,true,true,1078225815705289]/
    // console.log('resp', decimals, isIsolatedAsset, borrowCap)

    // borrow cap
  }

  /**
   * Supplies a specific token amount to the lending pool.
   *
   * @param {SupplyOptions} options - The supply's options.
   * @returns {Promise<SupplyResult>} The supply's result.
   */
  async supply (options) {
    await this._init()

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

    // todo: check if amount exceeds supply cap
    // todo: check if supplying isolated asset, if yes, amount cannot exceeds debt ceiling
    // todo: if supplied isolated asset before, any new supplied asset won't be used as collateral (isolation mode)

    if (tokenBalance < options.amount) {
      throw new Error('Insufficient fund to supply')
    }

    const approveTransaction = await this._getApproveTransaction(this._poolAddressMap, options.token, options.amount)

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
    await this._init()

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
    await this._init()

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
    // todo: must withdraw all 0 LTV tokens before any other assets

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
    await this._init()

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
    await this._init()

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    // todo: check borrow cap
    // todo: check borrow amount exceeds supplied collateral (under-collateralization)
    // todo: in case of delegation, check credit delegator for collateral

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
    await this._init()

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
   * Enter
   *
   * @param {RepayOptions} options - The borrow's options.
   * @returns {Promise<RepayResult>} The repay's result.
   */
  async repay(options) {
    await this._init()

    if (options.onBehalfOf !== undefined && (options.onBehalfOf === ZeroAddress || !isAddress(options.onBehalfOf))) {
      throw new Error('On behalf address must be a valid EVM address')
    }

    if (options.amount <= 0) {
      throw new Error('Amount must be greater than 0')
    }

    if (!isAddress(options.token)) {
      throw new Error('Token must be a valid EVM address')
    }

    // todo: check when repay with a different token other than underlying token (can only repay with underlying or aTokens)
    // todo: verify borrow position and repay amount when repay max amount

    const approveTransaction = await this._getApproveTransaction(this._poolAddressMap, options.token, options.amount)

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
    await this._init()

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
    await this._init()

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
    await this._init()

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
      to: this._poolAddressMap,
      value: 0,
      gasLimit: DEFAULT_GAS_LIMIT
    })
  }
}