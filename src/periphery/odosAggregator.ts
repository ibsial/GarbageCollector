import {formatUnits, TransactionRequest, Wallet, ZeroAddress} from 'ethers'
import {ChainName, OdosAssembleType, OdosQuoteType} from '../utils/types'
import axios, {AxiosError, AxiosInstance} from 'axios'
import {c, RandomHelpers, retry} from '../utils/helpers'
import {chains} from '../utils/constants'
import {approve, getGwei, sendTx} from './web3Client'
import {DEV, maxRetries} from '../../config'
import {HttpsProxyAgent} from 'https-proxy-agent'

class OdosAggregator {
    quoteUrl = 'https://api.odos.xyz/sor/quote/v3'
    assembleUrl = 'https://api.odos.xyz/sor/assemble'
    signer: Wallet
    networkName: ChainName
    session: AxiosInstance
    proxies: string[] | undefined
    constructor(signer: Wallet, network?: ChainName, proxy?: string, proxies?: string[]) {
        this.signer = signer
        this.networkName = network ?? 'Ethereum'
        if (proxy) {
            this.session = axios.create({
                httpAgent: new HttpsProxyAgent(`http://${proxy}`),
                httpsAgent: new HttpsProxyAgent(`http://${proxy}`),
                timeout: 7_000
            })
        } else {
            this.session = axios.create({timeout: 7_000})
        }
        this.proxies = proxies
    }
    setNetwork(newNetworkName: ChainName) {
        this.networkName = newNetworkName
        return this
    }
    async swap(
        tokenIn: {
            address: string
            name: string
            symbol: string
            decimals: bigint
        },
        tokenOut: {
            address: string
            name: string
            symbol: string
            decimals: bigint
        },
        amountIn: bigint
    ): Promise<boolean> {
        let quote
        try {
            quote = await this.quoteSwap(tokenIn, tokenOut, amountIn)
            if (quote == undefined) {
                // console.log(`[Odos]      ${tokenIn.symbol} --> ${tokenOut.symbol} swap is too expensive or is not available`)
                return false
            }
        } catch (e: any) {
            console.log(c.red(`OdosAggregator:swap Quote failed, reason: ${e?.message ?? 'unknown'}`))
            return false
        }
        try {
            let swapResult = await this.executeSwap(tokenIn, tokenOut, quote)
            if (swapResult) {
            }
            return swapResult
        } catch (e: any) {
            console.log(c.red(`OdosAggregator:swap Swap failed, reason: ${e?.message ?? 'unknown'}`))
            return false
        }
    }
    async quoteSwap(
        tokenIn: {
            address: string
            name: string
            symbol: string
            decimals: bigint
        },
        tokenOut: {
            address: string
            name: string
            symbol: string
            decimals: bigint
        },
        amountIn: bigint
    ) {
        let supportedNetworks: ChainName[] = [
            'Ethereum',
            'Arbitrum',
            'Avalanche',
            'Polygon',
            'Bsc',
            'Optimism',
            'Base',
            'Fantom',
            'Zksync',
            'Linea',
            'Scroll',
            'Mantle'
        ]
        if (!supportedNetworks.includes(this.networkName)) {
            if (DEV) {
                console.log(`OdosAggregator:quoteSwap ${this.networkName} network not supported`)
            }
            return undefined
        }
        if (this.#isTokenNative(tokenIn.address) && this.#isTokenNative(tokenOut.address)) {
            if (DEV) {
                console.log(`[Odos]      can't swap same asset (${tokenIn.name} --> ${tokenOut.name})`)
            }
            return undefined
        }
        const payload = {
            chainId: chains[this.networkName].id,
            inputTokens: [
                {
                    tokenAddress: this.#isTokenNative(tokenIn.address) ? ZeroAddress : tokenIn.address,
                    amount: amountIn.toString()
                }
            ],
            outputTokens: [
                {
                    tokenAddress: this.#isTokenNative(tokenOut.address) ? ZeroAddress : tokenOut.address,
                    proportion: 1
                }
            ],
            userAddr: this.signer.address,
            slippageLimitPercent: 10,
            pathViz: false,
            referralCode: 1,
            simple: true // simple quotes will be preferred
        }
        let res: OdosQuoteType | undefined = await retry(
            async () => {
                try {
                    let resp = await this.session.post(this.quoteUrl, payload, {
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    let body: OdosQuoteType = resp.data
                    if (body.netOutValue < 0.01) {
                        return
                    }
                    return body
                } catch (e: any) {
                    // how to do this better? Maybe introduce a "callback" to retry helper?
                    if (e instanceof AxiosError) {
                        this.changeSession()
                    }
                    throw e
                }
            },
            {maxRetryCount: maxRetries, retryInterval: 5, needLog: false, throwOnError: false}
        )
        return res
    }
    async executeSwap(
        tokenIn: {
            address: string
            name: string
            symbol: string
            decimals: bigint
        },
        tokenOut: {
            address: string
            name: string
            symbol: string
            decimals: bigint
        },
        quote: OdosQuoteType
    ) {
        let approvalTarget: string | undefined = await retry(
            async () => {
                try {
                    let resp = await this.session.get(`https://api.odos.xyz/info/contract-info/v3/${chains[this.networkName].id}`, {
                        headers: {'Content-Type': 'application/json'}
                    })
                    return resp.data.routerAddress
                } catch (e: any) {
                    // how to do this better? Maybe introduce a "callback" to retry helper?
                    if (e instanceof AxiosError) {
                        this.changeSession()
                    }
                    throw e
                }
            },
            {maxRetryCount: 5, retryInterval: 5, needLog: false, throwOnError: false}
        )
        if (!approvalTarget || approvalTarget == undefined) {
            console.log('OdosAggregator:executeSwap Could not get approval target')
            return false
        }
        let approveHash = await approve(this.signer, quote.inTokens[0], approvalTarget, quote.inAmounts[0], quote.inAmounts[0])
        if (DEV) {
            console.log(
                c.blue(
                    `OdosAggregator:executeSwap ${tokenIn.symbol} approved ${
                        approveHash == '' ? "don't need approve" : chains[this.networkName].explorer + approveHash
                    }`
                )
            )
        }
        let tx: OdosAssembleType['transaction'] | undefined = await retry(
            async () => {
                try {
                    const assembleRequestBody = {
                        userAddr: this.signer.address, // the checksummed address used to generate the quote
                        pathId: quote.pathId, // Replace with the pathId from quote response in step 1
                        simulate: true // this can be set to true if the user isn't doing their own estimate gas call for the transaction
                    }
                    let resp = await this.session.post(this.assembleUrl, assembleRequestBody, {headers: {'Content-Type': 'application/json'}})
                    let body: OdosAssembleType = resp.data
                    if (body.simulation.isSuccess) {
                        return body.transaction
                    } else {
                        // console.log('OdosAggregator:executeSwap swap simulation failed')
                        throw Error('OdosAggregator:executeSwap swap simulation failed')
                    }
                } catch (e: any) {
                    // how to do this better? Maybe introduce a "callback" to retry helper?
                    if (e instanceof AxiosError) {
                        this.changeSession()
                    }
                    throw e
                }
            },
            {maxRetryCount: maxRetries, retryInterval: 5, needLog: false, throwOnError: false}
        )
        if (tx == undefined) {
            if (DEV) {
                console.log(c.red('OdosAggregator:executeSwap swap simulation failed'))
            }
            return false
        }
        let adjustedTx: TransactionRequest & OdosAssembleType['transaction'] = tx
        adjustedTx.gasLimit = tx.gas
        if (adjustedTx.gasLimit != undefined) {
            adjustedTx.gasLimit = (BigInt(adjustedTx.gasLimit) * 11n) / 10n
        }
        delete adjustedTx?.gas
        let gasPriceMultiplier = this.networkName == 'Ethereum' || this.networkName == 'Polygon' || this.networkName == 'Avalanche' ? 1.1 : 1
        if (this.networkName == 'Linea' && tokenIn.name == 'LINEA') {
            gasPriceMultiplier = 1.5
        }
        let swapHash = await sendTx(this.signer, adjustedTx, {price: gasPriceMultiplier, limit: 1}, true)
        console.log(
            `[Odos]     `,
            `$${c.bold(tokenIn.symbol)} --> $${c.bold(tokenOut.symbol)} ${c.green(chains[this.networkName].explorer + swapHash)}`
        )
        return true
    }
    #isTokenNative(token: string) {
        return (
            token.toLowerCase() == ZeroAddress.toLowerCase() ||
            token.toLowerCase() == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase() ||
            token.toLowerCase() == '0x0000000000000000000000000000000000001010'.toLowerCase() // polygon MATIC address o_0
        )
    }
    changeSession() {
        if (this.proxies != undefined && this.proxies.length > 0) {
            let proxy = RandomHelpers.getRandomElementFromArray(this.proxies)
            // console.log('Odos: changed proxy to:', proxy)
            this.session = axios.create({
                httpAgent: new HttpsProxyAgent(`http://${proxy}`),
                httpsAgent: new HttpsProxyAgent(`http://${proxy}`),
                timeout: 7_000
            })
        }
    }
}

export {OdosAggregator}
