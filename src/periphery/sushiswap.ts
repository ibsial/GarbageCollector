import {MaxUint256, Wallet, ZeroAddress} from 'ethers'
import {ChainName} from '../utils/types'
import {c, RandomHelpers, retry} from '../utils/helpers'
import {chains, sushiswapV2Routers} from '../utils/constants'
import {approve, estimateTx, getGwei, sendTx} from './web3Client'
import {DEV} from '../../config'
import {ERC20__factory, UniswapV2Router02__factory} from '../../typechain'

class Sushiswap {
    signer: Wallet
    networkName: ChainName
    constructor(signer: Wallet, network?: ChainName) {
        this.signer = signer
        this.networkName = network ?? 'Ethereum'
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
        let quote = await this.#quoteSwap(tokenIn, tokenOut, amountIn)
        if (quote == undefined) {
            // console.log(`Sushiswap: ${tokenIn.symbol} --> ${tokenOut.symbol} swap is too expensive or is not available`)
            return false
        }
        try {
            let swapResult = await this.#executeSwap(tokenIn, tokenOut, amountIn, quote)
            if (!swapResult) {
                // console.log(`Sushiswap: ${tokenIn.symbol} --> ${tokenOut.symbol} swap is too expensive or is not available`)
            }
            return swapResult
        } catch (e: any) {
            console.log(c.red(`Sushiswap:swap Swap failed, reason: ${e?.message ?? 'unknown'}`))
            return false
        }
    }
    async #quoteSwap(
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
        let res:
            | {
                  funcName:
                      | 'swapExactETHForTokensSupportingFeeOnTransferTokens'
                      | 'swapExactTokensForETHSupportingFeeOnTransferTokens'
                      | 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
                  path: string[]
                  amountOut: bigint
              }
            | undefined
        res = await retry(
            async () => {
                let routerAddress = sushiswapV2Routers[this.networkName]
                if (routerAddress == undefined || routerAddress == '') {
                    if (DEV) {
                        console.log(`SushiSwap:quoteSwap Sushiswap is not available on ${this.networkName}, can't swap`)
                    }
                    return
                }
                let sushiswapRouter = UniswapV2Router02__factory.connect(routerAddress, this.signer)
                let isTokenInNative = this.#isTokenNative(tokenIn.address)

                let isTokenOutNative = this.#isTokenNative(tokenOut.address)

                if (isTokenInNative && isTokenOutNative) {
                    if (DEV) {
                        console.log('Sushiswap:quoteSwap tokenIn and tokenOut are both native')
                    }
                    return
                }
                let path = this.#buildPath(tokenIn.address, tokenOut.address)
                let amountOut = (await sushiswapRouter.getAmountsOut(amountIn, path))[1]
                let funcName:
                    | 'swapExactETHForTokensSupportingFeeOnTransferTokens'
                    | 'swapExactTokensForETHSupportingFeeOnTransferTokens'
                    | 'swapExactTokensForTokensSupportingFeeOnTransferTokens'

                funcName = isTokenInNative
                    ? 'swapExactETHForTokensSupportingFeeOnTransferTokens'
                    : isTokenOutNative
                    ? 'swapExactTokensForETHSupportingFeeOnTransferTokens'
                    : 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
                return {funcName: funcName, path: path, amountOut: amountOut}
            },
            {maxRetryCount: 3, retryInterval: 10, needLog: false, throwOnError: false}
        )
        return res
    }
    async #executeSwap(
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
        amountIn: bigint,
        quote: {
            funcName:
                | 'swapExactETHForTokensSupportingFeeOnTransferTokens'
                | 'swapExactTokensForETHSupportingFeeOnTransferTokens'
                | 'swapExactTokensForTokensSupportingFeeOnTransferTokens'
            path: string[]
            amountOut: bigint
        }
    ) {
        let routerAddress = sushiswapV2Routers[this.networkName]
        let sushiswapRouter = UniswapV2Router02__factory.connect(routerAddress, this.signer)
        let token = ERC20__factory.connect(tokenIn.address, this.signer)

        let tx = {
            from: this.signer.address,
            to: await token.getAddress(),
            data: token.interface.encodeFunctionData('approve', [await sushiswapRouter.getAddress(), amountIn]),
            value: 0n
        }
        let approvalGasLimit = await estimateTx(this.signer, tx, 1.2) // ~60k
        let swapGasLimit = approvalGasLimit * 35n / 10n // ~120k but lets make it 3x
        let {gasPrice} = await getGwei(this.signer, 1.2)
        let executionCost = (approvalGasLimit + swapGasLimit) * gasPrice
        if (quote.funcName.includes('swapExactTokensForETHSupportingFeeOnTransferTokens')) {
            if (executionCost > quote.amountOut) {
                // console.log(`Sushiswap:executeSwap ${tokenIn.symbol}-->${tokenOut.name} swap cost exceeds received value`)
                return false
            }
        }
        if (!quote.funcName.includes('swapExactETHForTokensSupportingFeeOnTransferTokens')) {
            let approvalHash = await approve(this.signer, tokenIn.address, routerAddress, amountIn, amountIn)
            if (DEV) {
                console.log(
                    c.blue(
                        `Sushiswap:executeSwap ${tokenIn.symbol} approved ${
                            approvalHash == '' ? "don't need approve" : chains[this.networkName].explorer + approvalHash
                        }`
                    )
                )
            }
        }
        let deadline = Math.floor(new Date().getTime() / 1000) + Math.floor(RandomHelpers.getRandomNumber({from: 30 * 60, to: 1 * 60 * 60}))

        let swapTx = {
            from: this.signer.address,
            to: await sushiswapRouter.getAddress(),
            // @ts-ignore
            data: sushiswapRouter.interface.encodeFunctionData(quote.funcName, [
                amountIn,
                (quote.amountOut * 98n) / 100n,
                quote.path,
                this.signer.address,
                deadline
            ]),
            value: this.#isTokenNative(tokenIn.address) ? amountIn : 0n
        }
        let swapHash = await sendTx(this.signer, swapTx, {price: 1.1, limit: 1.1}, true)
        console.log(
            `[Sushiswap]`,
            `$${c.bold(tokenIn.symbol)} --> $${c.bold(tokenOut.symbol)} ${c.green(chains[this.networkName].explorer + swapHash)}`
        )
        return true
    }
    #buildPath(tokenIn: string, tokenOut: string): string[] {
        let token1 = this.#isTokenNative(tokenIn) ? chains[this.networkName].tokens.WNATIVE.address : tokenIn
        let token2 = this.#isTokenNative(tokenOut) ? chains[this.networkName].tokens.WNATIVE.address : tokenOut
        return [token1, token2]
    }
    #isTokenNative(token: string) {
        return (
            token.toLowerCase() == ZeroAddress.toLowerCase() ||
            token.toLowerCase() == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase() ||
            token.toLowerCase() == '0x0000000000000000000000000000000000001010'.toLowerCase() // polygon MATIC address o_0
        )
    }
}

export {Sushiswap}
