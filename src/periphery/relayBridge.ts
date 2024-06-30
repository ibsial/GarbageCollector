import {formatEther, parseEther, Wallet} from 'ethers'
import {chains} from '../utils/constants'
import axios from 'axios'
import {estimateTx, getBalance, sendRawTx} from './web3Client'
import {c, defaultSleep, RandomHelpers, retry} from '../utils/helpers'
import {maxRetries, RelayBridgeConfig, sleepBetweenActions} from '../../config'
import {ChainName} from '../utils/types'
import {getProvider} from './utils'

class RelayBridge extends RelayBridgeConfig {
    signer: Wallet
    constructor(signer: Wallet) {
        super()
        this.signer = signer
    }
    async bridgeRelay(signer: Wallet, currency = 'ETH', fromNetwork: ChainName, toNetwork: ChainName, value: bigint): Promise<boolean> {
        let result: boolean | undefined = await retry(
            async () => {
                const fromChainId = chains[fromNetwork].id.toString()
                const toChainId = chains[toNetwork].id.toString()
                let avgBridgeFee = 501_383_102_086_736n
                const quoteBridgeResp = await axios.post(
                    'https://api.relay.link/execute/bridge',
                    {
                        user: await signer.getAddress(),
                        originChainId: fromChainId,
                        destinationChainId: toChainId,
                        currency: currency.toLowerCase(),
                        recipient: await signer.getAddress(),
                        amount: (value - avgBridgeFee).toString(),
                        usePermit: false,
                        source: 'relay.link'
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
                let bridgeFee = BigInt(quoteBridgeResp.data?.fees.relayer)
                let valueToBridge = this.deductFee ? value - bridgeFee : value
                const bridgeResp = await axios.post(
                    'https://api.relay.link/execute/bridge',
                    {
                        user: await signer.getAddress(),
                        originChainId: fromChainId,
                        destinationChainId: toChainId,
                        currency: currency.toLowerCase(),
                        recipient: await signer.getAddress(),
                        amount: valueToBridge.toString(),
                        usePermit: false,
                        source: 'relay.link'
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
                let testTx = {...tx}
                testTx.value = 1000000000n
                let estimate = await estimateTx(signer, testTx)
                let cost = (BigInt(tx?.gasPrice ?? tx?.maxFeePerGas) * BigInt(estimate) * 13n) / 10n
                tx.value = this.deductFee ? BigInt(tx?.value) - cost : BigInt(tx?.value)
                tx.gasLimit = estimate
                console.log(c.yellow(`[relay] bridging ${formatEther(tx.value)} ETH from ${fromNetwork} to ${toNetwork}`))
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

    async executeRelayBridge(signer: Wallet, currency = 'ETH') {
        let networks = RandomHelpers.shuffleArray(this.fromNetworks)
        for (let i = 0; i < networks.length; i++) {
            let fromNetwork = networks[i] as ChainName
            let toNetwork = this.toNetwork
            // since relay bridge is good only for eth, require that from user
            if (
                chains[fromNetwork].currency.toLowerCase() != currency.toLowerCase() ||
                chains[toNetwork].currency.toLowerCase() != currency.toLowerCase()
            ) {
                console.log(
                    '[relay]',
                    c.red('You can bridge only ETH on ETH-specific chains.', `${fromNetwork} or ${toNetwork} is not ETH-specific.`)
                )
                return false
            }
            let valueToBridge = await this.getSendValue(fromNetwork)
            if (valueToBridge < 0n) {
                console.log(c.red(`value to bridge must be > 0. Got: ${formatEther(valueToBridge)}`))
            }
            let success = await this.bridgeRelay(signer.connect(getProvider(fromNetwork)), currency, fromNetwork, toNetwork, valueToBridge)
            if (success) {
                await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions))
            }
        }
    }

    async getSendValue(networkName: ChainName): Promise<bigint> {
        if (parseFloat(this.values.from) < 0 || parseFloat(this.values.to) < 0) {
            console.log(c.red(`Can't pass negative numbers to NativeSender`))
            throw Error(`Can't pass negative numbers to NativeSender`)
        }
        if (this.values.from.includes('%') && this.values.to.includes('%')) {
            let precision = 1000
            let balance = await getBalance(getProvider(networkName), this.signer.address)
            let randomPortion = BigInt(
                (RandomHelpers.getRandomNumber({from: parseFloat(this.values.from), to: parseFloat(this.values.to)}, 3) * precision).toFixed()
            )
            let value = (balance * randomPortion) / (100n * BigInt(precision))
            return value
        } else if (!this.values.from.includes('%') && !this.values.to.includes('%')) {
            let value = parseEther(RandomHelpers.getRandomNumber({from: parseFloat(this.values.from), to: parseFloat(this.values.to)}).toFixed())
            return value
        } else {
            console.log(c.red(`Your "values" in "NativeSenderConfig" are wrong. Should be *number* or *percentage*`))
            throw Error(`Your "values" in "NativeSenderConfig" are wrong. Should be *number* or *percentage*`)
        }
    }
}
export {RelayBridge}
