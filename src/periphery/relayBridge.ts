import {formatEther, Wallet} from 'ethers'
import {chains} from '../utils/constants'
import axios from 'axios'
import {estimateTx, sendRawTx} from './web3Client'
import {c, retry} from '../utils/helpers'
import {maxRetries} from '../../config'

async function bridgeRelay(signer: Wallet, currency = 'ETH', fromNetwork: string, toNetwork: string, value: bigint): Promise<boolean> {
    let result: boolean | undefined = await retry(
        async () => {
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
            const fromChainId = chains[fromNetwork].id
            const toChainId = chains[toNetwork].id
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
            const bridgeResp = await axios.post(
                'https://api.relay.link/execute/bridge',
                {
                    user: await signer.getAddress(),
                    originChainId: fromChainId,
                    destinationChainId: toChainId,
                    currency: currency.toLowerCase(),
                    recipient: await signer.getAddress(),
                    amount: (value - bridgeFee).toString(),
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
            let cost = (BigInt(tx?.gasPrice ?? tx?.maxFeePerGas) * BigInt(estimate) * 15n) / 10n
            tx.value = BigInt(tx?.value) - cost
            tx.gasLimit = estimate
            console.log(c.yellow(`bridging ${formatEther(tx.value)} ETH from ${fromNetwork} to ${toNetwork}`))
            let hash = sendRawTx(signer, tx, true)
            console.log(
                '[relay]',
                c.green(`${formatEther(tx.value)} ${currency}: ${fromNetwork} --> ${toNetwork} ${chains[fromNetwork].explorer + hash}`)
            )
            return true
        },
        {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
    )
    if (result == undefined) {
        return false
    } else {
        return result
    }
}

export {bridgeRelay}
