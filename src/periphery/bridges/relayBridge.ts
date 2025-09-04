import {formatEther, parseEther, Wallet} from 'ethers'
import {chains} from '../../utils/constants'
import axios from 'axios'
import {estimateTx, getBalance, sendRawTx} from '../web3Client'
import {bigintToPrettyStr, c, defaultSleep, RandomHelpers, retry} from '../../utils/helpers'
import {maxRetries, BridgeConfig, sleepBetweenActions} from '../../../config'
import {ChainName} from '../../utils/types'
import {getNativeCoinPrice, getProvider} from '../utils'
import {BridgeInterface} from './baseBridgeInterface'

class RelayBridge extends BridgeConfig implements BridgeInterface {
    signer: Wallet
    constructor(signer: Wallet) {
        super()
        this.signer = signer
    }
    async #executeBridge(signer: Wallet, currency: string, fromNetwork: ChainName, toNetwork: ChainName, value: bigint): Promise<boolean> {
        let result: boolean | undefined = await retry(
            async () => {
                // const fromChainId = chains[fromNetwork].id.toString()
                // const toChainId = chains[toNetwork].id.toString()
                const fromChainId = chains[fromNetwork].id
                const toChainId = chains[toNetwork].id
                let avgBridgeFee = 501_383_102_086_736n
                if (value - avgBridgeFee <= 0n) {
                    avgBridgeFee = 50_000_000_000_000n
                    if (value - avgBridgeFee <= 0n) {
                        // prettier-ignore
                        console.log(
                            c.red(`[relay] Can't from ${fromNetwork} to ${toNetwork} ${bigintToPrettyStr(value, undefined, 6)} ${currency}: Small amount`)
                        )
                        return false
                    }
                }
                let bridgeFee = await this.estimateBridgeFee(signer, currency as 'ETH', fromNetwork, toNetwork, value, {avgBridgeFee: avgBridgeFee})
                let valueToBridge = this.deductFee ? value - bridgeFee : value
                if (valueToBridge <= 0n) {
                    console.log(
                        c.red(
                            `[relay] Can't from ${fromNetwork} to ${toNetwork} ${bigintToPrettyStr(
                                valueToBridge,
                                undefined,
                                6
                            )} ${currency}: Small amount`
                        )
                    )
                    return false
                }
                const bridgeResp = await axios.post(
                    'https://api.relay.link/quote',
                    {
                        user: await signer.getAddress(),
                        originChainId: fromChainId,
                        destinationChainId: toChainId,
                        originCurrency: '0x0000000000000000000000000000000000000000',
                        destinationCurrency: '0x0000000000000000000000000000000000000000',
                        recipient: await signer.getAddress(),
                        tradeType: 'EXACT_INPUT',
                        amount: value.toString(),
                        usePermit: false,
                        useExternalLiquidity: false,
                        useDepositAddress: false,
                        referrer: 'relay.link/bridge',
                        slippageTolerance: ''
                    },
                    {
                        headers: {
                            Host: 'api.relay.link',
                            Origin: 'https://relay.link',
                            Referer: 'https://relay.link/',
                            'Content-Type': 'application/json',
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                        }
                    }
                )
                let tx = bridgeResp.data?.steps[0].items[0].data
                if (tx?.gasPrice != undefined) {
                    if (tx.gasPrice?.type == 'BigNumber') {
                        tx.gasPrice = tx.gasPrice.hex
                    }
                }
                let testTx = {...tx}
                testTx.value = 1000000000n
                let estimate = await estimateTx(signer, testTx)
                let cost = (BigInt(tx?.gasPrice ?? tx?.maxFeePerGas) * BigInt(estimate) * 16n) / 10n
                tx.value = this.deductFee ? BigInt(tx?.value) - cost : BigInt(tx?.value)
                if (tx.value <= 0n) {
                    console.log(
                        c.red(
                            `[relay] Can't from ${fromNetwork} to ${toNetwork} ${bigintToPrettyStr(
                                tx.value,
                                undefined,
                                6
                            )} ${currency}: Value is too small after fee deduction`
                        )
                    )
                    return false
                }
                // need to do another request with correct value since relay sends requestID as tx.data
                // and reverts if request value != tx value
                // Code in here is kinda sphagetti, but i'm lazy to rewrite it :/
                const finalBridgeResp = await axios.post(
                    'https://api.relay.link/quote',
                    {
                        user: await signer.getAddress(),
                        originChainId: fromChainId,
                        destinationChainId: toChainId,
                        originCurrency: '0x0000000000000000000000000000000000000000',
                        destinationCurrency: '0x0000000000000000000000000000000000000000',
                        recipient: await signer.getAddress(),
                        tradeType: 'EXACT_OUTPUT',
                        amount: tx.value.toString(),
                        usePermit: false,
                        useExternalLiquidity: false,
                        useDepositAddress: false,
                        referrer: 'relay.link/bridge',
                        slippageTolerance: ''
                    },
                    {
                        headers: {
                            Host: 'api.relay.link',
                            Origin: 'https://relay.link',
                            Referer: 'https://relay.link/',
                            'Content-Type': 'application/json',
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                        }
                    }
                )
                tx = finalBridgeResp.data?.steps[0].items[0].data
                if (tx?.gasPrice != undefined) {
                    if (tx.gasPrice?.type == 'BigNumber') {
                        tx.gasPrice = tx.gasPrice.hex
                    }
                }
                if (tx.value <= 0n) {
                    console.log(
                        c.red(
                            `[relay] Can't from ${fromNetwork} to ${toNetwork} ${bigintToPrettyStr(
                                tx.value,
                                undefined,
                                6
                            )} ${currency}: Value is too small after fee deduction`
                        )
                    )
                    return false
                }
                tx.gasLimit = estimate
                console.log(c.yellow(`[relay] bridging ${formatEther(tx.value)} ${chains[fromNetwork].currency.name} from ${fromNetwork} to ${toNetwork}`))
                let hash = await sendRawTx(signer, tx, true)
                console.log(
                    c.green(`[relay] ${formatEther(tx.value)} ${currency}: ${fromNetwork} --> ${toNetwork} ${chains[fromNetwork].explorer + hash}`)
                )
                return true
            },
            {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
        )
        if (result == undefined) {
            console.log(c.red(`[relay] Bridge from ${fromNetwork} to ${toNetwork} failed`))
            return false
        } else {
            return result
        }
    }

    async bridge(signer: Wallet, currency = 'ETH'): Promise<boolean> {
        let networks = RandomHelpers.shuffleArray(this.fromNetworks)
        let hasBridged = false
        for (let i = 0; i < networks.length; i++) {
            let fromNetwork = networks[i] as ChainName
            let toNetwork = this.toNetwork
            // since relay bridge is good only for eth, require that from user
            if (
                chains[fromNetwork].currency.name.toLowerCase() != currency.toLowerCase() ||
                chains[toNetwork].currency.name.toLowerCase() != currency.toLowerCase()
            ) {
                console.log(
                    '[relay]',
                    c.red('You can bridge only ETH on ETH-specific chains.', `${fromNetwork} or ${toNetwork} is not ETH-specific.`)
                )
                return false
            }
            let valueToBridge = await this.getSendValue(fromNetwork)
            if (valueToBridge < 0n) {
                console.log(c.red(`[relay] value to bridge must be > 0. Got: ${formatEther(valueToBridge)}`))
                continue
            }
            if (valueToBridge < parseEther(this.minToBridge)) {
                console.log(
                    c.yellow(`[relay] value to bridge from ${fromNetwork} is below limit of ${this.minToBridge} ${chains[fromNetwork].currency.name}`)
                )
                continue
            }
            let success = await this.#executeBridge(signer.connect(getProvider(fromNetwork)), currency, fromNetwork, toNetwork, valueToBridge)
            if (success) {
                await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions))
                hasBridged = true
            }
        }
        return hasBridged
    }
    async estimateBridgeFee(
        signer: Wallet,
        currency: string,
        fromNetwork: ChainName,
        toNetwork: ChainName,
        value: bigint,
        additionalParams: {avgBridgeFee: bigint}
    ): Promise<bigint> {
        const fromChainId = chains[fromNetwork].id.toString()
        const toChainId = chains[toNetwork].id.toString()
        const quoteBridgeResp = await axios.post(
            'https://api.relay.link/quote',
            {
                user: await signer.getAddress(),
                originChainId: fromChainId,
                destinationChainId: toChainId,
                originCurrency: '0x0000000000000000000000000000000000000000',
                destinationCurrency: '0x0000000000000000000000000000000000000000',
                recipient: await signer.getAddress(),
                tradeType: 'EXACT_INPUT',
                slippageTolerance: '',
                amount: (value - additionalParams.avgBridgeFee).toString(),
                usePermit: false,
                useExternalLiquidity: false,
                referrer: 'relay.link/bridge'
            },
            {
                headers: {
                    Host: 'api.relay.link',
                    Origin: 'https://relay.link',
                    Referer: 'https://relay.link/',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                }
            }
        )
        return BigInt(quoteBridgeResp.data?.fees.relayer.amount)
    }
    async getSendValue(networkName: ChainName): Promise<bigint> {
        if (this.values.from.includes('%') && this.values.to.includes('%')) {
            if (parseFloat(this.values.from) < 0 || parseFloat(this.values.to) < 0) {
                console.log(c.red(`Can't pass negative numbers to Relay Bridge`))
                throw Error(`Can't pass negative numbers to Relay Bridge`)
            }
            let precision = 1000
            let balance = await getBalance(getProvider(networkName), this.signer.address)
            let randomPortion = BigInt(
                (RandomHelpers.getRandomNumber({from: parseFloat(this.values.from), to: parseFloat(this.values.to)}, 3) * precision).toString()
            )
            let value = (balance * randomPortion) / (100n * BigInt(precision))
            return value
        } else if (this.values.from.includes('-') && this.values.to.includes('-')) {
            let balance = await getBalance(getProvider(networkName), this.signer.address)
            let i = 0
            while (i < 10) {
                let toLeaveFrom = balance - parseEther(this.values.to.replace('-', '')) // balance - max_to_leave
                let toLeaveTo = balance - parseEther(this.values.from.replace('-', '')) // balance - min_to_leave

                let randomValue = BigInt(RandomHelpers.getRandomBigInt({from: toLeaveFrom, to: toLeaveTo}).toString())
                if (randomValue < 0n) {
                    i++
                    continue
                }
                return randomValue
            }
            return 0n
        } else if (this.values.from.includes('+') && this.values.to.includes('+')) {
            let srcBalance = await getBalance(getProvider(networkName), this.signer.address)
            let dstBalance = await getBalance(getProvider(this.toNetwork), this.signer.address)
            let i = 0
            while (i < 10) {
                let toRefuelMin = parseEther(this.values.from.replace('+', '')) - dstBalance // balance - min_to_have
                let toRefuelMax = parseEther(this.values.to.replace('+', '')) - dstBalance // balance - max_to_have

                if (dstBalance >= parseEther(this.values.from.replace('+', ''))) {
                    console.log(`[${this.bridgeType}] balance in ${this.toNetwork} >${this.values.from.replace('+', '')}`)
                    return 0n
                }

                let randomValue = BigInt(RandomHelpers.getRandomBigInt({from: toRefuelMin, to: toRefuelMax}).toString())
                if (randomValue < 0n || srcBalance < randomValue) {
                    i++
                    continue
                }
                return randomValue
            }
            return 0n
        } else if (
            !this.values.from.includes('%') &&
            !this.values.to.includes('%') &&
            !this.values.from.includes('-') &&
            !this.values.to.includes('-') &&
            !this.values.from.includes('+') &&
            !this.values.to.includes('+')
        ) {
            let value = parseEther(RandomHelpers.getRandomNumber({from: parseFloat(this.values.from), to: parseFloat(this.values.to)}).toString())
            return value
        } else {
            console.log(c.red(`Your "values" in "RelayBridgeConfig" are wrong. Should be *number*, *percentage* or *to leave*`))
            throw Error(`Your "values" in "RelayBridgeConfig" are wrong. Should be *number*, *percentage* or *to leave*`)
        }
    }
}
export {RelayBridge}
