export default class AaveProtocolEvm extends LendingProtocol {
    /**
     * Creates a new interface to the Aave protocol for Ethereum and Ethereum layer-2 blockchains.
     *
     * @overload
     * @param {WalletAccountEvm | WalletAccountEvmErc4337} account - EVM wallet account to interact with Aave protocol.
     */
    constructor(account: WalletAccountEvm | WalletAccountEvmErc4337);

    /**
     * Creates a new read-only interface to the Aave protocol for Ethereum and Ethereum layer-2 blockchains.
     *
     * @overload
     * @param {WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337} account - EVM wallet account to interact with Aave protocol.
     */
    constructor(account: WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337);

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
export type WalletAccountReadOnlyEvm = import('@wdk/wdk-wallet-evm');
export type WalletAccountReadOnlyEvmErc4337 = import('@wdk/wdk-wallet-evm-erc-4337');
export type WalletAccountEvmErc4337 = import('@wdk/wdk-wallet-evm-erc-4337');
import {LendingProtocol} from "@wdk/wallet/protocols";
