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
     * @returns {Record<string, string>}
     */
    private _getAddressMap;
    _addressMap: any;
    /** The main contract to interact with Aave Protocol.
     *
     * @private
     * @returns {Contract}
     */
    private _getPoolContract;
    _poolContract: Contract;
    /**
     * The contract to query protocol and user's information.
     *
     * @private
     * @returns {Contract}
     */
    private _getUiPoolDataProviderContract;
    _uiPoolDataProviderContract: Contract;
    /**
     * Returns a transaction for token spending approval.
     *
     * @private
     * @param {string} token - The token to request spending approval.
     * @param {string} spender - The address that spends token.
     * @param {number} amount - Amount of spending to be approved.
     * @returns {EvmTransaction} Returns the EVM transaction.
     */
    private _getApproveTransaction;
    _getTokenReserveData(token: any): Promise<any>;
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
    _getUserDebtByToken(tokenReserve: any, address: any): Promise<bigint>;
    /**
     *
     * @private
     * @param {RepayOptions} options
     * @returns {Promise<void>}
     */
    private _validateRepay;
    /**
     *
     * @private
     * @param {string} token
     * @param {boolean} useAsCollateral
     * @returns {Promise<void>}
     */
    private _validateUseReserveAsCollateral;
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
     * Supplies a specific token amount to the lending pool.
     *
     * @param {SupplyOptions} options - The supply's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<SupplyResult>} The supply's result.
     */
    supply(options: SupplyOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<SupplyResult>;
    /**
     * Quotes the costs of a supply operation.
     *
     * @param {SupplyOptions} options - The supply's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<Omit<SupplyResult, 'hash'>>} The supply's costs.
     */
    quoteSupply(options: SupplyOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<SupplyResult, "hash">>;
    /**
     * Withdraws a specific token amount from the pool.
     *
     * @param {WithdrawOptions} options - The withdraw's options. Set Infinity as amount to withdraw the entire balance.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<WithdrawResult>} The withdraw's result.
     */
    withdraw(options: WithdrawOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<WithdrawResult>;
    /**
     * Quotes the costs of a withdraw operation.
     *
     * @param {WithdrawOptions} options - The withdraw's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<Omit<WithdrawResult, 'hash'>>} The withdraw's result.
     */
    quoteWithdraw(options: WithdrawOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<WithdrawResult, "hash">>;
    /**
     * Borrows a specific token amount.
     *
     * @param {BorrowOptions} options - The borrow's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<BorrowResult>} The borrow's result.
     */
    borrow(options: BorrowOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<BorrowResult>;
    /**
     * Quotes the costs of a borrow operation.
     *
     * @param {BorrowOptions} options - The borrow's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<Omit<BorrowResult, 'hash'>>} The borrow's result.
     */
    quoteBorrow(options: BorrowOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<BorrowResult, "hash">>;
    /**
     * Repays a specific token amount.
     *
     * @param {RepayOptions} options - The borrow's options, set Infinity as amount to repay the whole debt
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<RepayResult>} The repay's result.
     */
    repay(options: RepayOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<RepayResult>;
    /**
     * Quotes the costs of a repay operation.
     *
     * @param {RepayOptions} options - The repay's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<Omit<RepayResult, 'hash'>>} The repay's costs.
     */
    quoteRepay(options: RepayOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<RepayResult, "hash">>;
    /**
     * Returns the account’s data.
     *
     * @param {string} [address] - The address to query account data
     * @returns {Promise<AccountData>} Returns the account's data.
     */
    getAccountData(address?: string): Promise<AccountData>;
    /**
     * Enables/disables a specific token as a collateral for the account’s borrow operations.
     *
     * @param {string} token - The token's address.
     * @param {boolean} useAsCollateral - True if the token should be a valid collateral.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If set, overrides the 'paymasterToken' option defined in the account configuration (only for evm erc-4337 accounts).
     * @returns {Promise<SetUseReserveAsCollateralResult>}
     */
    setUseReserveAsCollateral(token: string, useAsCollateral: boolean, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<SetUseReserveAsCollateralResult>;
    /**
     * Allows user to use the protocol in efficiency mode
     *
     * @param {number} categoryId - The eMode category id (0 - 255) defined by Risk or Pool Admins. categoryId set to 0 is a non eMode category
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config]
     * @returns {Promise<SetUserEModeResult>}
     */
    setUserEMode(categoryId: number, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<SetUserEModeResult>;
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
export type EvmErc4337WalletConfig = import("@wdk/wdk-wallet-evm-erc-4337").EvmErc4337WalletConfig;
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
export type SetUseReserveAsCollateralResult = {
    fee: number;
    hash: string;
};
export type SetUserEModeResult = {
    fee: number;
    hash: string;
};
import { LendingProtocol } from '@wdk/wallet/protocols';
import { Contract } from 'ethers';
