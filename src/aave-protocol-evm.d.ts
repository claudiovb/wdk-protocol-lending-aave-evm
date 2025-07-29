export default class AaveProtocolEvm extends AbstractLendingProtocol {
    /**
     * Creates a new interface to the Aave protocol for Ethereum and Ethereum layer-2 blockchains.
     *
     * @param {WalletAccountEvm} account - EVM wallet account to interact with Aave protocol.
     */
    constructor(account: WalletAccountEvm);

    /**
     * Returns the account’s data.
     *
     * @returns {Promise<AccountData>} - Returns the account’s data.
     */
    getAccountData(): Promise<AccountData>;

    /**
     * Enables/disables a specific token as a collateral for the account’s borrow operations.
     *
     * @param {string} token - The token's address.
     * @param {boolean} useAsCollateral - True if the token should be a valid collateral.
     */
    setUseReserveAsCollateral(token: string, useAsCollateral: boolean): Promise<void>;
}

export type AccountData = {
    /**
     * The account’s total collateral base.
     */
    totalCollateralBase: number;

    /**
     * The account’s total debt base.
     */
    totalDebtBase: number;

    /**
     * The account’s available borrows base.
     */
    availableBorrowsBase: number;

    /**
     * The account’s current liquidation threshold.
     */
    currentLiquidationThreshold: number;

    /**
     * The account’s loan-to-value.
     */
    ltv: number;

    /**
     * The account’s health factor.
     */
    healthFactor: number;
}

export type WalletAccountEvm = import('@wdk/wdk-wallet-evm');
export type AbstractLendingProtocol = import('@wdk/wallet/protocols').AbstractLendingProtocol;
