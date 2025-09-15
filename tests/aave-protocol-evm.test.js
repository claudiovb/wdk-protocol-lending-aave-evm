import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import { WalletAccountEvm } from '@wdk/wallet-evm'

import { WalletAccountEvmErc4337 } from '@wdk/wallet-evm-erc-4337'

import { IERC20_ABI, IPool_ABI } from '@bgd-labs/aave-address-book/abis'

import * as ethers from 'ethers'

import AAVE_V3_ADDRESS_MAP from '../src/aave-v3-address-map.js'

const { Contract } = ethers

const SEED = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const TOKEN = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

const tokenContract = new Contract(TOKEN, IERC20_ABI),
      poolContract = new Contract(AAVE_V3_ADDRESS_MAP[1].pool, IPool_ABI)

const getUserAccountDataMock = jest.fn()

const getReservesDataMock = jest.fn()

jest.unstable_mockModule('ethers', () => ({
  ...ethers,
  Contract: jest.fn().mockImplementation((target, abi, runner) => {
    const contract = new Contract(target, abi, runner)

    if (target === AAVE_V3_ADDRESS_MAP[1].pool) {
      contract.getUserAccountData = getUserAccountDataMock
    }

    if (target === AAVE_V3_ADDRESS_MAP[1].uiPoolDataProvider) {
      contract.getReservesData = getReservesDataMock
    }

    return contract
  }),
  JsonRpcProvider: jest.fn().mockImplementation(() => ({
    getNetwork: jest.fn().mockResolvedValue({ chainId: 1n })
  }))
}))

const { default: AaveProtocolEvm } = await import('../index.js')

describe('AaveProtocolEvm', () => {
  const ADDRESS = '0x405005C7c4422390F4B334F64Cf20E0b767131d0'

  let account,
      protocol

  beforeEach(() => {
    account = new WalletAccountEvm(SEED, "0'/0/0", {
      provider: 'https://dummy-rpc-url.com'
    })

    protocol = new AaveProtocolEvm(account)

    getReservesDataMock.mockResolvedValue([[{
      underlyingAsset: TOKEN,
      isPaused: false,
      isActive: true,
      isFrozen: false,
      borrowingEnabled: true
    }]])
  })

  describe('supply', () => {
    const APPROVE_TRANSACTION = {
      to: TOKEN,
      value: 0,
      data: tokenContract.interface.encodeFunctionData('approve', [poolContract.target, 100_000])
    }

    const SUPPLY_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('supply', [TOKEN, 100_000, ADDRESS, 0])
    }

    test('should successfully perform a supply operation', async () => {
      account.getTokenBalance = jest.fn().mockResolvedValueOnce(100_000n)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-approve-hash', fee: 12_345n })
        .mockResolvedValueOnce({ hash: 'dummy-supply-hash', fee: 67_890n })

      const result = await protocol.supply({ token: TOKEN, amount: 100_000 })

      expect(account.getTokenBalance).toHaveBeenCalledWith(TOKEN)

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith(APPROVE_TRANSACTION)

      expect(account.sendTransaction).toHaveBeenCalledWith(SUPPLY_TRANSACTION)

      expect(result).toEqual({
        approveHash: 'dummy-approve-hash',
        hash: 'dummy-supply-hash',
        fee: 80_235n
      })
    })

    test('should successfully perform a supply operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.getTokenBalance = jest.fn().mockResolvedValueOnce(100_000n)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-user-operation-hash', fee: 80_235n })

      const result = await protocol.supply({ token: TOKEN, amount: 100_000 })

      expect(account.getTokenBalance).toHaveBeenCalledWith(TOKEN)

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith([ APPROVE_TRANSACTION, SUPPLY_TRANSACTION ], undefined)

      expect(result).toEqual({
        hash: 'dummy-user-operation-hash',
        fee: 80_235n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.supply({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.supply({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'onBehalfOf' is not a valid a address", async () => {
      await expect(protocol.supply({ token: TOKEN, amount: 100_000, onBehalfOf: 'invalid-address' }))
        .rejects.toThrow("'onBehalfOf' must be a valid address (not zero address).")
    })
  })

  describe('quoteSupply', () => {
    const APPROVE_TRANSACTION = {
      to: TOKEN,
      value: 0,
      data: tokenContract.interface.encodeFunctionData('approve', [poolContract.target, 100_000])
    }

    const SUPPLY_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('supply', [TOKEN, 100_000, ADDRESS, 0])
    }

    test('should successfully quote a supply operation', async () => {
      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 12_345n })
        .mockResolvedValueOnce({ fee: 67_890n })

      const result = await protocol.quoteSupply({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(APPROVE_TRANSACTION)

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(SUPPLY_TRANSACTION)

      expect(result).toEqual({
        fee: 80_235n
      })
    })

    test('should successfully quote a supply operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 80_235n })

      const result = await protocol.quoteSupply({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith([ APPROVE_TRANSACTION, SUPPLY_TRANSACTION ], undefined)

      expect(result).toEqual({
        fee: 80_235n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.quoteSupply({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.quoteSupply({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'onBehalfOf' is not a valid a address", async () => {
      await expect(protocol.quoteSupply({ token: TOKEN, amount: 100_000, onBehalfOf: 'invalid-address' }))
        .rejects.toThrow("'onBehalfOf' must be a valid address (not zero address).")
    })
  })

  describe('withdraw', () => {
    const WITHDRAW_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('withdraw', [TOKEN, 100_000, ADDRESS])
    }

    test('should successfully perform a withdraw operation', async () => {
      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-withdraw-hash', fee: 67_890n })

      const result = await protocol.withdraw({ token: TOKEN, amount: 100_000 })

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith(WITHDRAW_TRANSACTION)

      expect(result).toEqual({
        hash: 'dummy-withdraw-hash',
        fee: 67_890n
      })
    })

    test('should successfully perform a withdraw operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-user-operation-hash', fee: 67_890n })

      const result = await protocol.withdraw({ token: TOKEN, amount: 100_000 })

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith(WITHDRAW_TRANSACTION, undefined)

      expect(result).toEqual({
        hash: 'dummy-user-operation-hash',
        fee: 67_890n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.withdraw({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.withdraw({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'to' is not a valid a address", async () => {
      await expect(protocol.withdraw({ token: TOKEN, amount: 100_000, to: 'invalid-address' }))
        .rejects.toThrow("'to' must be a valid address (not zero address).")
    })
  })

  describe('quoteWithdraw', () => {
    const WITHDRAW_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('withdraw', [TOKEN, 100_000, ADDRESS])
    }

    test('should successfully quote a withdraw operation', async () => {
      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 67_890n })

      const result = await protocol.quoteWithdraw({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(WITHDRAW_TRANSACTION)

      expect(result).toEqual({
        fee: 67_890n
      })
    })

    test('should successfully quote a withdraw operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 67_890n })

      const result = await protocol.quoteWithdraw({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(WITHDRAW_TRANSACTION, undefined)

      expect(result).toEqual({
        fee: 67_890n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.quoteWithdraw({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.quoteWithdraw({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'to' is not a valid a address", async () => {
      await expect(protocol.quoteWithdraw({ token: TOKEN, amount: 100_000, to: 'invalid-address' }))
        .rejects.toThrow("'to' must be a valid address (not zero address).")
    })
  })

  describe('borrow', () => {
    const BORROW_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('borrow', [TOKEN, 100_000, 2, 0, ADDRESS])
    }

    test('should successfully perform a borrow operation', async () => {
      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-borrow-hash', fee: 67_890n })

      const result = await protocol.borrow({ token: TOKEN, amount: 100_000 })

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith(BORROW_TRANSACTION)

      expect(result).toEqual({
        hash: 'dummy-borrow-hash',
        fee: 67_890n
      })
    })

    test('should successfully perform a borrow operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-user-operation-hash', fee: 67_890n })

      const result = await protocol.borrow({ token: TOKEN, amount: 100_000 })

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith(BORROW_TRANSACTION, undefined)

      expect(result).toEqual({
        hash: 'dummy-user-operation-hash',
        fee: 67_890n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.borrow({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.borrow({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'onBehalfOf' is not a valid a address", async () => {
      await expect(protocol.borrow({ token: TOKEN, amount: 100_000, onBehalfOf: 'invalid-address' }))
        .rejects.toThrow("'onBehalfOf' must be a valid address (not zero address).")
    })
  })

  describe('quoteBorrow', () => {
    const BORROW_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('borrow', [TOKEN, 100_000, 2, 0, ADDRESS])
    }

    test('should successfully quote a borrow operation', async () => {
      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 67_890n })

      const result = await protocol.quoteBorrow({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(BORROW_TRANSACTION)

      expect(result).toEqual({
        fee: 67_890n
      })
    })

    test('should successfully quote a borrow operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 67_890n })

      const result = await protocol.quoteBorrow({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(BORROW_TRANSACTION, undefined)

      expect(result).toEqual({
        fee: 67_890n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.quoteBorrow({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.quoteBorrow({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'onBehalfOf' is not a valid a address", async () => {
      await expect(protocol.quoteBorrow({ token: TOKEN, amount: 100_000, onBehalfOf: 'invalid-address' }))
        .rejects.toThrow("'onBehalfOf' must be a valid address (not zero address).")
    })
  })

  describe('repay', () => {
    const APPROVE_TRANSACTION = {
      to: TOKEN,
      value: 0,
      data: tokenContract.interface.encodeFunctionData('approve', [poolContract.target, 100_000])
    }

    const REPAY_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('repay', [TOKEN, 100_000, 2, ADDRESS])
    }

    test('should successfully perform a repay operation', async () => {
      account.getTokenBalance = jest.fn().mockResolvedValueOnce(100_000n)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-approve-hash', fee: 12_345n })
        .mockResolvedValueOnce({ hash: 'dummy-repay-hash', fee: 67_890n })

      const result = await protocol.repay({ token: TOKEN, amount: 100_000 })

      expect(account.getTokenBalance).toHaveBeenCalledWith(TOKEN)

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith(APPROVE_TRANSACTION)

      expect(account.sendTransaction).toHaveBeenCalledWith(REPAY_TRANSACTION)

      expect(result).toEqual({
        approveHash: 'dummy-approve-hash',
        hash: 'dummy-repay-hash',
        fee: 80_235n
      })
    })

    test('should successfully perform a repay operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.getTokenBalance = jest.fn().mockResolvedValueOnce(100_000n)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-user-operation-hash', fee: 80_235n })

      const result = await protocol.repay({ token: TOKEN, amount: 100_000 })

      expect(account.getTokenBalance).toHaveBeenCalledWith(TOKEN)

      expect(getReservesDataMock).toHaveBeenCalledWith(AAVE_V3_ADDRESS_MAP[1].poolAddressesProvider)

      expect(account.sendTransaction).toHaveBeenCalledWith([ APPROVE_TRANSACTION, REPAY_TRANSACTION ], undefined)

      expect(result).toEqual({
        hash: 'dummy-user-operation-hash',
        fee: 80_235n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.repay({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.repay({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'onBehalfOf' is not a valid a address", async () => {
      await expect(protocol.repay({ token: TOKEN, amount: 100_000, onBehalfOf: 'invalid-address' }))
        .rejects.toThrow("'onBehalfOf' must be a valid address (not zero address).")
    })
  })

  describe('quoteRepay', () => {
    const APPROVE_TRANSACTION = {
      to: TOKEN,
      value: 0,
      data: tokenContract.interface.encodeFunctionData('approve', [poolContract.target, 100_000])
    }

    const REPAY_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('repay', [TOKEN, 100_000, 2, ADDRESS])
    }

    test('should successfully quote a repay operation', async () => {
      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 12_345n })
        .mockResolvedValueOnce({ fee: 67_890n })

      const result = await protocol.quoteRepay({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(APPROVE_TRANSACTION)

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(REPAY_TRANSACTION)

      expect(result).toEqual({
        fee: 80_235n
      })
    })

    test('should successfully quote a repay operation (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.getAddress = jest.fn().mockResolvedValue(ADDRESS)

      account.quoteSendTransaction = jest.fn()
        .mockResolvedValueOnce({ fee: 80_235n })

      const result = await protocol.quoteRepay({ token: TOKEN, amount: 100_000 })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith([ APPROVE_TRANSACTION, REPAY_TRANSACTION ], undefined)

      expect(result).toEqual({
        fee: 80_235n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.quoteRepay({ token: 'invalid-token-address', amount: 100_000 }))
        .rejects.toThrow("'token' must be a valid address.")
    })

    test("should throw if 'amount' is less of equal to zero", async () => {
      await expect(protocol.quoteRepay({ token: TOKEN, amount: -1 }))
        .rejects.toThrow("'amount' should be greater than zero.")
    })

    test("should throw if 'onBehalfOf' is not a valid a address", async () => {
      await expect(protocol.quoteRepay({ token: TOKEN, amount: 100_000, onBehalfOf: 'invalid-address' }))
        .rejects.toThrow("'onBehalfOf' must be a valid address (not zero address).")
    })
  })

  describe('setUseReserveAsCollateral', () => {
    const SET_USE_RESERVE_AS_COLLATERAL_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('setUserUseReserveAsCollateral', [TOKEN, true])
    }

    test('should successfully set as a collateral', async () => {
      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-set-use-reserve-as-collateral-hash', fee: 67_890n })

      const transaction = await protocol.setUseReserveAsCollateral(TOKEN, true)

      expect(account.sendTransaction).toHaveBeenCalledWith(SET_USE_RESERVE_AS_COLLATERAL_TRANSACTION)

      expect(transaction).toEqual({
        hash: 'dummy-set-use-reserve-as-collateral-hash',
        fee: 67_890n
      })
    })

    test('should successfully set as a collateral (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-user-operation-hash', fee: 67_890n })

      const transaction = await protocol.setUseReserveAsCollateral(TOKEN, true)

      expect(account.sendTransaction).toHaveBeenCalledWith(SET_USE_RESERVE_AS_COLLATERAL_TRANSACTION, undefined)

      expect(transaction).toEqual({
        hash: 'dummy-user-operation-hash',
        fee: 67_890n
      })
    })

    test("should throw if 'token' is not a valid address", async () => {
      await expect(protocol.setUseReserveAsCollateral('invalid-token-address', true))
        .rejects.toThrow("'token' must be a valid address.")
    })
  })

  describe('setUserEMode', () => {
    const SET_USER_E_MODE_TRANSACTION = {
      to: poolContract.target,
      value: 0,
      data: poolContract.interface.encodeFunctionData('setUserEMode', [128])
    }

    test('should successfully set efficiency mode', async () => {
      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-set-user-e-mode-hash', fee: 67_890n })

      const transaction = await protocol.setUserEMode(128)

      expect(account.sendTransaction).toHaveBeenCalledWith(SET_USER_E_MODE_TRANSACTION)

      expect(transaction).toEqual({
        hash: 'dummy-set-user-e-mode-hash',
        fee: 67_890n
      })
    })

    test('should successfully set efficiency mode (erc-4337)', async () => {
      const account = new WalletAccountEvmErc4337(SEED, "0'/0/0", {
        chainId: 1,
        provider: 'https://dummy-rpc-url.com'
      })

      const protocol = new AaveProtocolEvm(account)

      account.sendTransaction = jest.fn()
        .mockResolvedValueOnce({ hash: 'dummy-user-operation-hash', fee: 67_890n })

      const transaction = await protocol.setUserEMode(128)

      expect(account.sendTransaction).toHaveBeenCalledWith(SET_USER_E_MODE_TRANSACTION, undefined)

      expect(transaction).toEqual({
        hash: 'dummy-user-operation-hash',
        fee: 67_890n
      })
    })

    test("should throw if 'categoryId' is not a valid category id", async () => {
      await expect(protocol.setUserEMode(1_024))
        .rejects.toThrow("'categoryId' must be a valid category id.")
    })
  })

  describe('getAccountData', () => {
    test('should return the correct account data', async () => {
      getUserAccountDataMock.mockResolvedValueOnce([0n, 1n, 2n, 3n, 4n, 5n])

      const accountData = await protocol.getAccountData()

      expect(getUserAccountDataMock).toHaveBeenCalledWith(ADDRESS)

      expect(accountData).toEqual({
        totalCollateralBase: 0n,
        totalDebtBase: 1n,
        availableBorrowsBase: 2n,
        currentLiquidationThreshold: 3n,
        ltv: 4n,
        healthFactor: 5n
      })
    })

    test("should throw if 'address' is not a valid address", async () => {
      await expect(protocol.getAccountData('invalid-address'))
        .rejects.toThrow("'account' must be a valid address (not zero address).")
    })
  })
})
