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
     * Users must first approve the necessary amount of tokens to the aave protocol using the {@link WalletAccountEvm#approve} or the {@link WalletAccountEvmErc4337#approve} method.
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
     * Users must first approve the necessary amount of tokens to the aave protocol using the {@link WalletAccountEvm#approve} or the {@link WalletAccountEvmErc4337#approve} method.
     *
     * @param {SupplyOptions} options - The supply's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<SupplyResult, 'hash'>>} The supply's costs.
     */
    quoteSupply(options: SupplyOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<SupplyResult, "hash">>;
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
     * Users must first approve the necessary amount of tokens to the aave protocol using the {@link WalletAccountEvm#approve} or the {@link WalletAccountEvmErc4337#approve} method.
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
     * Users must first approve the necessary amount of tokens to the aave protocol using the {@link WalletAccountEvm#approve} or the {@link WalletAccountEvmErc4337#approve} method.
     *
     * @param {RepayOptions} options - The repay's options.
     * @param {Pick<EvmErc4337WalletConfig, 'paymasterToken'>} [config] - If the protocol has been initialized with an erc-4337 wallet account,
     *   overrides the 'paymasterToken' option defined in its configuration.
     * @returns {Promise<Omit<RepayResult, 'hash'>>} The repay's costs.
     */
    quoteRepay(options: RepayOptions, config?: Pick<EvmErc4337WalletConfig, "paymasterToken">): Promise<Omit<RepayResult, "hash">>;
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
export type TransactionResult = import("@tetherto/wdk-wallet").TransactionResult;
export type BorrowOptions = import("@tetherto/wdk-wallet/protocols").BorrowOptions;
export type BorrowResult = import("@tetherto/wdk-wallet/protocols").BorrowResult;
export type SupplyOptions = import("@tetherto/wdk-wallet/protocols").SupplyOptions;
export type SupplyResult = import("@tetherto/wdk-wallet/protocols").SupplyResult;
export type WithdrawOptions = import("@tetherto/wdk-wallet/protocols").WithdrawOptions;
export type WithdrawResult = import("@tetherto/wdk-wallet/protocols").WithdrawResult;
export type RepayOptions = import("@tetherto/wdk-wallet/protocols").RepayOptions;
export type RepayResult = import("@tetherto/wdk-wallet/protocols").RepayResult;
export type WalletAccountReadOnlyEvm = import("@tetherto/wdk-wallet-evm").WalletAccountReadOnlyEvm;
export type EvmErc4337WalletConfig = import("@tetherto/wdk-wallet-evm-erc-4337").EvmErc4337WalletConfig;
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
import { LendingProtocol } from '@tetherto/wdk-wallet/protocols';
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm';
import { WalletAccountEvmErc4337, WalletAccountReadOnlyEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337';
