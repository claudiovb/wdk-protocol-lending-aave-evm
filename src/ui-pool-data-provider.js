// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict'

/** @internal */
export default [
  {
    type: 'function',
    name: 'getReservesData',
    stateMutability: 'view',
    constant: false,
    inputs: [
      {
        type: 'address',
        name: 'provider',
        simpleType: 'address'
      }
    ],
    outputs: [
      {
        type: 'tuple[]',
        name: '',
        simpleType: 'slice',
        nestedType: {
          type: 'tuple'
        },
        components: [
          {
            type: 'address',
            name: 'underlyingAsset',
            simpleType: 'address'
          },
          {
            type: 'string',
            name: 'name',
            simpleType: 'string'
          },
          {
            type: 'string',
            name: 'symbol',
            simpleType: 'string'
          },
          {
            type: 'uint256',
            name: 'decimals',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'baseLTVasCollateral',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'reserveLiquidationThreshold',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'reserveLiquidationBonus',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'reserveFactor',
            simpleType: 'uint'
          },
          {
            type: 'bool',
            name: 'usageAsCollateralEnabled',
            simpleType: 'bool'
          },
          {
            type: 'bool',
            name: 'borrowingEnabled',
            simpleType: 'bool'
          },
          {
            type: 'bool',
            name: 'isActive',
            simpleType: 'bool'
          },
          {
            type: 'bool',
            name: 'isFrozen',
            simpleType: 'bool'
          },
          {
            type: 'uint128',
            name: 'liquidityIndex',
            simpleType: 'uint'
          },
          {
            type: 'uint128',
            name: 'variableBorrowIndex',
            simpleType: 'uint'
          },
          {
            type: 'uint128',
            name: 'liquidityRate',
            simpleType: 'uint'
          },
          {
            type: 'uint128',
            name: 'variableBorrowRate',
            simpleType: 'uint'
          },
          {
            type: 'uint40',
            name: 'lastUpdateTimestamp',
            simpleType: 'uint'
          },
          {
            type: 'address',
            name: 'aTokenAddress',
            simpleType: 'address'
          },
          {
            type: 'address',
            name: 'variableDebtTokenAddress',
            simpleType: 'address'
          },
          {
            type: 'address',
            name: 'interestRateStrategyAddress',
            simpleType: 'address'
          },
          {
            type: 'uint256',
            name: 'availableLiquidity',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'totalScaledVariableDebt',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'priceInMarketReferenceCurrency',
            simpleType: 'uint'
          },
          {
            type: 'address',
            name: 'priceOracle',
            simpleType: 'address'
          },
          {
            type: 'uint256',
            name: 'variableRateSlope1',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'variableRateSlope2',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'baseVariableBorrowRate',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'optimalUsageRatio',
            simpleType: 'uint'
          },
          {
            type: 'bool',
            name: 'isPaused',
            simpleType: 'bool'
          },
          {
            type: 'bool',
            name: 'isSiloedBorrowing',
            simpleType: 'bool'
          },
          {
            type: 'uint128',
            name: 'accruedToTreasury',
            simpleType: 'uint'
          },
          {
            type: 'uint128',
            name: 'unbacked',
            simpleType: 'uint'
          },
          {
            type: 'uint128',
            name: 'isolationModeTotalDebt',
            simpleType: 'uint'
          },
          {
            type: 'bool',
            name: 'flashLoanEnabled',
            simpleType: 'bool'
          },
          {
            type: 'uint256',
            name: 'debtCeiling',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'debtCeilingDecimals',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'borrowCap',
            simpleType: 'uint'
          },
          {
            type: 'uint256',
            name: 'supplyCap',
            simpleType: 'uint'
          },
          {
            type: 'bool',
            name: 'borrowableInIsolation',
            simpleType: 'bool'
          },
          {
            type: 'bool',
            name: 'virtualAccActive',
            simpleType: 'bool'
          },
          {
            type: 'uint128',
            name: 'virtualUnderlyingBalance',
            simpleType: 'uint'
          }
        ]
      },
      {
        type: 'tuple',
        name: '',
        simpleType: 'tuple',
        components: [
          {
            type: 'uint256',
            name: 'marketReferenceCurrencyUnit',
            simpleType: 'uint'
          },
          {
            type: 'int256',
            name: 'marketReferenceCurrencyPriceInUsd',
            simpleType: 'int'
          },
          {
            type: 'int256',
            name: 'networkBaseTokenPriceInUsd',
            simpleType: 'int'
          },
          {
            type: 'uint8',
            name: 'networkBaseTokenPriceDecimals',
            simpleType: 'uint'
          }
        ]
      }
    ],
    id: '0xec489c21'
  }
]
