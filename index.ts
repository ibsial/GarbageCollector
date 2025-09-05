import {Wallet} from 'ethers'
import {menu} from './src/periphery/menu'
import {getProvider} from './src/periphery/utils'
import {scenarios} from './src/utils/constants'
import {c, defaultSleep, importAndValidatePrivateData, importProxies, RandomHelpers, sleep} from './src/utils/helpers'
import {GarbageCollector} from './src/core/garbageCollector'
import {goodGwei, shuffleWallets, sleepBetweenAccs, sleepBetweenActions} from './config'
import {NativeSender} from './src/core/nativeSender'
import {waitGwei} from './src/periphery/web3Client'
import {bridgeFactory} from './src/periphery/bridges/bridgeFactory'
import {executeClaim, executeClaimAndSell, executeClaimAndTransfer} from './src/periphery/lineaClaimer'

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
        case 'Stargate/Relay bridge':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', false)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, provider)
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                await waitGwei(goodGwei)
                const bridge = bridgeFactory.getBridge(signer)
                let result = await bridge.bridge(signer, 'ETH')
                if (result) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break

        case 'Claim linea':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', false)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, getProvider('Linea'))
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                let result = await executeClaim(i + 1, signer)
                if (result) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break
        case 'Claim and transfer to exch':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', true)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, getProvider('Linea'))
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                let result = await executeClaimAndTransfer(i + 1, signer, keysAndAddresses[i].address)
                if (result) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break
        case 'Claim and sell':
            keysAndAddresses = await importAndValidatePrivateData('./privates.txt', true)
            if (shuffleWallets) {
                keysAndAddresses = RandomHelpers.shuffleArray(keysAndAddresses)
            }
            for (let i = 0; i < keysAndAddresses.length; i++) {
                let signer = new Wallet(keysAndAddresses[i].key, getProvider('Linea'))
                console.log(c.cyan(`#${i + 1}/${keysAndAddresses.length} ${signer.address}`))
                let result = await executeClaimAndSell(i + 1, signer, proxies)
                if (result) {
                    await sleep(RandomHelpers.getRandomNumber(sleepBetweenAccs))
                }
            }
            break
        default:
            console.log(`I could not understand you... \nAvailable scenarios are: ${c.magenta(scenarios.map((elem) => elem.name).join(' | '))}`)
    }
}

main()
