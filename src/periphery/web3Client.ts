import {ERC20__factory, Multicall2, Multicall2__factory, WETH__factory} from '../../typechain'
import {ethers, Wallet, JsonRpcProvider, TransactionRequest, parseUnits, BigNumberish, TransactionResponse, formatEther} from 'ethers'
import {defaultSleep, retry} from '../utils/helpers'
import {DEV, maxRetries} from '../../config'
import {chains} from '../utils/constants'
import {ChainName} from '../utils/types'
import {getProvider} from './utils'

require('dotenv').config()

async function getNativeBalance(signerOrProvider: Wallet | JsonRpcProvider, address: string): Promise<bigint> {
    return signerOrProvider.provider?.getBalance(address)!
}
async function getTokenBalance(signerOrProvider: Wallet | JsonRpcProvider, tokenAddress: string, address: string): Promise<bigint> {
    const tokenContract = ERC20__factory.connect(tokenAddress, signerOrProvider)
    return tokenContract.balanceOf(address)
}
async function getBalance(signerOrProvider: Wallet | JsonRpcProvider, address: string, tokenAddress?: string): Promise<bigint> {
    return retry(
        async () => {
            if (tokenAddress) {
                return getTokenBalance(signerOrProvider, tokenAddress, address)
            } else {
                return getNativeBalance(signerOrProvider, address)
            }
        },
        {maxRetryCount: 20, retryInterval: 10}
    )
}
async function waitBalance(signerOrProvider: Wallet | JsonRpcProvider, address: string, balanceBefore: bigint, tokenAddress?: string) {
    process.stdout.write(`waiting balance`)
    let currentBalance = await getBalance(signerOrProvider, address, tokenAddress)
    while (currentBalance <= balanceBefore) {
        currentBalance = await getBalance(signerOrProvider, address, tokenAddress)
        await defaultSleep(10, false)
    }
    process.stdout.write(` --> received ${formatEther(currentBalance - balanceBefore)}\n`)
    return true
}
async function needApprove(
    signerOrProvider: Wallet | JsonRpcProvider,
    tokenAddress: string,
    from: string,
    to: string,
    minAllowance: BigNumberish
): Promise<boolean> {
    return retry(
        async () => {
            const tokenContract = ERC20__factory.connect(tokenAddress, signerOrProvider)
            let allowance = await tokenContract.allowance(from, to)
            if (DEV) {
                console.log(`allowance:${allowance}, want allowance: ${minAllowance}`)
            }
            if (allowance >= BigInt(minAllowance)) {
                return false
            } else {
                return true
            }
        },
        {maxRetryCount: 20, retryInterval: 10}
    )
}
async function approve(signer: Wallet, tokenAddress: string, to: string, amount: BigNumberish, minAllowance?: BigNumberish) {
    if (minAllowance) {
        let approveRequired = await needApprove(signer, tokenAddress, await signer.getAddress(), to, minAllowance)
        if (!approveRequired) {
            return ''
        }
    }
    const tokenContract = ERC20__factory.connect(tokenAddress, signer)
    let tx = {
        from: await signer.getAddress(),
        to: await tokenContract.getAddress(),
        data: tokenContract.interface.encodeFunctionData('approve', [to, amount])
    }
    return sendTx(signer, tx)
}
async function transfer(
    signer: Wallet,
    to: string,
    amount: BigNumberish,
    tokenAddress?: string,
    gasMultipliers?: {
        price: number
        limit: number
    }
) {
    if (tokenAddress) {
        const tokenContract = ERC20__factory.connect(tokenAddress, signer)
        let tx = {
            from: await signer.getAddress(),
            to: await tokenContract.getAddress(),
            data: tokenContract.interface.encodeFunctionData('transfer', [to, amount])
        }
        return sendTx(signer, tx, gasMultipliers)
    } else {
        let tx = {
            from: await signer.getAddress(),
            to: to,
            value: amount
        }
        return sendTx(signer, tx, gasMultipliers)
    }
}
async function unwrap(
    signer: Wallet,
    wrappedToken: string,
    value?: BigNumberish,
    gasMultipliers?: {
        price: number
        limit: number
    },
    waitConfirmation = true
) {
    let wnative = WETH__factory.connect(wrappedToken, signer)
    return retry(
        async () => {
            let tokenBalance = value ?? (await getBalance(signer, signer.address, wrappedToken))
            let tx = {
                from: signer.address,
                to: await wnative.getAddress(),
                data: wnative.interface.encodeFunctionData('withdraw', [tokenBalance]),
                value: 0n
            }
            return sendTx(signer, tx, gasMultipliers, waitConfirmation)
        },
        {maxRetryCount: 3, retryInterval: 10}
    )
}
async function getGwei(signerOrProvider: Wallet | JsonRpcProvider, multiplier = 1.3): Promise<{gasPrice: bigint}> {
    return retry(
        async () => {
            let fee = await signerOrProvider.provider!.getFeeData()
            if (fee?.gasPrice! != undefined) {
                return {gasPrice: (fee?.gasPrice! * parseUnits(multiplier.toString(), 3)) / 1000n}
            } else {
                return {gasPrice: (fee?.maxFeePerGas! * parseUnits(multiplier.toString(), 3)) / 1000n}
            }
        },
        {maxRetryCount: 20, retryInterval: 10}
    )
}
async function getGasPrice(
    signerOrProvider: Wallet | JsonRpcProvider,
    multiplier = 1.3
): Promise<{maxFeePerGas: bigint; maxPriorityFeePerGas: bigint} | {gasPrice: bigint}> {
    return retry(
        async () => {
            let fee = await signerOrProvider.provider!.getFeeData()
            if (fee.gasPrice !== null) {
                return {gasPrice: (fee?.gasPrice! * parseUnits(multiplier.toString(), 3)) / 1000n}
            } else {
                let maxPriority = fee?.maxPriorityFeePerGas! * parseUnits(multiplier.toString(), 3)
                let maxFee = (fee?.maxFeePerGas! - fee?.maxPriorityFeePerGas!) * parseUnits(multiplier.toString(), 3) + maxPriority
                return {
                    maxFeePerGas: maxFee,
                    maxPriorityFeePerGas: maxPriority
                }
            }
        },
        {maxRetryCount: 20, retryInterval: 10}
    )
}
async function waitGwei(want: number = 40) {
    let signerOrProvider = getProvider('Ethereum')
    let {gasPrice} = await getGwei(signerOrProvider, 1)
    let printed = false
    while ((gasPrice * 95n) / 100n > parseUnits(want.toString(), 'gwei')) {
        if (!printed) {
            console.log(`wait gwei ${new Date().toLocaleString()}`)
            printed = true
        }
        await defaultSleep(60)
        gasPrice = (await getGwei(signerOrProvider, 1)).gasPrice
    }
}
async function getTxStatus(signerOrProvider: Wallet | JsonRpcProvider, hash: string, maxWaitTime = 3 * 60): Promise<string> {
    return retry(
        async () => {
            let time = 0
            while (time < maxWaitTime) {
                let receipt = await signerOrProvider.provider?.getTransactionReceipt(hash)
                if (receipt?.status == 1) {
                    return receipt.hash
                } else if (receipt?.status == 0) {
                    throw new Error('Tx failed')
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 5 * 1000))
                    time += 5
                }
            }
            console.log(`could not get tx status in ${(maxWaitTime / 60).toFixed(1)} minutes`)
            throw new Error('Tx failed or receipt not found')
        },
        {maxRetryCount: 20, retryInterval: 10}
    )
}
async function estimateTx(signer: Wallet, txBody: TransactionRequest, multiplier = 1.3) {
    return retry(
        async () => {
            return ((await signer.estimateGas(txBody)) * parseUnits(multiplier.toString(), 3)) / 1000n
        },
        {maxRetryCount: 3, retryInterval: 10, needLog: false}
    )
}
async function sendTx(signer: Wallet, txBody: TransactionRequest, gasMultipliers = {price: 1.3, limit: 1.3}, waitConfirmation = true) {
    let gasLimit = txBody?.gasLimit ?? (await estimateTx(signer, txBody, gasMultipliers.limit))
    txBody.gasLimit = gasLimit
    if (txBody?.gasPrice == undefined && txBody?.maxFeePerGas == undefined) {
        let fee = await getGasPrice(signer, gasMultipliers.price)
        txBody = {...txBody, ...fee}
    }
    let txReceipt: TransactionResponse = await retry(
        signer.sendTransaction.bind(signer),
        {maxRetryCount: 3, retryInterval: 20, needLog: false},
        txBody
    )
    if (waitConfirmation) {
        return getTxStatus(signer, txReceipt.hash)
    } else {
        return txReceipt.hash
    }
}
async function sendRawTx(signer: Wallet, txBody: TransactionRequest, waitConfirmation = true) {
    let txReceipt: TransactionResponse = await retry(signer.sendTransaction.bind(signer), {maxRetryCount: 3, retryInterval: 20}, txBody)
    if (waitConfirmation) {
        return getTxStatus(signer, txReceipt.hash)
    } else {
        return txReceipt.hash
    }
}

class MultiCall {
    networkName: ChainName
    constructor(networkName?: ChainName) {
        this.networkName = networkName ?? 'Ethereum'
    }
    setNetwork(newNetworkName: ChainName) {
        this.networkName = newNetworkName
        return this
    }
    async callBalance(walletAddress: string, tokens: string[]) {
        let provider = getProvider(this.networkName)
        if (chains[this.networkName]?.multicall != undefined) {
            let balances: {token: string; balance: bigint}[] = []
            let calls: {target: string; callData: string}[] = []
            const multicall = Multicall2__factory.connect(chains[this.networkName].multicall!, provider)
            let iface = ERC20__factory.createInterface()
            const batchSize = 500
            for (let i = 0; i < tokens.length; i++) {
                let token = tokens[i]
                if (token.match(/(0x)?[a-fA-F0-9]{40}/) == null || token.length > 42) {
                    if (DEV) {
                        console.log('cant check ens token:', token)
                    }
                    continue
                }
                if (token.toLowerCase() == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase()) {
                    calls.push({
                        target: await multicall.getAddress(),
                        callData: multicall.interface.encodeFunctionData('getEthBalance', [walletAddress])
                    })
                } else {
                    calls.push({target: token, callData: iface.encodeFunctionData('balanceOf', [walletAddress])})
                }
                if (((i + 1) % batchSize == 0 && i != 0) || i + 1 >= tokens.length) {
                    let res: Multicall2.ResultStructOutput[] = []
                    let retryCount = 0
                    while (retryCount < maxRetries) {
                        try {
                            res = await multicall.tryAggregate.staticCall(false, calls)
                            break
                        } catch (e: any) {
                            await defaultSleep(5, false)
                        }
                        retryCount++
                    }
                    for (let k = 0; k < res.length; k++) {
                        if (!res[k][0]) continue
                        if (res[k][1] == '0x') continue
                        let value = res[k][1]
                        // for some reason multicall sometimes returns too much bytes instead of uint256 and it causes overflow O_o
                        if (value.length > 66) {
                            value = value.slice(0, 66)
                        }
                        if (BigInt(value) > 0n) {
                            balances.push({token: calls[k].target, balance: BigInt(value)})
                        }
                    }

                    calls = []
                    await defaultSleep(0.2, false)
                }
            }
            return balances
        } else {
            let balances: {token: string; balance: bigint}[] = []
            for (let token of tokens) {
                if (token.match(/(0x)?[a-fA-F0-9]{40}/) == null || token.length > 42) {
                    if (DEV) {
                        console.log('cant check ens token:', token)
                    }
                    continue
                }
                if (token.toLowerCase() == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase()) {
                    let balance = await getBalance(provider, walletAddress)
                    if (balance > 0n) balances.push({token: token, balance: balance})
                } else {
                    let balance = await getBalance(provider, walletAddress, token)
                    if (balance > 0n) balances.push({token: token, balance: balance})
                }
                await defaultSleep(0.2, false)
            }
            return balances
        }
    }
    async getTokenInfo(tokens: string[]) {
        let provider = getProvider(this.networkName)

        if (chains[this.networkName]?.multicall != undefined) {
            let data: {address: string; name: string; symbol: string; decimals: bigint}[] = []
            let calls: {target: string; callData: string}[] = []
            const multicall = Multicall2__factory.connect(chains[this.networkName].multicall!, provider)
            let iface = ERC20__factory.createInterface()

            const batchSize = 100
            for (let i = 0; i < tokens.length; i++) {
                let token = tokens[i]
                if (token.match(/(0x)?[a-fA-F0-9]{40}/) == null || token.length > 42) {
                    if (DEV) {
                        console.log('cant check ens token:', token)
                    }
                    continue
                }
                if (token.toLowerCase() == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase()) {
                    continue
                } else {
                    calls.push({target: token, callData: iface.encodeFunctionData('name')})
                    calls.push({target: token, callData: iface.encodeFunctionData('symbol')})
                    calls.push({target: token, callData: iface.encodeFunctionData('decimals')})
                }
                if (((i + 1) % batchSize == 0 && i != 0) || i + 1 >= tokens.length) {
                    let res: Multicall2.ResultStructOutput[] = []
                    let retryCount = 0
                    while (retryCount < maxRetries) {
                        try {
                            res = await multicall.tryAggregate.staticCall(false, calls)
                            break
                        } catch (e: any) {
                            await defaultSleep(5, false)
                        }
                    }
                    for (let k = 0; k < res.length; k += 3) {
                        if (!res[k][0] || !res[k + 1][0] || !res[k + 2][0]) continue
                        // for some reason multicall sometimes returns too much bytes instead of uint256 and it causes overflow O_o
                        let decimals = res[k + 2][1]
                        if (decimals.length > 66) {
                            decimals = decimals.slice(0, 66)
                        }
                        data.push({
                            address: calls[k].target,
                            name: iface.decodeFunctionResult('name', res[k][1])[0],
                            symbol: iface.decodeFunctionResult('symbol', res[k + 1][1])[0],
                            decimals: BigInt(decimals)
                        })
                    }

                    calls = []
                    await defaultSleep(0.2)
                }
            }
            return data
        } else {
            let data: {address: string; name: string; symbol: string; decimals: bigint}[] = []
            for (let token of tokens) {
                if (token.match(/(0x)?[a-fA-F0-9]{40}/) == null || token.length > 42) {
                    if (DEV) {
                        console.log('cant check ens token:', token)
                    }
                    continue
                }
                if (token.toLowerCase() == '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase()) {
                    continue
                } else {
                    let erc20 = ERC20__factory.connect(token, provider)
                    let name = await erc20.name()
                    let symbol = await erc20.symbol()
                    let decimals = await erc20.decimals()
                    data.push({address: token, name: name, symbol: symbol, decimals: BigInt(decimals)})
                }
                await defaultSleep(0.2, false)
            }
            return data
        }
    }
}
const Multicall = new MultiCall()

export {getGwei, waitGwei, estimateTx, getNativeBalance, getBalance, waitBalance, approve, transfer, unwrap, sendTx, sendRawTx, Multicall}
