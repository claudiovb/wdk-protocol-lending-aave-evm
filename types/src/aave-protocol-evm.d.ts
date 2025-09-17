export default class AaveProtocolEvm extends LendingProtocol {
    /**
     * Creates a new read-only interface to the aave protocol for evm blockchains.
     *
     * @overload
     * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - The wallet account to use to interact with the protocol.
     */
    constructor(account: WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337);
    /**
     * Creates a new interface to the aave protocol for evm blockchains.
     *
     * @overload
     * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - The wallet account to use to interact with the protocol.
     */
    constructor(account: WalletAccountEvm | WalletAccountEvmErc4337);
    /** @private */
    private _chainId;
    /** @private */
    private _addressMap;
    /** @private */
    private _poolContract;
    /** @private */
    private _uiPoolDataProviderContract;
    /** @private */
    private _provider;
    /**
     * Supplies a specific token amount to the lending pool.
     *
     * @param {SupplyOptions} options - The supply's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<SupplyResult>} The supply's result.
     */
    supply(options: SupplyOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<SupplyResult>;
    /**
     * Quotes the costs of a supply operation.
     *
     * @param {SupplyOptions} options - The supply's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<SupplyResult, 'hash' | 'approveHash'>>} The supply's costs.
     */
    quoteSupply(options: SupplyOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<SupplyResult, "hash" | "approveHash" | "resetAllowanceHash">>;
    /** @private */
    private _getSupplyTransaction;
    /**
     * Withdraws a specific token amount from the pool.
     *
     * @param {WithdrawOptions} options - The withdraw's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<WithdrawResult>} The withdraw's result.
     */
    withdraw(options: WithdrawOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<WithdrawResult>;
    /**
     * Quotes the costs of a withdraw operation.
     *
     * @param {WithdrawOptions} options - The withdraw's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<WithdrawResult, 'hash'>>} The withdraw's result.
     */
    quoteWithdraw(options: WithdrawOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<WithdrawResult, "hash">>;
    /** @private */
    private _getWithdrawTransaction;
    /**
     * Borrows a specific token amount.
     *
     * @param {BorrowOptions} options - The borrow's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<BorrowResult>} The borrow's result.
     */
    borrow(options: BorrowOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<BorrowResult>;
    /**
     * Quotes the costs of a borrow operation.
     *
     * @param {BorrowOptions} options - The borrow's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<BorrowResult, 'hash'>>} The borrow's result.
     */
    quoteBorrow(options: BorrowOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<BorrowResult, "hash">>;
    /** @private */
    private _getBorrowTransaction;
    /**
     * Repays a specific token amount.
     *
     * @param {RepayOptions} options - The borrow's options,
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<RepayResult>} The repay's result.
     */
    repay(options: RepayOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<RepayResult>;
    /**
     * Quotes the costs of a repay operation.
     *
     * @param {RepayOptions} options - The repay's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<RepayResult, 'hash' | 'approveHash'>>} The repay's costs.
     */
    quoteRepay(options: RepayOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<RepayResult, "hash" | "approveHash" | "resetAllowanceHash">>;
    /** @private */
    private _getRepayTransaction;
    /**
     * Enables/disables a specific token as a collateral for the account's borrow operations.
     *
     * @param {string} token - The token's address.
     * @param {boolean} useAsCollateral - True if the token should be a valid collateral.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<TransactionResult>} The transaction's result.
     */
    setUseReserveAsCollateral(token: string, useAsCollateral: boolean, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<TransactionResult>;
    /**
     * Allows user to use the protocol in efficiency mode.
     *
     * @param {number} categoryId - The eMode category id defined by Risk or Pool Admins (0 - 255). 'categoryId' set to 0 is a non eMode category.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<TransactionResult>} The transaction's result.
     */
    setUserEMode(categoryId: number, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<TransactionResult>;
    /**
     * Returns this or another account's data.
     *
     * @param {string} [account] - If set, returns the account's data for the given address.
     * @returns {Promise<AccountData>} The account's data.
     */
    getAccountData(account?: string): Promise<AccountData>;
    /** @private */
    private _getChainId;
    /** @private */
    private _getAddressMap;
    /** @private */
    private _getPoolContract;
    /** @private */
    private _getUiPoolDataProviderContract;
    /** @private */
    private _getTokenReserve;
    /** @private */
    private _getApproveTransaction;
    /** @private */
    private _assertTokenBalance;
    /** @private */
    private _assertTokenReserveStatus;
}
export type TransactionResult = import("@wdk/wallet").TransactionResult;
export type BorrowOptions = import("@wdk/wallet/protocols").BorrowOptions;
export type BorrowResult = import("@wdk/wallet/protocols").BorrowResult;
export type SupplyOptions = import("@wdk/wallet/protocols").SupplyOptions;
export type WithdrawOptions = import("@wdk/wallet/protocols").WithdrawOptions;
export type WithdrawResult = import("@wdk/wallet/protocols").WithdrawResult;
export type RepayOptions = import("@wdk/wallet/protocols").RepayOptions;
export type WalletAccountReadOnlyEvm = import("@wdk/wallet-evm").WalletAccountReadOnlyEvm;
export type EvmErc4337WalletConfig = import("@wdk/wallet-evm-erc-4337").EvmErc4337WalletConfig;
export type SupplyResult = {
    /**
     * - The hash of the supply operation.
     */
    hash: string;
    /**
     * - The gas cost.
     */
    fee: bigint;
    /**
     * - If the protocol has been initialized with a standard wallet account, this field will contain the hash
     * of the approve call to allow aave to transfer the tokens to their pools. If the protocol has been initialized with an erc-4337 wallet account,
     * this field will be undefined (since the approve call will be bundled in the user operation with hash {@link SupplyResult#hash}).
     */
    approveHash?: string;
    /**
     * - If the supply operation has been performed on ethereum mainnet by supplying usdt tokens, this field will
     * contain the hash of the approve call that resets the allowance of the aave protocol to zero (due to the usdt allowance reset requirement).
     * If the protocol has been initialized with an erc-4337 wallet account, this field will be undefined (since the approve call will be bundled in
     * the user operation with hash {@link SupplyResult#hash}).
     */
    resetAllowanceHash?: string;
};
export type RepayResult = {
    /**
     * - The hash of the repay operation.
     */
    hash: string;
    /**
     * - The gas cost.
     */
    fee: bigint;
    /**
     * - If the protocol has been initialized with a standard wallet account, this field will contain the hash
     * of the approve call to allow aave to transfer the tokens to their pools. If the protocol has been initialized with an erc-4337 wallet account,
     * this field will be undefined (since the approve call will be bundled in the user operation with hash {@link RepayResult#hash}).
     */
    approveHash?: string;
    /**
     * - If the repay operation has been performed on ethereum mainnet by repaying usdt tokens, this field will
     * contain the hash of the approve call that resets the allowance of the aave protocol to zero (due to the usdt allowance reset requirement).
     * If the protocol has been initialized with an erc-4337 wallet account, this field will be undefined (since the approve call will be bundled in
     * the user operation with hash {@link RepayResult#hash}).
     */
    resetAllowanceHash?: string;
};
export type AccountData = {
    /**
     * - The account's total collateral base.
     */
    totalCollateralBase: bigint;
    /**
     * - The account's total debt base.
     */
    totalDebtBase: bigint;
    /**
     * - The account's available borrowing base.
     */
    availableBorrowsBase: bigint;
    /**
     * - The account's current liquidation threshold.
     */
    currentLiquidationThreshold: bigint;
    /**
     * - The account's loan-to-value.
     */
    ltv: bigint;
    /**
     * - The account's health factor.
     */
    healthFactor: bigint;
};
import { LendingProtocol } from '@wdk/wallet/protocols';
import { WalletAccountReadOnlyEvmErc4337 } from '@wdk/wallet-evm-erc-4337';
import { WalletAccountEvm } from '@wdk/wallet-evm';
import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337';
