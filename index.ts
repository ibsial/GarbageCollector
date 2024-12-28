import {Wallet} from 'ethers'
import {menu} from './src/periphery/menu'
import {getProvider} from './src/periphery/utils'
import {scenarios} from './src/utils/constants'
import {c, defaultSleep, importAndValidatePrivateData, importProxies, RandomHelpers, retry, sleep} from './src/utils/helpers'
import {GarbageCollector} from './src/core/garbageCollector'
import {goodGwei, maxRetries, shuffleWallets, sleepBetweenAccs, sleepBetweenActions} from './config'
import {NativeSender} from './src/core/nativeSender'
import {getBalance, Multicall, waitGwei} from './src/periphery/web3Client'
import {RelayBridge} from './src/periphery/relayBridge'
import {OdosClient} from './src/periphery/odosAirdropClaim'

async function main() {
    let scenario = await menu.chooseTask()
    let proxies = await importProxies('./proxies.txt')
    let keysAndAddresses: {key: string; address: string}[]
    let provider = getProvider('Ethereum')
    let initialSigner: Wallet
    let garbageCollector: GarbageCollector
    let nativeSender: NativeSender

    switch (scenario) {
        case 'Balance cheker':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', false)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            initialSigner = new Wallet(keysAndAddresses[0].key)
            garbageCollector = new GarbageCollector(initialSigner, proxies)
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                garbageCollector.connect(signer)
                await garbageCollector.getNonZeroTokens()
            }
            break
        case 'Garbage collector':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', false)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            initialSigner = new Wallet(keysAndAddresses[0].key)
            garbageCollector = new GarbageCollector(initialSigner, proxies)
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                garbageCollector.connect(signer)
                await waitGwei(goodGwei)
                let anySwapHappened = await garbageCollector.getNonZeroTokensAndSwap()
                if (anySwapHappened) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break
        case 'Garbage collector & native sender':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', true)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            initialSigner = new Wallet(keysAndAddresses[0].key)
            garbageCollector = new GarbageCollector(initialSigner, proxies)
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                garbageCollector.connect(signer)
                nativeSender = new NativeSender(signer, keysAndAddresses[i].address)
                await waitGwei(goodGwei)
                let anySwapHappened = await garbageCollector.getNonZeroTokensAndSwap()
                if (anySwapHappened) {
                    await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions), true)
                }
                await waitGwei(goodGwei)
                let anyNativeSent = await nativeSender.sendNative()
                if (anySwapHappened || anyNativeSent) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break
        case 'Relay bridge':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', false)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                await waitGwei(goodGwei)
                const relay = new RelayBridge(signer)
                let result = await relay.executeRelayBridge(signer)
                if (result) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break
        case 'Odos claimer':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', false)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                await waitGwei(goodGwei)
                const odosAirdrop = new OdosClient(signer, proxies)
                let result = await odosAirdrop.claim()
                if (result) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break
        case 'Odos claimer & seller':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', false)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                await waitGwei(goodGwei)
                const odosAirdrop = new OdosClient(signer, proxies)
                let claimResult = await odosAirdrop.claim()
                if (claimResult) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenActions))
                }
                let sellResult: boolean | undefined = await retry(
                    async () => {
                        const garbageCollector = new GarbageCollector(signer, proxies)
                        garbageCollector.nonzeroTokens = {
                            Base: [
                                {
                                    ...(await Multicall.setNetwork('Base').getTokenInfo(['0xca73ed1815e5915489570014e024b7EbE65dE679']))[0],
                                    balance: await getBalance(
                                        signer.connect(getProvider('Base')),
                                        signer.address,
                                        '0xca73ed1815e5915489570014e024b7EbE65dE679'
                                    )
                                }
                            ]
                        }
                        garbageCollector.chainsToExclude = ['!Base']
                        return await garbageCollector.swapTokensToNativeForChain('Base')
                    },
                    {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
                )
                if (!claimResult && (!sellResult || sellResult == undefined)) {
                    continue
                }
                await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
            }
            break
        case 'Odos claimer & sender':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', true)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                await waitGwei(goodGwei)
                const odosAirdrop = new OdosClient(signer, proxies)
                let claimResult = await odosAirdrop.claim()
                if (claimResult) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenActions))
                }
                const nativeSender = new NativeSender(signer, keysAndAddresses[i].address)
                let sendResult = await nativeSender.sendToken('Base', '0xca73ed1815e5915489570014e024b7EbE65dE679')
                if (!claimResult && !sendResult) {
                    continue
                }
                await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
            }
            break
        default:
            console.log(`I could not understand you... \nAvailable scenarios are: ${c.magenta(scenarios.map((elem) => elem.name).join(' | '))}`)
    }
}

main()
