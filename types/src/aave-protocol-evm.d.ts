export default class AaveProtocolEvm extends LendingProtocol {
    /**
     * Creates a read-only handler for Aave Protocol on any EVM chain.
     *
     * @overload
     * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - The EVM wallet that interacts with Aave Protocol.
     */
    constructor(account: WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337);
    /**
     * Creates a handler for Aave Protocol on any EVM chain.
     *
     * @overload
     * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - The EVM wallet that interacts with Aave Protocol.
     */
    constructor(account: WalletAccountEvm | WalletAccountEvmErc4337);
    /**
     * The address mapping by chain of Aave Protocol's contracts
     *
     * @private
     * @type {Record<string, string> | undefined}
     */
    private _addressMap;
    /** The main contract to interact with Aave Protocol.
     *
     * @private
     * @type {Contract | undefined}
     */
    private _poolContract;
    /**
     * The contract to query protocol and user's information.
     *
     * @private
     * @type {Contract | undefined}
     */
    private _uiPoolDataProviderContract;
    _getAddressMap(): Promise<Record<string, string>>;
    _getPoolContract(): Promise<Contract>;
    _getUiPoolDataProviderContract(): Promise<Contract>;
    /**
     * Returns a transaction for token spending approval.
     *
     * @private
     * @param {string} token - The token to request spending approval.
     * @param {string} spender - The address that spends token.
     * @param {number} amount - Amount of spending to be approved.
     * @returns {Promise<EvmTransaction>} Returns the EVM transaction.
     */
    private _getApproveTransaction;
    /**
     *
     * @private
     * @param {SupplyOptions} options
     * @returns {Promise<void>}
     */
    private _validateSupply;
    /**
     * @private
     * @param {WithdrawOptions} options
     * @returns {Promise<void>}
     */
    private _validateWithdraw;
    /**
     *
     * @private
     * @param {BorrowOptions} options
     * @returns {Promise<void>}
     */
    private _validateBorrow;
    /**
     *
     * @private
     * @param {RepayOptions} options
     * @returns {Promise<void>}
     */
    private _validateRepay;
    /**
     * Returns a transaction to supply a specific token amount to the lending pool.
     *
     * @private
     * @param {SupplyOptions} options - The supply's options.
     * @returns {Promise<EvmTransaction>} Returns the EVM transaction to supply.
     */
    private _getSupplyTransaction;
    /**
     * Returns a transaction to withdraw a specific token amount from the pool.
     *
     * @private
     * @param {WithdrawOptions} options - The withdraw's options.
     * @returns {Promise<EvmTransaction>} Returns the EVM transaction to withdraw.
     */
    private _getWithdrawTransaction;
    /**
     * Returns a transaction to borrow a specific token amount.
     *
     * @private
     * @param {BorrowOptions} options - The borrow's options.
     * @returns {Promise<EvmTransaction>} Returns the EVM transaction to borrow.
     */
    private _getBorrowTransaction;
    /**
     * Returns a transaction to repay a specific token amount.
     *
     * @private
     * @param {RepayOptions} options - The repay's options.
     * @returns {Promise<EvmTransaction>} Return the EVM transaction to repay.
     */
    private _getRepayTransaction;
    /**
     * Returns the account’s data.
     *
     * @returns {Promise<AccountData>} Returns the account's data.
     */
    getAccountData(): Promise<AccountData>;
    /**
     * Enables/disables a specific token as a collateral for the account’s borrow operations.
     *
     * @param {string} token - The token's address.
     * @param {boolean} useAsCollateral - True if the token should be a valid collateral.
     * @returns {Promise<void>}
     */
    setUseReserveAsCollateral(token: string, useAsCollateral: boolean): Promise<void>;
}
export type BorrowOptions = import("@wdk/wallet/protocols").BorrowOptions;
export type BorrowResult = import("@wdk/wallet/protocols").BorrowResult;
export type SupplyOptions = import("@wdk/wallet/protocols").SupplyOptions;
export type SupplyResult = import("@wdk/wallet/protocols").SupplyResult;
export type WithdrawOptions = import("@wdk/wallet/protocols").WithdrawOptions;
export type WithdrawResult = import("@wdk/wallet/protocols").WithdrawResult;
export type RepayOptions = import("@wdk/wallet/protocols").RepayOptions;
export type RepayResult = import("@wdk/wallet/protocols").RepayResult;
export type WalletAccountReadOnlyEvm = import("@wdk/wdk-wallet-evm").WalletAccountReadOnlyEvm;
export type WalletAccountEvm = import("@wdk/wdk-wallet-evm").WalletAccountEvm;
export type EvmTransaction = import("@wdk/wdk-wallet-evm").EvmTransaction;
export type WalletAccountReadOnlyEvmErc4337 = import("@wdk/wdk-wallet-evm-erc-4337").WalletAccountReadOnlyEvmErc4337;
export type WalletAccountEvmErc4337 = import("@wdk/wdk-wallet-evm-erc-4337").WalletAccountEvmErc4337;
export type AccountData = {
    /**
     * - The account’s total collateral base.
     */
    totalCollateralBase: number;
    /**
     * - The account’s total debt base.
     */
    totalDebtBase: number;
    /**
     * - The account’s available borrows base.
     */
    availableBorrowsBase: number;
    /**
     * - The account’s current liquidation threshold.
     */
    currentLiquidationThreshold: number;
    /**
     * - The account’s loan-to-value.
     */
    ltv: number;
    /**
     * - The account’s health factor.
     */
    healthFactor: number;
};
import { LendingProtocol } from '@wdk/wallet/protocols';
import { Contract } from 'ethers';
