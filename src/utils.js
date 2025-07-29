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
  AaveV3Ethereum, AaveV3Gnosis, AaveV3Linea, AaveV3Metis,
  AaveV3Optimism,
  AaveV3Polygon, AaveV3Scroll, AaveV3Soneium, AaveV3Sonic, AaveV3ZkSync
} from '@bgd-labs/aave-address-book'

const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

export function isBigIntInfinity (value) {
  return value === MAX_UINT256
}

export const AAVE_V3_POOL_ADDRESS_MAP = {
  [AaveV3Ethereum.CHAIN_ID]: AaveV3Ethereum.POOL,
  [AaveV3Arbitrum.CHAIN_ID]: AaveV3Arbitrum.POOL,
  [AaveV3Base.CHAIN_ID]: AaveV3Base.POOL,
  [AaveV3Optimism.CHAIN_ID]: AaveV3Optimism.POOL,
  [AaveV3Polygon.CHAIN_ID]: AaveV3Polygon.POOL,
  [AaveV3Avalanche.CHAIN_ID]: AaveV3Avalanche.POOL,
  [AaveV3BNB.CHAIN_ID]: AaveV3BNB.POOL,
  [AaveV3Celo.CHAIN_ID]: AaveV3Celo.POOL,
  [AaveV3Gnosis.CHAIN_ID]: AaveV3Gnosis.POOL,
  [AaveV3Linea.CHAIN_ID]: AaveV3Linea.POOL,
  [AaveV3Scroll.CHAIN_ID]: AaveV3Scroll.POOL,
  [AaveV3Soneium.CHAIN_ID]: AaveV3Soneium.POOL,
  [AaveV3Sonic.CHAIN_ID]: AaveV3Sonic.POOL,
  [AaveV3ZkSync.CHAIN_ID]: AaveV3ZkSync.POOL,
  [AaveV3Metis.CHAIN_ID]: AaveV3Metis.POOL
}