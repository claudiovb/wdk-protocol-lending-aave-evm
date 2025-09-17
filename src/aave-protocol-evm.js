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
import { WalletAccountEvm } from '@wdk/wallet-evm'
import { WalletAccountEvmErc4337, WalletAccountReadOnlyEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

// eslint-disable-next-line camelcase
import { IERC20_ABI, IPool_ABI } from '@bgd-labs/aave-address-book/abis'
import { BrowserProvider, Contract, isAddress, JsonRpcProvider, ZeroAddress } from 'ethers'
import AAVE_V3_ADDRESS_MAP from './aave-v3-address-map.js'

import UiPoolDataProviderAbi from './ui-pool-data-provider.js'

/** @typedef {import('@wdk/wallet').TransactionResult} TransactionResult */

/** @typedef {import('@wdk/wallet/protocols').BorrowOptions} BorrowOptions */
/** @typedef {import('@wdk/wallet/protocols').BorrowResult} BorrowResult */
/** @typedef {import('@wdk/wallet/protocols').SupplyOptions} SupplyOptions */
/** @typedef {import('@wdk/wallet/protocols').WithdrawOptions} WithdrawOptions */
/** @typedef {import('@wdk/wallet/protocols').WithdrawResult} WithdrawResult */
/** @typedef {import('@wdk/wallet/protocols').RepayOptions} RepayOptions */

/** @typedef {import('@wdk/wallet-evm').WalletAccountReadOnlyEvm} WalletAccountReadOnlyEvm */

/** @typedef {import('@wdk/wallet-evm-erc-4337').EvmErc4337WalletConfig} EvmErc4337WalletConfig */

/**
 * @typedef {Object} SupplyResult
 * @property {string} hash - The hash of the supply operation.
 * @property {bigint} fee - The gas cost.
 * @property {string} [approveHash] - If the protocol has been initialized with a standard wallet account, this field will contain the hash
 *   of the approve call to allow aave to transfer the tokens to their pools. If the protocol has been initialized with an erc-4337 wallet account,
 *   this field will be undefined (since the approve call will be bundled in the user operation with hash {@link SupplyResult#hash}).
 * @property {string} [resetAllowanceHash] - If the supply operation has been performed on ethereum mainnet by supplying usdt tokens, this field will
 *   contain the hash of the approve call that resets the allowance of the aave protocol to zero (due to the usdt allowance reset requirement).
 *   If the protocol has been initialized with an erc-4337 wallet account, this field will be undefined (since the approve call will be bundled in
 *   the user operation with hash {@link SupplyResult#hash}).
 */

/**
 * @typedef {Object} RepayResult
 * @property {string} hash - The hash of the repay operation.
 * @property {bigint} fee - The gas cost.
 * @property {string} [approveHash] - If the protocol has been initialized with a standard wallet account, this field will contain the hash
 *   of the approve call to allow aave to transfer the tokens to their pools. If the protocol has been initialized with an erc-4337 wallet account,
 *   this field will be undefined (since the approve call will be bundled in the user operation with hash {@link RepayResult#hash}).
 * @property {string} [resetAllowanceHash] - If the repay operation has been performed on ethereum mainnet by repaying usdt tokens, this field will
 *   contain the hash of the approve call that resets the allowance of the aave protocol to zero (due to the usdt allowance reset requirement).
 *   If the protocol has been initialized with an erc-4337 wallet account, this field will be undefined (since the approve call will be bundled in
 *   the user operation with hash {@link RepayResult#hash}).
 */

/**
 * @typedef {Object} AccountData
 * @property {bigint} totalCollateralBase - The account's total collateral base.
 * @property {bigint} totalDebtBase - The account's total debt base.
 * @property {bigint} availableBorrowsBase - The account's available borrowing base.
 * @property {bigint} currentLiquidationThreshold - The account's current liquidation threshold.
 * @property {bigint} ltv - The account's loan-to-value.
 * @property {bigint} healthFactor - The account's health factor.
 */

const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7'

export default class AaveProtocolEvm extends LendingProtocol {
  /**
   * Creates a new read-only interface to the aave protocol for evm blockchains.
   *
   * @overload
   * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - The wallet account to use to interact with the protocol.
   */

  /**
   * Creates a new interface to the aave protocol for evm blockchains.
   *
   * @overload
   * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - The wallet account to use to interact with the protocol.
   */
  constructor (account) {
    super(account)

    /** @private */
    this._chainId = undefined

    /** @private */
    this._addressMap = undefined

    /** @private */
    this._poolContract = undefined

    /** @private */
    this._uiPoolDataProviderContract = undefined

    if (account._config.provider) {
      const { provider } = account._config

      /** @private */
      this._provider = typeof provider === 'string'
        ? new JsonRpcProvider(provider)
        : new BrowserProvider(provider)
    }
  }

  /**
   * Supplies a specific token amount to the lending pool.
   *
   * @param {SupplyOptions} options - The supply's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<SupplyResult>} The supply's result.
   */
  async supply ({ token, amount, onBehalfOf }, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error("The 'supply(options)' method requires the protocol to be initialized with a non read-only account.")
    }

    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (onBehalfOf !== undefined && (onBehalfOf === ZeroAddress || !isAddress(onBehalfOf))) {
      throw new Error("'onBehalfOf' must be a valid address (not zero address).")
    }

    await this._assertTokenBalance(token, amount)

    await this._assertTokenReserveStatus(token, { checkFrozen: true })

    const chainId = await this._getChainId()

    const { pool } = await this._getAddressMap()

    let resetAllowanceTx

    if (chainId === 1n && token.toLowerCase() === USDT) {
      resetAllowanceTx = await this._getApproveTransaction(token, pool, 0)
    }

    const approveTx = await this._getApproveTransaction(token, pool, amount)
    const supplyTx = await this._getSupplyTransaction({ token, amount, onBehalfOf })

    if (this._account instanceof WalletAccountEvmErc4337) {
      const transactions = resetAllowanceTx ? [resetAllowanceTx, approveTx, supplyTx] : [approveTx, supplyTx]

      const transaction = await this._account.sendTransaction(transactions, config)

      return transaction
    }

    const { hash: resetAllowanceHash, fee: resetAllowanceFee } = resetAllowanceTx
      ? await this._account.sendTransaction(resetAllowanceTx)
      : { hash: undefined, fee: 0n }

    const { hash: approveHash, fee: approveFee } = await this._account.sendTransaction(approveTx)
    const { hash, fee: supplyFee } = await this._account.sendTransaction(supplyTx)
    const fee = resetAllowanceFee + approveFee + supplyFee

    return { resetAllowanceHash, approveHash, hash, fee }
  }

  /**
   * Quotes the costs of a supply operation.
   *
   * @param {SupplyOptions} options - The supply's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<Omit<SupplyResult, 'hash' | 'approveHash' | 'resetAllowanceHash'>>} The supply's costs.
   */
  async quoteSupply ({ token, amount, onBehalfOf }, config) {
    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (onBehalfOf !== undefined && (onBehalfOf === ZeroAddress || !isAddress(onBehalfOf))) {
      throw new Error("'onBehalfOf' must be a valid address (not zero address).")
    }

    const chainId = await this._getChainId()

    const { pool } = await this._getAddressMap()

    let resetAllowanceTx

    if (chainId === 1n && token.toLowerCase() === USDT) {
      resetAllowanceTx = await this._getApproveTransaction(token, pool, 0)
    }

    const approveTx = await this._getApproveTransaction(token, pool, amount)
    const supplyTx = await this._getSupplyTransaction({ token, amount, onBehalfOf })

    if (this._account instanceof WalletAccountReadOnlyEvmErc4337) {
      const transactions = resetAllowanceTx ? [resetAllowanceTx, approveTx, supplyTx] : [approveTx, supplyTx]

      const transaction = await this._account.quoteSendTransaction(transactions, config)

      return transaction
    }

    const { fee: resetAllowanceFee } = resetAllowanceTx
      ? await this._account.quoteSendTransaction(resetAllowanceTx)
      : { hash: undefined, fee: 0n }

    const { fee: approveFee } = await this._account.quoteSendTransaction(approveTx)
    const { fee: supplyFee } = await this._account.quoteSendTransaction(supplyTx)
    const fee = resetAllowanceFee + approveFee + supplyFee

    return { fee }
  }

  /** @private */
  async _getSupplyTransaction ({ token, amount, onBehalfOf }) {
    const address = await this._account.getAddress()

    const poolContract = await this._getPoolContract()

    return {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('supply', [
        token,
        amount,
        onBehalfOf || address,
        0
      ])
    }
  }

  /**
   * Withdraws a specific token amount from the pool.
   *
   * @param {WithdrawOptions} options - The withdraw's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<WithdrawResult>} The withdraw's result.
   */
  async withdraw ({ token, amount, to }, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error("The 'withdraw(options)' method requires the protocol to be initialized with a non read-only account.")
    }

    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (to !== undefined && (to === ZeroAddress || !isAddress(to))) {
      throw new Error("'to' must be a valid address (not zero address).")
    }

    await this._assertTokenReserveStatus(token, { checkFrozen: true })

    const withdrawTx = await this._getWithdrawTransaction({ token, amount, to })

    const transaction = this._account instanceof WalletAccountEvmErc4337
      ? await this._account.sendTransaction(withdrawTx, config)
      : await this._account.sendTransaction(withdrawTx)

    return transaction
  }

  /**
   * Quotes the costs of a withdraw operation.
   *
   * @param {WithdrawOptions} options - The withdraw's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<Omit<WithdrawResult, 'hash'>>} The withdraw's result.
   */
  async quoteWithdraw ({ token, amount, to }, config) {
    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (to !== undefined && (to === ZeroAddress || !isAddress(to))) {
      throw new Error("'to' must be a valid address (not zero address).")
    }

    const withdrawTx = await this._getWithdrawTransaction({ token, amount, to })

    const transaction = this._account instanceof WalletAccountReadOnlyEvmErc4337
      ? await this._account.quoteSendTransaction(withdrawTx, config)
      : await this._account.quoteSendTransaction(withdrawTx)

    return transaction
  }

  /** @private */
  async _getWithdrawTransaction ({ token, amount, to }) {
    const address = await this._account.getAddress()

    const poolContract = await this._getPoolContract()

    return {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('withdraw', [
        token,
        amount,
        to || address
      ])
    }
  }

  /**
   * Borrows a specific token amount.
   *
   * @param {BorrowOptions} options - The borrow's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<BorrowResult>} The borrow's result.
   */
  async borrow ({ token, amount, onBehalfOf }, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error("The 'borrow(options)' method requires the protocol to be initialized with a non read-only account.")
    }

    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (onBehalfOf !== undefined && (onBehalfOf === ZeroAddress || !isAddress(onBehalfOf))) {
      throw new Error("'onBehalfOf' must be a valid address (not zero address).")
    }

    await this._assertTokenReserveStatus(token, { checkFrozen: true, checkBorrowing: true })

    const borrowTx = await this._getBorrowTransaction({ token, amount, onBehalfOf })

    const transaction = this._account instanceof WalletAccountEvmErc4337
      ? await this._account.sendTransaction(borrowTx, config)
      : await this._account.sendTransaction(borrowTx)

    return transaction
  }

  /**
   * Quotes the costs of a borrow operation.
   *
   * @param {BorrowOptions} options - The borrow's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<Omit<BorrowResult, 'hash'>>} The borrow's result.
   */
  async quoteBorrow ({ token, amount, onBehalfOf }, config) {
    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (onBehalfOf !== undefined && (onBehalfOf === ZeroAddress || !isAddress(onBehalfOf))) {
      throw new Error("'onBehalfOf' must be a valid address (not zero address).")
    }

    const borrowTx = await this._getBorrowTransaction({ token, amount, onBehalfOf })

    const transaction = this._account instanceof WalletAccountReadOnlyEvmErc4337
      ? await this._account.quoteSendTransaction(borrowTx, config)
      : await this._account.quoteSendTransaction(borrowTx)

    return transaction
  }

  /** @private */
  async _getBorrowTransaction ({ token, amount, onBehalfOf }) {
    const address = await this._account.getAddress()

    const poolContract = await this._getPoolContract()

    return {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('borrow', [
        token,
        amount,
        2,
        0,
        onBehalfOf || address
      ])
    }
  }

  /**
   * Repays a specific token amount.
   *
   * @param {RepayOptions} options - The borrow's options,
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<RepayResult>} The repay's result.
   */
  async repay ({ token, amount, onBehalfOf }, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error("The 'repay(options)' method requires the protocol to be initialized with a non read-only account.")
    }

    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (onBehalfOf !== undefined && (onBehalfOf === ZeroAddress || !isAddress(onBehalfOf))) {
      throw new Error("'onBehalfOf' must be a valid address (not zero address).")
    }

    await this._assertTokenBalance(token, amount)

    await this._assertTokenReserveStatus(token)

    const chainId = await this._getChainId()

    const { pool } = await this._getAddressMap()

    let resetAllowanceTx

    if (chainId === 1n && token.toLowerCase() === USDT) {
      resetAllowanceTx = await this._getApproveTransaction(token, pool, 0)
    }

    const approveTx = await this._getApproveTransaction(token, pool, amount)
    const repayTx = await this._getRepayTransaction({ token, amount, onBehalfOf })

    if (this._account instanceof WalletAccountEvmErc4337) {
      const transactions = resetAllowanceTx ? [resetAllowanceTx, approveTx, repayTx] : [approveTx, repayTx]

      const transaction = await this._account.sendTransaction(transactions, config)

      return transaction
    }

    const { hash: resetAllowanceHash, fee: resetAllowanceFee } = resetAllowanceTx
      ? await this._account.sendTransaction(resetAllowanceTx)
      : { hash: undefined, fee: 0n }

    const { hash: approveHash, fee: approveFee } = await this._account.sendTransaction(approveTx)
    const { hash, fee: repayFee } = await this._account.sendTransaction(repayTx)
    const fee = resetAllowanceFee + approveFee + repayFee

    return { resetAllowanceHash, approveHash, hash, fee }
  }

  /**
   * Quotes the costs of a repay operation.
   *
   * @param {RepayOptions} options - The repay's options.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<Omit<RepayResult, 'hash' | 'approveHash' | 'resetAllowanceHash'>>} The repay's costs.
   */
  async quoteRepay ({ token, amount, onBehalfOf }, config) {
    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    if (amount <= 0) {
      throw new Error("'amount' should be greater than zero.")
    }

    if (onBehalfOf !== undefined && (onBehalfOf === ZeroAddress || !isAddress(onBehalfOf))) {
      throw new Error("'onBehalfOf' must be a valid address (not zero address).")
    }

    const chainId = await this._getChainId()

    const { pool } = await this._getAddressMap()

    let resetAllowanceTx

    if (chainId === 1n && token.toLowerCase() === USDT) {
      resetAllowanceTx = await this._getApproveTransaction(token, pool, 0)
    }

    const approveTx = await this._getApproveTransaction(token, pool, amount)
    const repayTx = await this._getRepayTransaction({ token, amount, onBehalfOf })

    if (this._account instanceof WalletAccountReadOnlyEvmErc4337) {
      const transactions = resetAllowanceTx ? [resetAllowanceTx, approveTx, repayTx] : [approveTx, repayTx]

      const transaction = await this._account.quoteSendTransaction(transactions, config)

      return transaction
    }

    const { fee: resetAllowanceFee } = resetAllowanceTx
      ? await this._account.quoteSendTransaction(resetAllowanceTx)
      : { hash: undefined, fee: 0n }

    const { fee: approveFee } = await this._account.quoteSendTransaction(approveTx)
    const { fee: repayFee } = await this._account.quoteSendTransaction(repayTx)
    const fee = resetAllowanceFee + approveFee + repayFee

    return { fee }
  }

  /** @private */
  async _getRepayTransaction ({ token, amount, onBehalfOf }) {
    const address = await this._account.getAddress()

    const poolContract = await this._getPoolContract()

    return {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('repay', [
        token,
        amount,
        2,
        onBehalfOf || address
      ])
    }
  }

  /**
   * Enables/disables a specific token as a collateral for the account's borrow operations.
   *
   * @param {string} token - The token's address.
   * @param {boolean} useAsCollateral - True if the token should be a valid collateral.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async setUseReserveAsCollateral (token, useAsCollateral, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error("The 'setUseReserveAsCollateral(token, useAsCollateral)' method requires the protocol to be initialized with a non read-only account.")
    }

    if (!isAddress(token)) {
      throw new Error("'token' must be a valid address.")
    }

    const poolContract = await this._getPoolContract()

    const tx = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('setUserUseReserveAsCollateral', [token, useAsCollateral])
    }

    const transaction = this._account instanceof WalletAccountEvmErc4337
      ? await this._account.sendTransaction(tx, config)
      : await this._account.sendTransaction(tx)

    return transaction
  }

  /**
   * Allows user to use the protocol in efficiency mode.
   *
   * @param {number} categoryId - The eMode category id defined by Risk or Pool Admins (0 - 255). 'categoryId' set to 0 is a non eMode category.
   * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
   *   overrides the 'paymasterToken' option defined in its configuration.
   * @returns {Promise<TransactionResult>} The transaction's result.
   */
  async setUserEMode (categoryId, config) {
    if (!(this._account instanceof WalletAccountEvm || this._account instanceof WalletAccountEvmErc4337)) {
      throw new Error("The 'setUserEMode(categoryId)' method requires the protocol to be initialized with a non read-only account.")
    }

    if (categoryId < 0 || categoryId > 255) {
      throw new Error("'categoryId' must be a valid category id.")
    }

    const poolContract = await this._getPoolContract()

    const tx = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('setUserEMode', [categoryId])
    }

    const transaction = this._account instanceof WalletAccountEvmErc4337
      ? await this._account.sendTransaction(tx, config)
      : await this._account.sendTransaction(tx)

    return transaction
  }

  /**
   * Returns this or another account's data.
   *
   * @param {string} [account] - If set, returns the account's data for the given address.
   * @returns {Promise<AccountData>} The account's data.
   */
  async getAccountData (account) {
    if (account !== undefined && (account === ZeroAddress || !isAddress(account))) {
      throw new Error("'account' must be a valid address (not zero address).")
    }

    const address = account || await this._account.getAddress()

    const poolContract = await this._getPoolContract()

    const accountData = await poolContract.getUserAccountData(address)

    return {
      totalCollateralBase: accountData[0],
      totalDebtBase: accountData[1],
      availableBorrowsBase: accountData[2],
      currentLiquidationThreshold: accountData[3],
      ltv: accountData[4],
      healthFactor: accountData[5]
    }
  }

  /** @private */
  async _getChainId () {
    if (!this._addressMap) {
      const { chainId } = await this._provider.getNetwork()

      this._chainId = chainId
    }

    return this._chainId
  }

  /** @private */
  async _getAddressMap () {
    if (!this._addressMap) {
      const chainId = await this._getChainId()

      if (!AAVE_V3_ADDRESS_MAP[chainId]) {
        throw new Error(`The blockchain with id ${chainId} is not supported yet.`)
      }

      this._addressMap = AAVE_V3_ADDRESS_MAP[chainId]
    }

    return this._addressMap
  }

  /** @private */
  async _getPoolContract () {
    if (!this._poolContract) {
      const { pool } = await this._getAddressMap()

      this._poolContract = new Contract(pool, IPool_ABI, this._provider)
    }

    return this._poolContract
  }

  /** @private */
  async _getUiPoolDataProviderContract () {
    if (!this._uiPoolDataProviderContract) {
      const { uiPoolDataProvider } = await this._getAddressMap()

      this._uiPoolDataProviderContract = new Contract(uiPoolDataProvider, UiPoolDataProviderAbi, this._provider)
    }

    return this._uiPoolDataProviderContract
  }

  /** @private */
  async _getTokenReserve (token) {
    const { poolAddressesProvider } = await this._getAddressMap()
    const uiPoolDataProviderContract = await this._getUiPoolDataProviderContract()
    const [reserves] = await uiPoolDataProviderContract.getReservesData(poolAddressesProvider)

    const tokenReserve = reserves.find(({ underlyingAsset }) => underlyingAsset.toLowerCase() === token.toLowerCase())

    if (!tokenReserve) {
      throw new Error(`Token reserve not found for token '${token}'.`)
    }

    return tokenReserve
  }

  /** @private */
  async _getApproveTransaction (token, spender, amount) {
    const tokenContract = new Contract(token, IERC20_ABI)

    return {
      to: token,
      value: 0,
      data: tokenContract.interface.encodeFunctionData('approve', [spender, amount])
    }
  }

  /** @private */
  async _assertTokenBalance (token, amount) {
    const tokenBalance = await this._account.getTokenBalance(token)

    if (tokenBalance < amount) {
      throw new Error('Not enough funds to fulfill the operation.')
    }
  }

  /** @private */
  async _assertTokenReserveStatus (token, { checkFrozen, checkBorrowing } = {}) {
    const tokenReserve = await this._getTokenReserve(token)

    if (tokenReserve.isPaused) {
      throw new Error("The token's reserve is currently paused.")
    }

    if (!tokenReserve.isActive) {
      throw new Error("The token's reserve is currently not active.")
    }

    if (checkFrozen && tokenReserve.isFrozen) {
      throw new Error("The token's reserve is currently frozen.")
    }

    if (checkBorrowing && !tokenReserve.borrowingEnabled) {
      throw new Error("The token's reserve doesn't currently allow borrows.")
    }
  }
}
