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

import {
  AaveV3Arbitrum,
  AaveV3Avalanche,
  AaveV3Base, AaveV3BNB, AaveV3Celo,
  AaveV3Ethereum, AaveV3EthereumEtherFi, AaveV3Gnosis, AaveV3Linea, AaveV3Metis,
  AaveV3Optimism,
  AaveV3Polygon, AaveV3Scroll, AaveV3Soneium, AaveV3Sonic, AaveV3ZkSync
} from '@bgd-labs/aave-address-book'

export const AAVE_V3_ADDRESS_MAP = {
  [AaveV3Ethereum.CHAIN_ID]: {
    pool: AaveV3Ethereum.POOL,
    uiPoolDataProvider: AaveV3Ethereum.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Ethereum.ORACLE
  },
  [AaveV3Arbitrum.CHAIN_ID]: {
    pool: AaveV3Arbitrum.POOL,
    uiPoolDataProvider: AaveV3Arbitrum.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Arbitrum.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Arbitrum.ORACLE
  },
  [AaveV3Base.CHAIN_ID]: {
    pool: AaveV3Base.POOL,
    uiPoolDataProvider: AaveV3Base.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Base.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Base.ORACLE
  },
  [AaveV3Optimism.CHAIN_ID]: {
    pool: AaveV3Optimism.POOL,
    uiPoolDataProvider: AaveV3Optimism.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Optimism.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Optimism.ORACLE
  },
  [AaveV3Polygon.CHAIN_ID]: {
    pool: AaveV3Polygon.POOL,
    uiPoolDataProvider: AaveV3Polygon.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Polygon.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Polygon.ORACLE
  },
  [AaveV3Avalanche.CHAIN_ID]: {
    pool: AaveV3Avalanche.POOL,
    uiPoolDataProvider: AaveV3Avalanche.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Avalanche.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Avalanche.ORACLE
  },
  [AaveV3BNB.CHAIN_ID]: {
    pool: AaveV3BNB.POOL,
    uiPoolDataProvider: AaveV3BNB.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3BNB.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3BNB.ORACLE
  },
  [AaveV3Celo.CHAIN_ID]: {
    pool: AaveV3Celo.POOL,
    uiPoolDataProvider: AaveV3Celo.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Celo.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Celo.ORACLE
  },
  [AaveV3Gnosis.CHAIN_ID]: {
    pool: AaveV3Gnosis.POOL,
    uiPoolDataProvider: AaveV3Gnosis.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Gnosis.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Gnosis.ORACLE
  },
  [AaveV3Linea.CHAIN_ID]: {
    pool: AaveV3Linea.POOL,
    uiPoolDataProvider: AaveV3Linea.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Linea.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Linea.ORACLE
  },
  [AaveV3Scroll.CHAIN_ID]: {
    pool: AaveV3Scroll.POOL,
    uiPoolDataProvider: AaveV3Scroll.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Scroll.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Scroll.ORACLE
  },
  [AaveV3Soneium.CHAIN_ID]: {
    pool: AaveV3Soneium.POOL,
    uiPoolDataProvider: AaveV3Soneium.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Soneium.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Soneium.ORACLE
  },
  [AaveV3Sonic.CHAIN_ID]: {
    pool: AaveV3Sonic.POOL,
    uiPoolDataProvider: AaveV3Sonic.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Sonic.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Sonic.ORACLE
  },
  [AaveV3ZkSync.CHAIN_ID]: {
    pool: AaveV3ZkSync.POOL,
    uiPoolDataProvider: AaveV3ZkSync.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3ZkSync.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3ZkSync.ORACLE
  },
  [AaveV3Metis.CHAIN_ID]: {
    pool: AaveV3Metis.POOL,
    uiPoolDataProvider: AaveV3Metis.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3Metis.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3Metis.ORACLE
  },
  [AaveV3EthereumEtherFi.CHAIN_ID]: {
    pool: AaveV3EthereumEtherFi.POOL,
    uiPoolDataProvider: AaveV3EthereumEtherFi.UI_POOL_DATA_PROVIDER,
    poolAddressesProvider: AaveV3EthereumEtherFi.POOL_ADDRESSES_PROVIDER,
    priceOracle: AaveV3EthereumEtherFi.ORACLE
  }
}

/**
 * @enum {string}
 */
export const AAVE_V3_ERROR = {
  INSUFFICIENT_FUND: 'Insufficient fund to supply',
  CANNOT_FIND_TOKEN_RESERVE: 'Cannot find token reserve',
  RESERVE_PAUSED: 'The reserve is paused',
  RESERVE_FROZEN: 'The reserve is frozen',
  RESERVE_INACTIVE: 'The reserve is inactive',
  SUPPLY_CAP_EXCEEDED: 'Supply cap is exceeded',
  INSUFFICIENT_BALANCE_TO_WITHDRAW: 'Cannot withdraw more than available balance',
  HEALTH_FACTOR_TOO_LOW: 'Health factor is lower than the liquidation threshold',
  INVALID_LTV: 'Invalid LTV',
  INSUFFICIENT_COLLATERAL: 'Insufficient collateral to borrow',
  BORROW_DISABLED: 'Borrowing is not enabled for this token',
  BORROW_CAP_EXCEEDED: 'Borrow cap is exceeded',
  DEBT_NOT_FOUND: 'User has no debt of this type',
  TOKEN_CANNOT_BE_COLLATERAL: 'This token cannot be used as collateral',
  INVALID_CATEGORY_ID: 'Invalid category ID',
  REQUIRE_ACCOUNT_WITH_SIGNER: 'This method requires a non read-only account',
  INVALID_ADDRESS: 'Invalid EVM address',
  INVALID_AMOUNT: 'Amount must be greater than 0',
  CHAIN_NOT_SUPPORTED: 'This chain is not supported'
}