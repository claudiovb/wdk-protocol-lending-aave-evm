# @tetherto/wdk-protocol-lending-aave-evm

Note: This package is in beta. Please test in a dev setup first.

A simple way to use Aave V3 lending with EVM wallet accounts. You can add and take out tokens, borrow, pay back, and read your account data. It works with normal EVM accounts and ERC-4337 smart accounts.

## 🔍 About WDK

This is part of WDK (Wallet Development Kit). WDK helps you build safe, non‑custody wallets. Read more at https://docs.wallet.tether.io.

## 🌟 Features

- Supply (add tokens to the pool)
- Withdraw (take tokens from the pool)
- Borrow
- Repay
- Get account data (collateral, debt, health)
- Quote costs before you send
- Works with normal EVM and ERC‑4337 accounts

## ⬇️ Installation

```bash
npm install @tetherto/wdk-protocol-lending-aave-evm
```

## 🚀 Quick Start

### Use with a normal EVM account

```javascript
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm'
import { WalletAccountEvm } from '@tetherto/wdk-wallet-evm'

const seed = 'your twelve word seed goes here'

// Create account at path m/44'/60'/0'/0/0
const account = new WalletAccountEvm(seed, "0'/0/0", {
  provider: 'https://ethereum-rpc.publicnode.com'
})

// Create protocol
const aave = new AaveProtocolEvm(account)

// Supply
await aave.supply({ token: 'TOKEN_ADDRESS', amount: 1000000n })

// Withdraw
await aave.withdraw({ token: 'TOKEN_ADDRESS', amount: 1000000n })

// Borrow
await aave.borrow({ token: 'TOKEN_ADDRESS', amount: 1000000n })

// Repay
await aave.repay({ token: 'TOKEN_ADDRESS', amount: 1000000n })

// Get account data
const data = await aave.getAccountData()
```

### Get quotes first

```javascript
// Supply quote
const supplyQuote = await aave.quoteSupply({ token: 'TOKEN_ADDRESS', amount: 1000000n })

// Withdraw quote
const withdrawQuote = await aave.quoteWithdraw({ token: 'TOKEN_ADDRESS', amount: 1000000n })

// Borrow quote
const borrowQuote = await aave.quoteBorrow({ token: 'TOKEN_ADDRESS', amount: 1000000n })

// Repay quote
const repayQuote = await aave.quoteRepay({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

### Use with an ERC‑4337 smart account

```javascript
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm'
import { WalletAccountEvmErc4337 } from '@tetherto/wdk-wallet-evm-erc-4337'

const smart = new WalletAccountEvmErc4337(seed, "0'/0/0", {
  provider: 'https://arb1.arbitrum.io/rpc',
  bundlerUrl: 'YOUR_BUNDLER',
  paymasterUrl: 'YOUR_PAYMASTER'
})

const aave4337 = new AaveProtocolEvm(smart)

// Supply with smart account
const result = await aave4337.supply({ token: 'TOKEN_ADDRESS', amount: 1000000n }, {
  paymasterToken: 'USDT'
})
```

## 📚 API Reference

### AaveProtocolEvm

Main class for Aave V3 lending on EVM.

#### Constructor

```javascript
new AaveProtocolEvm(account)
```

Parameters:
- `account` (WalletAccountEvm | WalletAccountEvmErc4337 | WalletAccountReadOnlyEvm | WalletAccountReadOnlyEvmErc4337)

Example:

```javascript
const aave = new AaveProtocolEvm(account)
```

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `supply(options, config?)` | Add tokens to the pool | `Promise<{hash: string, fee: bigint, ...}>` |
| `quoteSupply(options, config?)` | Get cost to add tokens | `Promise<{fee: bigint}>` |
| `withdraw(options, config?)` | Take tokens from the pool | `Promise<{hash: string, fee: bigint}>` |
| `quoteWithdraw(options, config?)` | Get cost to take tokens | `Promise<{fee: bigint}>` |
| `borrow(options, config?)` | Borrow tokens from the pool | `Promise<{hash: string, fee: bigint}>` |
| `quoteBorrow(options, config?)` | Get cost to borrow | `Promise<{fee: bigint}>` |
| `repay(options, config?)` | Pay back what you borrowed | `Promise<{hash: string, fee: bigint}>` |
| `quoteRepay(options, config?)` | Get cost to pay back | `Promise<{fee: bigint}>` |
| `setUseReserveAsCollateral(token, use, config?)` | Turn use as collateral on or off | `Promise<{hash: string, fee: bigint}>` |
| `setUserEMode(categoryId, config?)` | Set eMode for the user | `Promise<{hash: string, fee: bigint}>` |
| `getAccountData(account?)` | Read account stats | `Promise<{...}>` |

#### `supply(options, config?)`
Add tokens to the pool.

Options:
- `token` (string): token address
- `amount` (bigint): amount in base unit
- `onBehalfOf` (string, optional)

Example:

```javascript
const result = await aave.supply({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

Notes:
- Normal account: may return `approveHash` and `resetAllowanceHash` (for USDT on main net).
- ERC‑4337 account: approve steps are bundled; only `hash` and `fee` are returned.

#### `quoteSupply(options, config?)`
Get the fee to add tokens.

```javascript
const quote = await aave.quoteSupply({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

#### `withdraw(options, config?)`
Take tokens from the pool.

Options:
- `token` (string)
- `amount` (bigint)
- `to` (string, optional)

```javascript
const tx = await aave.withdraw({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

#### `quoteWithdraw(options, config?)`
Get the fee to take tokens.

```javascript
const quote = await aave.quoteWithdraw({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

#### `borrow(options, config?)`
Borrow tokens from the pool.

Options:
- `token` (string)
- `amount` (bigint)
- `onBehalfOf` (string, optional)

```javascript
const tx = await aave.borrow({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

#### `quoteBorrow(options, config?)`
Get the fee to borrow.

```javascript
const quote = await aave.quoteBorrow({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

#### `repay(options, config?)`
Pay back what you borrowed.

Options:
- `token` (string)
- `amount` (bigint)
- `onBehalfOf` (string, optional)

```javascript
const tx = await aave.repay({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

Notes:
- Normal account: may return `approveHash` and `resetAllowanceHash` (USDT on main net).
- ERC‑4337 account: approve steps are bundled; only `hash` and `fee` are returned.

#### `quoteRepay(options, config?)`
Get the fee to pay back.

```javascript
const quote = await aave.quoteRepay({ token: 'TOKEN_ADDRESS', amount: 1000000n })
```

#### `setUseReserveAsCollateral(token, use, config?)`
Turn use as collateral on or off for a token.

```javascript
const tx = await aave.setUseReserveAsCollateral('TOKEN_ADDRESS', true)
```

#### `setUserEMode(categoryId, config?)`
Set eMode for the user.

```javascript
const tx = await aave.setUserEMode(1)
```

#### `getAccountData(account?)`
Read account stats like total collateral, debt, and health.

```javascript
const data = await aave.getAccountData()
```

Returns:
```javascript
{
  totalCollateralBase: bigint,
  totalDebtBase: bigint,
  availableBorrowsBase: bigint,
  currentLiquidationThreshold: bigint,
  ltv: bigint,
  healthFactor: bigint
}
```

#### Config (ERC‑4337 only)
- `paymasterToken` (string): token to pay gas.

#### Rules
- `token` must be a valid address (not zero address).
- `amount` must be greater than 0.
- `onBehalfOf` and `to` (if set) must be valid and not zero address.
- A provider is needed to read and send txs.
- For USDT on main net, allowance may be set to 0 first, then set again.

Notes:
- `amount` is in the token base unit (use BigInt like `1000000n`).
- For USDT on the main net, the code may first set the allowance to `0` and then set it again.

## 🌐 Supported Networks

Works on Aave V3 chains. You need a working RPC and the right token address.

Supported chains:
- Ethereum
- Arbitrum
- Base
- Optimism
- Polygon
- Avalanche
- BNB
- Celo
- Gnosis
- Linea
- Scroll
- Soneium
- Sonic
- ZkSync
- Metis

## 🔒 Security Considerations

- Keep your seed safe. Do not share it.
- Check token and address values before you send.
- Get a quote first to see cost.
- Make sure the pool for the token is active and not frozen.

## 🛠️ Development

### Building

```bash
# Install dependencies
npm install

# Build TypeScript definitions
npm run build:types

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 📜 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🆘 Support

For support, please open an issue on the GitHub repository.