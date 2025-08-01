import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { WalletAccountEvm } from '@wdk/wdk-wallet-evm'
import AaveProtocolEvm from '../../src/aave-protocol-evm.js'

const DUMMY_PROVIDER = 'https://virtual.mainnet.rpc.tenderly.co/359bdebd-10a4-4a86-98f7-a208cbe6f360'
// const DUMMY_PROVIDER = 'https://1rpc.io/eth'
const SEED_PHRASE = 'security palace leisure motor earn chapter help rotate crumble present measure expand'
const DUMMY_USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

describe('AaveProtocolEvm integration tests', () => {
  jest.setTimeout(500000)
  test('WIP', async () => {
    const account = new WalletAccountEvm(SEED_PHRASE, "0'/0/0", {
      provider: DUMMY_PROVIDER
    })
    const balance = BigInt(await account.getBalance())
    const aaveProtocolEvm = new AaveProtocolEvm(account)

    aaveProtocolEvm._account.sendTransaction = jest.fn().mockResolvedValue({
      hash: 'dummy-transaction-hash',
      fee: 0
    })

    await aaveProtocolEvm.test()
  })
})