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

/** @typedef {import('@wdk/wallet').TransactionResult} TransactionResult */

/** @typedef {import('@wdk/wallet/protocols').BorrowOptions} BorrowOptions */
/** @typedef {import('@wdk/wallet/protocols').BorrowResult} BorrowResult */
/** @typedef {import('@wdk/wallet/protocols').SupplyOptions} SupplyOptions */
/** @typedef {import('@wdk/wallet/protocols').WithdrawOptions} WithdrawOptions */
/** @typedef {import('@wdk/wallet/protocols').WithdrawResult} WithdrawResult */
/** @typedef {import('@wdk/wallet/protocols').RepayOptions} RepayOptions */

/** @typedef {import('./src/aave-protocol-evm.js').SupplyResult} SupplyResult */
/** @typedef {import('./src/aave-protocol-evm.js').RepayResult} RepayResult */
/** @typedef {import('./src/aave-protocol-evm.js').AccountData} AccountData */

export { default } from './src/aave-protocol-evm.js'
