import { IPool_ABI } from '@bgd-labs/aave-address-book/abis'
import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { WalletAccountEvm } from '@wdk/wdk-wallet-evm'

import * as ethers from 'ethers'
import { AAVE_V3_ADDRESS_MAP, AAVE_V3_ERROR } from '../src/constants.js'
const { Contract } = ethers

const SEED_PHRASE = 'cook voyage document eight skate token alien guide drink uncle term abuse'

const DUMMY_EMPTY_ACCOUNT = '0xD073A82eDFc66F8627038894b486cfe94153Fe28'
const DUMMY_ON_BEHALF_OF_ACCOUNT = '0xc0ffee254729296a45a3885639AC7E10F9d54979'

// Ethereum
const DUMMY_PROVIDER = 'https://virtual.mainnet.rpc.tenderly.co/359bdebd-10a4-4a86-98f7-a208cbe6f360'
const DUMMY_ADDRESS_MAP = AAVE_V3_ADDRESS_MAP[1]
const DUMMY_POOL_ADDRESS = DUMMY_ADDRESS_MAP.pool
const DUMMY_USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const DUMMY_BNB_ADDRESS = '0xB8c77482e45F1F44dE1745F52C74426C631bDD52'

const DUMMY_TX_RESULT = {
  hash: 'dummy-hash',
  fee: 0
}

const getUserAccountDataMock = jest.fn()

jest.unstable_mockModule('ethers', () => ({
  ...ethers,
  Contract: jest.fn().mockImplementation((...args) => {
    const contract = new Contract(...args)

    if (args[1] === IPool_ABI) {
      contract.getUserAccountData = getUserAccountDataMock
    }

    return contract
  })
}))

const { default: AaveProtocolEvm } = await import('../index.js')

jest.setTimeout(500000)

describe('AaveProtocolEvm', () => {
  let aaveProtocolEvm, account

  beforeEach(() => {
    account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: DUMMY_PROVIDER
    })
    aaveProtocolEvm = new AaveProtocolEvm(account)
  })

  describe('getAccountData', () => {
    test('should return account data', async () => {
      const DUMMY_EMPTY_ACCOUNT_DATA = {
        totalCollateralBase: 0,
        totalDebtBase: 0,
        availableBorrowsBase: 0,
        currentLiquidationThreshold: 0,
        ltv: 0,
        healthFactor: 0
      }
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(AAVE_V3_ADDRESS_MAP[1])
      getUserAccountDataMock.mockResolvedValue([0, 0, 0, 0, 0, 0])

      await aaveProtocolEvm.getAccountData()

      expect(getUserAccountDataMock).toHaveBeenCalled()
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
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(DUMMY_ADDRESS_MAP)

      const { hash, fee } = await aaveProtocolEvm.setUseReserveAsCollateral(DUMMY_USDT_ADDRESS, true)

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test ('should successfully disable supplied asset to be used as collateral', async () => {
      const DUMMY_TX = {
        data: '0x5a3b74b9000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000000',
        to: DUMMY_POOL_ADDRESS,
        value: 0
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)      
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(DUMMY_ADDRESS_MAP)

      const { hash, fee } = await aaveProtocolEvm.setUseReserveAsCollateral(DUMMY_USDT_ADDRESS, false)

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test ('should throw if token is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.setUseReserveAsCollateral(
        'invalid-address',
        true
        )).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
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
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(DUMMY_ADDRESS_MAP)

      const { hash, fee } = await aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw if has insufficient fund to supply' , async () => {
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
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(DUMMY_ADDRESS_MAP)

      const { hash, fee } = await aaveProtocolEvm.supply({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
        onBehalfOf: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })
  })

  describe('quoteSupply', () => {
    test('should successfully quote a supply transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 0 })
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
      expect(fee).toBe(0)
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
    test('should successfully withdraw asset from the reserve when not using asset as collateral', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0x69328dec000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000989680000000000000000000000000d073a82edfc66f8627038894b486cfe94153fe28',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000,
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(DUMMY_ADDRESS_MAP)

      const { hash, fee } = await aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.hash)
    })

    test('should successfully withdraw asset when health factor after withdrawal is greater than 1', () => {

    })

    test('should throw if the withdrawal cause health factor to be below 1', () => {

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
      account.getTokenBalance = jest.fn().mockResolvedValue(DUMMY_AMOUNT * 2)
      aaveProtocolEvm._getAddressMap = jest.fn().mockResolvedValue(DUMMY_ADDRESS_MAP)

      const { hash, fee } = await aaveProtocolEvm.withdraw({
        token: DUMMY_USDT_ADDRESS,
        amount: 10_000_000,
        to: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.hash)
    })
  })

  describe('quoteWithdraw', () => {
    test('should successfully quote withdraw transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 0 })
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
        data: '0xa415bcad000000000000000000000000b8c77482e45f1f44de1745f52c74426c631bdd5200000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)

      const { hash, fee } = await aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(account.sendTransaction).toHaveBeenCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('with insufficient collateral, should throw when borrow asset', () => {

    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.borrow({
        token: 'invalid-address',
        amount: 1_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_BNB_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.borrow({
        token: DUMMY_BNB_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('on behalf of an address with sufficient collateral, should successfully borrow asset', async () => {
      const DUMMY_AMOUNT = 10_000_000
      const DUMMY_TX = {
        data: '0xa415bcad000000000000000000000000b8c77482e45f1f44de1745f52c74426c631bdd5200000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }

      const { hash, fee } = await aaveProtocolEvm.borrow({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT,
        onBehalfOf: DUMMY_ON_BEHALF_OF_ACCOUNT
      })

      expect(account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('on behalf of an address with insufficient collateral, should throw when borrow asset', () => {

    })

    test('given insufficient credit allowance on behalf of an address, should throw when borrow asset', () => {

    })
  })

  describe('quoteBorrow', () => {
    test('should successfully quote a borrow transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 0 })
      const DUMMY_TX = {
        data: '0xa415bcad000000000000000000000000b8c77482e45f1f44de1745f52c74426c631bdd5200000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000405005c7c4422390f4b334f64cf20e0b767131d0',
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }

      const { fee } = await aaveProtocolEvm.quoteBorrow({
        token: DUMMY_BNB_ADDRESS,
        amount: 1_000_000
      })

      expect(account.quoteSendTransaction).toHaveBeenCalledWith(DUMMY_TX)
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
        token: DUMMY_BNB_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteBorrow({
        token: DUMMY_BNB_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })
  })

  describe('repay', () => {
    test('should successfully repay for a debt position', async () => {
      const DUMMY_AMOUNT =  10_000_000
      const DUMMY_TX = {
        data: '0x573ade81000000000000000000000000b8c77482e45f1f44de1745f52c74426c631bdd5200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000d073a82edfc66f8627038894b486cfe94153fe28',
        from: DUMMY_EMPTY_ACCOUNT,
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)

      await aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(aaveProtocolEvm._account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
    })

    test('should throw error when there is no debt position', async () => {
      const DUMMY_AMOUNT =  10_000_000
      const DUMMY_TX = {
        data: '0x573ade81000000000000000000000000b8c77482e45f1f44de1745f52c74426c631bdd5200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000d073a82edfc66f8627038894b486cfe94153fe28',
        from: DUMMY_EMPTY_ACCOUNT,
        to: DUMMY_POOL_ADDRESS,
        value: 0,
        gasLimit: 300000
      }
      account.sendTransaction = jest.fn().mockResolvedValue(DUMMY_TX_RESULT)

      const { hash, fee } = await aaveProtocolEvm.repay({
        token: DUMMY_USDT_ADDRESS,
        amount: DUMMY_AMOUNT
      })

      expect(account.sendTransaction).toHaveBeenLastCalledWith(DUMMY_TX)
      expect(hash).toBe(DUMMY_TX_RESULT.hash)
      expect(fee).toBe(DUMMY_TX_RESULT.fee)
    })

    test('should throw if token address is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.repay({
        token: 'invalid-address',
        amount: 1_000_000
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })

    test('should throw if amount is equal to or less than 0', async () => {
      await expect(aaveProtocolEvm.repay({
        token: DUMMY_BNB_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.repay({
        token: DUMMY_BNB_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })
  })

  describe('quoteRepay', () => {
    test('should successfully quote a repay transaction', async () => {
      account.quoteSendTransaction = jest.fn().mockResolvedValue({ fee: 0 })
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
        token: DUMMY_BNB_ADDRESS,
        amount: 0
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_AMOUNT)
    })

    test('should throw if onBehalfAddress is not a valid EVM address', async () => {
      await expect(aaveProtocolEvm.quoteRepay({
        token: DUMMY_BNB_ADDRESS,
        amount: 1_000_000,
        onBehalfOf: 'invalid-address'
      })).rejects.toThrow(AAVE_V3_ERROR.INVALID_ADDRESS)
    })
  })
})