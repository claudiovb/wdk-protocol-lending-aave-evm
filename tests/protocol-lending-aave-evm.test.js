import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { WalletAccountEvm } from '@wdk/wdk-wallet-evm'

import { AAVE_V3_ADDRESS_MAP, AAVE_V3_ERROR } from '../src/constants.js'

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

// Ethereum
const DUMMY_PROVIDER = 'https://eth-mainnet.public.blastapi.io'
const DUMMY_CHAIN_ID = 1
const DUMMY_ADDRESS_MAP = AAVE_V3_ADDRESS_MAP[DUMMY_CHAIN_ID]
const DUMMY_POOL_ADDRESS = DUMMY_ADDRESS_MAP.pool
const DUMMY_USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const DUMMY_ON_BEHALF_OF_ACCOUNT = '0xc0ffee254729296a45a3885639AC7E10F9d54979'

const DUMMY_TX_RESULT = {
  hash: 'dummy-hash',
  fee: 0
}

const getUserAccountDataMock = jest.fn()
const getReservesDataMock = jest.fn()
const scaledTotalSupplyMock = jest.fn()
const scaledBalanceOfMock = jest.fn()
const getAssetPriceMock = jest.fn()

jest.unstable_mockModule('ethers', async () => {
  const originalEthers = await jest.requireActual('ethers')

  class MockedContract extends originalEthers.Contract {
    getUserAccountData = getUserAccountDataMock
    getReservesData = getReservesDataMock
    scaledTotalSupply = scaledTotalSupplyMock
    scaledBalanceOf = scaledBalanceOfMock
    getAssetPrice = getAssetPriceMock
  }

  return {
    ...originalEthers,
    Contract: MockedContract
  }
})

const { default: AaveProtocolEvm } = await import('../index.js')

describe('AaveProtocolEvm', () => {
  let aaveProtocolEvm, account

  beforeEach(() => {
    jest.clearAllMocks()

    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: DUMMY_PROVIDER
    })
    aaveProtocolEvm = new AaveProtocolEvm(account)
  })

  describe('getAccountData', () => {
    test('should return account data', async () => {
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 0, 0])

      const result = await aaveProtocolEvm.getAccountData()

      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(result).toEqual({
        totalCollateralBase: 0,
        totalDebtBase: 0,
        availableBorrowsBase: 0,
        currentLiquidationThreshold: 0,
        ltv: 0,
        healthFactor: 0
      })
    })

    test('should throw if address is invalid', async () => {
      await expect(aaveProtocolEvm.getAccountData('invalid-address')).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw error when chain is not supported', async () => {
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: -99 })

      await expect(aaveProtocolEvm.getAccountData()).rejects.toThrow(AAVE_V3_ERROR.CHAIN_NOT_SUPPORTED)
    })
  })

  describe('setUseReserveAsCollateral', () => {
    test('should successfully enable supplied asset to be used as collateral', async () => {
      const DUMMY_TX = {
        to: DUMMY_POOL_ADDRESS,
        data: '0x5a3b74b9000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000001',
        value: 0
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        baseLTVasCollateral: 100
      }]])

      const { hash, fee } = await aaveProtocolEvm.setUseReserveAsCollateral(DUMMY_USDT_ADDRESS, true)

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should successfully disable supplied asset to be used as collateral', async () => {
      const DUMMY_TX = {
        data: '0x5a3b74b9000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000000',
        to: DUMMY_POOL_ADDRESS,
        value: 0
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(DUMMY_ADDRESS_MAP)
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        baseLTVasCollateral: 100
      }]])

      const { hash, fee } = await aaveProtocolEvm.setUseReserveAsCollateral(DUMMY_USDT_ADDRESS, false)

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw if token is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.setUseReserveAsCollateral(
        'invalid-address',
        true
      )).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if token reserve is not found', async () => {
      getReservesDataMock.mockResolvedValue([[]])

      await expect(aaveProtocolEvm.setUseReserveAsCollateral(
        DUMMY_USDT_ADDRESS,
        true
      )).rejects.toThrow(AAVE_V3_ERROR.CANNOT_FIND_TOKEN_RESERVE)
      expect(getReservesDataMock).toHaveBeenCalled()
    })

    test('should throw if token cannot be used as collateral', async () => {
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        baseLTVasCollateral: 0
      }]])

      await expect(aaveProtocolEvm.setUseReserveAsCollateral(
        DUMMY_USDT_ADDRESS,
        true
      )).rejects.toThrow(AAVE_V3_ERROR.TOKEN_CANNOT_BE_COLLATERAL)
      expect(getReservesDataMock).toHaveBeenCalled()
    })
  })

  describe('supply', () => {
    test('should successfully supply an ERC-20 token into Aave protocol', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0x617ba037000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000989680000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d00000000000000000000000000000000000000000000000000000000000000000',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300_000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        accruedToTreasury: 1n,
        liquidityIndex: 0n,
        supplyCap: BigInt(DUMMY_AMOUNT * 1000),
        decimals: 0n
      }]])
      scaledTotalSupplyMock.mockResolvedValue(1n)


      const { hash, fee } = await aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(scaledTotalSupplyMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw if has insufficient fund to supply', async () => {
      account.getTokenBalance = jest.fn().mockResolvedValue(0)

      await expect(aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INSUFFICIENT_FUND)
    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.supply({
        token: 'invalid-address',
        amount: 10_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: -1
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('on behalf of an address, should successfully supply asset into Aave protocol', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0x617ba037000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000989680000000000000000000000000c0ffee254729296a45a3885639ac7e10f9d549790000000000000000000000000000000000000000000000000000000000000000',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        accruedToTreasury: 1n,
        liquidityIndex: 0n,
        supplyCap: BigInt(DUMMY_AMOUNT * 1000),
        decimals: 0n
      }]])
      scaledTotalSupplyMock.mockResolvedValue(1n)


      const { hash, fee } = await aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
        onBehalfOf: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(scaledTotalSupplyMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw if supply amount exceed supply cap', async () => {
      const DUMMY_AMOUNT = 100_000_000
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        accruedToTreasury: 1n,
        liquidityIndex: 1n,
        decimals: 0n,
        supplyCap: 0n,
      }]])
      scaledTotalSupplyMock.mockResolvedValue(9999999999999999999999999999999n)

      await expect(aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
      })).rejects.toThrow(AAVE_V3_ERROR.SUPPLY_CAP_EXCEEDED)
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(scaledTotalSupplyMock).toHaveBeenCalled()
    })

    test('should throw if token reserve is paused', async () => {
      const DUMMY_AMOUNT = 100_000_000
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: true
      }]])

      await expect(aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_PAUSED)
      expect(getReservesDataMock).toHaveBeenCalled()
    })

    test('should throw if token reserve is frozen', async () => {
      const DUMMY_AMOUNT = 100_000_000
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isFrozen: true
      }]])

      await expect(aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_FROZEN)
      expect(getReservesDataMock).toHaveBeenCalled()
    })

    test('should throw if token reserve is inactive', async () => {
      const DUMMY_AMOUNT = 100_000_000
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isActive: false
      }]])

      await expect(aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_INACTIVE)
      expect(getReservesDataMock).toHaveBeenCalled()
    })
  })

  describe('quoteSupply', () => {
    test('should successfully quote a supply transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 1 })
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      const DUMMY_TX = {
        data: '0x617ba037000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000989680000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d00000000000000000000000000000000000000000000000000000000000000000',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }

      const { fee } = await aaveProtocolEvm.quoteSupply({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000
      })

      expect(account.quoteSendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(fee).toBe(2)
    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteSupply({
        token: 'invalid-address',
        amount: 10_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.quoteSupply({
        token: DUMMY_USDT_ADDRESS,
        amount: -1
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteSupply({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })
  })

  describe('withdraw', () => {
    test('should successfully withdraw asset from the reserve', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0x69328dec000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000989680000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        accruedToTreasury: 1n,
        liquidityIndex: 1n,
        decimals: 0n,
        baseLTVasCollateral: 1n
      }]])
      scaledBalanceOfMock.mockResolvedValue(9999999999999999999999999999999999999n)
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 1e18, Infinity])

      const { hash, fee } = await aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(scaledBalanceOfMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw when not enough deposit balance to withdraw', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      scaledBalanceOfMock.mockResolvedValue(1n)
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        baseLTVasCollateral: 0n,
        liquidityIndex: 1n
      }]])

      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.INSUFFICIENT_BALANCE_TO_WITHDRAW) 
    })

    test('should throw when health factor too low', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        accruedToTreasury: 1n,
        liquidityIndex: 1n,
        decimals: 0n
      }]])
      scaledBalanceOfMock.mockResolvedValue(9999999999999999999999999999999999999n)
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 1e18, 0])

      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.HEALTH_FACTOR_TOO_LOW) 
    })

    test('should throw if ltv is invalid', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        accruedToTreasury: 1n,
        liquidityIndex: 1n,
        decimals: 0n,
        baseLTVasCollateral: 0n
      }]])
      scaledBalanceOfMock.mockResolvedValue(9999999999999999999999999999999999999n)
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 0, Infinity])

      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_LTV) 
    })

    test('should throw if token reserve is paused', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: true
      }]])

      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_PAUSED) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if token reserve is frozen', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isFrozen: true
      }]])

      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_FROZEN) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if token reserve is inactive', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isActive: false
      }]])

      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_INACTIVE) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if toAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000,
        to: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if token is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.withdraw({
        token: 'invalid-address',
        amount: 10_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should successfully withdraw asset to a beneficiary', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0x69328dec000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000989680000000000000000000000000c0ffee254729296a45a3885639ac7e10f9d54979',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        accruedToTreasury: 1n,
        liquidityIndex: 1n,
        decimals: 0n,
        baseLTVasCollateral: 1n
      }]])
      scaledBalanceOfMock.mockResolvedValue(9999999999999999999999999999999999999n)
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 1e18, Infinity])

      const { hash, fee } = await aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000,
        to: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(scaledBalanceOfMock).toHaveBeenCalled()
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })
  })

  describe('quoteWithdraw', () => {
    test('should successfully quote withdraw transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 0 })
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      const DUMMY_TX = {
        data: '0x69328dec000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000989680000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000,
      }

      const { fee } = await aaveProtocolEvm.quoteWithdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000
      })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(fee).toBe(0)
    })

    test('should throw if toAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteWithdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000,
        to: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if token is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteWithdraw({
        token: 'invalid-address',
        amount: 10_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.quoteWithdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })
  })

  describe('borrow', () => {
    test('with sufficient collateral, should successfully borrow asset', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0xa415bcad000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000000000000000000000000000000000000098968000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getAssetPriceMock.mockResolvedValue(1n)
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        borrowingEnabled: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        variableBorrowIndex: 1n,
        totalScaledVariableDebt: 1n,
        borrowCap: 999999999999999999n,
        decimals: 0n
      }]])

      const { hash, fee } = await aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('with insufficient collateral, should throw when borrow asset', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getAssetPriceMock.mockResolvedValue(1n)
      getUserAccountDataMock.mockResolvedValue([9, 999999999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        borrowingEnabled: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        variableBorrowIndex: 1n,
        totalScaledVariableDebt: 1n,
        borrowCap: 999999999999999999n,
        decimals: 0n
      }]])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.INSUFFICIENT_COLLATERAL)

      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(getAssetPriceMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if ltv is invalid', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 0, Infinity])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_LTV)

      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if collateral base is equal to 0', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 999999999999999, 0])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.INSUFFICIENT_COLLATERAL)

      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if health factor is too low', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([99999999999, 0, 0, 0, 999999999999999, 0])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.HEALTH_FACTOR_TOO_LOW)

      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if token reserve is paused', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: true
      }]])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_PAUSED) 
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if token reserve is frozen', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isFrozen: true
      }]])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_FROZEN) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if token reserve is inactive', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isActive: false
      }]])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_INACTIVE) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if borrowing is disabled', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        borrowingEnabled: false
      }]])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.BORROW_DISABLED) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if borrowing is disabled', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        borrowingEnabled: false
      }]])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.BORROW_DISABLED) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if borrow cap is exceeded', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        borrowingEnabled: true,
        borrowCap: 0n,
        totalScaledVariableDebt: 1n,
        variableBorrowIndex: 1n,
        decimals: 0n
      }]])

      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.BORROW_CAP_EXCEEDED) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.borrow({
        token: 'invalid-address',
        amount: 1_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('on behalf of an address with sufficient collateral, should successfully borrow asset', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0xa415bcad000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000000000000000000000000000000000000098968000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c0ffee254729296a45a3885639ac7e10f9d54979',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getAssetPriceMock.mockResolvedValue(1n)
      getUserAccountDataMock.mockResolvedValue([999999999, 999999999, 0, 0, 1e18, Infinity])
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isFrozen: false,
        isActive: true,
        borrowingEnabled: true,
        aTokenAddress: DUMMY_USDT_ADDRESS,
        variableBorrowIndex: 1n,
        totalScaledVariableDebt: 1n,
        borrowCap: 999999999999999999n,
        decimals: 0n
      }]])

      const { hash, fee } = await aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
        onBehalfOf: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(getUserAccountDataMock).toHaveBeenCalled()
      expect(getAssetPriceMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })
  })

  describe('quoteBorrow', () => {
    test('should successfully quote a borrow transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 0 })
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      const DUMMY_TX = {
        data: '0xa415bcad000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }

      const { fee } = await aaveProtocolEvm.quoteBorrow({
        token: DUMMY_USDT_ADDRESS,
        amount: 1_000_000
      })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(fee).toBe(0)
    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteBorrow({
        token: 'invalid-address',
        amount: 1_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.quoteBorrow({
        token: DUMMY_USDT_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteBorrow({
        token: DUMMY_USDT_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })
  })

  describe('repay', () => {
    test('should successfully repay for a debt position', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0x573ade81000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000009896800000000000000000000000000000000000000000000000000000000000000002000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      scaledBalanceOfMock.mockResolvedValue(99n ** 18n)
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        variableDebtTokenAddress: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isActive: true,
        variableBorrowIndex: 1n ** 18n
      }]])

      const { hash, fee } = await aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(aaveProtocolEvm._account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(scaledBalanceOfMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should successfully repay in full for a debt position', async () => {
      const DUMMY_TX = {
        data: '0x573ade81000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec77fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      scaledBalanceOfMock.mockResolvedValue(99n ** 18n)
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        variableDebtTokenAddress: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isActive: true,
        variableBorrowIndex: 1n ** 18n
      }]])

      const { hash, fee } = await aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: Infinity
      })

      expect(aaveProtocolEvm._account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(scaledBalanceOfMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('on behalf of an address, should successfully repay for a debt position', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0x573ade81000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000009896800000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c0ffee254729296a45a3885639ac7e10f9d54979',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      scaledBalanceOfMock.mockResolvedValue(99n ** 18n)
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        variableDebtTokenAddress: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isActive: true,
        variableBorrowIndex: 1n ** 18n
      }]])

      const { hash, fee } = await aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
        onBehalfOf: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(aaveProtocolEvm._account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(scaledBalanceOfMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('on behalf of an address, should successfully repay in full for a debt position', async () => {
      const DUMMY_TX = {
        data: '0x573ade81000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000031bdabc50000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c0ffee254729296a45a3885639ac7e10f9d54979',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      scaledBalanceOfMock.mockResolvedValue(99n ** 18n)
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        variableDebtTokenAddress: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isActive: true,
        variableBorrowIndex: 1n ** 18n
      }]])

      const { hash, fee } = await aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: Infinity,
        onBehalfOf: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(aaveProtocolEvm._account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(scaledBalanceOfMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw if token reserve is paused', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isPaused: true
      }]])

      await expect(aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_PAUSED) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw if token reserve is inactive', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        isActive: false
      }]])

      await expect(aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.RESERVE_INACTIVE) 
      expect(getReservesDataMock).toHaveBeenCalled()
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
    })

    test('should throw error when there is no debt position', async () => {
      const DUMMY_AMOUNT = 10_000_000
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      scaledBalanceOfMock.mockResolvedValue(0n)
      getReservesDataMock.mockResolvedValue([[{
        underlyingAsset: DUMMY_USDT_ADDRESS,
        variableDebtTokenAddress: DUMMY_USDT_ADDRESS,
        isPaused: false,
        isActive: true,
        variableBorrowIndex: 1n ** 18n
      }]])

      await expect(aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })).rejects.toThrow(AAVE_V3_ERROR.DEBT_NOT_FOUND)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(scaledBalanceOfMock).toHaveBeenCalled()
      expect(getReservesDataMock).toHaveBeenCalled()
    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.repay({
        token: 'invalid-address',
        amount: 1_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })
  })

  describe('quoteRepay', () => {
    test('should successfully quote a repay transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 0 })
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })
      const DUMMY_TX = {
        data: '0x573ade81000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }

      const { fee } = await aaveProtocolEvm.quoteRepay({
        token: DUMMY_USDT_ADDRESS,
        amount: 1_000_000
      })

      expect(account.quoteSendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(account._account.provider.getNetwork).toHaveBeenCalled()
      expect(fee).toBe(0)
    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteRepay({
        token: 'invalid-address',
        amount: 1_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.quoteRepay({
        token: DUMMY_USDT_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteRepay({
        token: DUMMY_USDT_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })
  })

  describe('setUserEMode', () => {
    test('should successfully set user e-mode', async () => {
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account._account.provider.getNetwork = jest.fn().mockResolvedValue({ chainId: DUMMY_CHAIN_ID })

      const { hash, fee } = await aaveProtocolEvm.setUserEMode(1)

      expect(account.sendTransaction).toBeCalled()
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw if catergory id is not valid', async () => {
      await expect(aaveProtocolEvm.setUserEMode(-1)).rejects.toThrow(AAVE_V3_ERROR.INVALID_CATEGORY_ID)
    })
  })
})