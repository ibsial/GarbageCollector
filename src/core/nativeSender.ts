import {BigNumberish, formatEther, formatUnits, parseEther, TransactionRequest, Wallet} from 'ethers'
import {DEV, maxRetries, NativeSenderConfig, sleepBetweenActions} from '../../config'
import {ChainName, NotChainName} from '../utils/types'
import {bigintToPrettyStr, c, defaultSleep, RandomHelpers, retry} from '../utils/helpers'
import {chains} from '../utils/constants'
import {estimateTx, getBalance, getGwei, getNativeBalance, Multicall, sendTx, transfer} from '../periphery/web3Client'
import {getNativeCoinPrice, getProvider} from '../periphery/utils'
import {ERC20__factory} from '../../typechain'

class NativeSender extends NativeSenderConfig {
    signer: Wallet
    receiver: string
    constructor(signer: Wallet, receiver: string) {
        super()
        this.signer = signer
        this.receiver = receiver
        if (receiver == undefined || receiver.match(/(0x)?[a-fA-F0-9]{40}/) == null || receiver.length > 42) {
            console.log(c.red(`${receiver} is not correct! You could've lost it ALL!`))
            throw Error(`${receiver} is not correct! You could've lost it ALL!`)
        }
        this.chainsToExclude = this.chainsToExclude.map((elem) => elem.toLowerCase().trim()) as (ChainName | NotChainName)[]
    }

    async sendNative(): Promise<boolean> {
        let anyNativeSent = false
        let networks = RandomHelpers.shuffleArray(Object.keys(chains))
        for (let i = 0; i < networks.length; i++) {
            let networkName = networks[i] as ChainName
            if (this.chainsToExclude.length > 0 && this.chainsToExclude[0].includes('!')) {
                if (!networkName.toLowerCase().includes(this.chainsToExclude[0].split('!')[1])) {
                    continue
                }
            }
            if (this.chainsToExclude.includes(networkName.toLowerCase() as ChainName | NotChainName)) {
                continue
            }
            let devLog = ''
            try {
                let tx: TransactionRequest = {
                    from: this.signer,
                    to: this.receiver,
                    value: 1n
                }
                let value = await this.getSendValue(networkName)
                let nativePrice = await getNativeCoinPrice(networkName)
                let valueInUsd = (value * BigInt(Math.floor(nativePrice * 100_000_000))) / 100_000_000n
                if (nativePrice == 0) {
                    console.log(
                        c.yellow(
                            `[NativeSender in ${networkName}] could not fetch native currency price`
                        )
                    )
                }
                if (parseEther(this.minToSend) > valueInUsd) {
                    console.log(
                        c.yellow(
                            `[NativeSender in ${networkName}] Send value ($${bigintToPrettyStr(valueInUsd, undefined, 4)}) is below $${this.minToSend}`
                        )
                    )
                    continue
                }
                devLog += `value: ${bigintToPrettyStr(value)}\n`
                if (this.deductFee) {
                    let gasLimit = await estimateTx(this.signer.connect(getProvider(networkName)), tx, 1.05)
                    tx.gasLimit = gasLimit
                    let {gasPrice} = await getGwei(getProvider(networkName), 1.3)
                    let txCost = gasLimit * gasPrice
                    value = value - txCost
                    if (value < 0n) {
                        console.log(c.red(`[NativeSender in ${networkName}] Can't send negative value`))
                        continue
                    }
                    devLog += `deducted tx cost: ${bigintToPrettyStr(txCost)} (gasLimit: ${gasLimit} gasPrice: ${formatUnits(gasPrice, 'gwei')}\n`
                }
                let sendHash = await transfer(this.signer.connect(getProvider(networkName)), this.receiver, value, undefined, {price: 1.1, limit: 1})
                console.log(
                    c.green(
                        `[NativeSender in ${networkName}] ${bigintToPrettyStr(value, 18n, 4)} ${chains[networkName].currency.name} sent to ${
                            this.receiver
                        } ${chains[networkName].explorer + sendHash}`
                    )
                )
                await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions))
                anyNativeSent = true
            } catch (e: any) {
                console.log(e?.message)
                console.log(c.red(`[NativeSender in ${networkName}] Could not send ${chains[networkName].currency.name} to ${this.receiver}`))
                if (DEV) {
                    console.log(devLog)
                }
            }
        }
        return anyNativeSent
    }
    async sendToken(networkName: ChainName, tokenAddress: string) {
        let result: boolean = await retry(
            async () => {
                let token = ERC20__factory.connect(tokenAddress, this.signer.connect(getProvider(networkName)))
                let tokenInfo = (await Multicall.setNetwork(networkName).getTokenInfo([tokenAddress]))[0]
                let amount: BigNumberish = await this.getTokenSendValue(networkName, tokenAddress)
                if (amount <= 0n) {
                    return false
                }
                let tx = {data: token.interface.encodeFunctionData('transfer', [this.receiver, amount]), to: tokenAddress}
                let hash = await sendTx(this.signer.connect(getProvider(networkName)), tx)
                console.log(
                    c.green(`[token sender] sent ${bigintToPrettyStr(amount, tokenInfo.decimals, 4)} ${tokenInfo.name} to ${this.receiver}`),
                    chains[networkName].explorer + hash
                )
                return true
            },
            {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
        )
        if (result == undefined) {
            result = false
        }
        return result
    }
    async getSendValue(networkName: ChainName): Promise<bigint> {
        // if (parseFloat(this.values.from) < 0 || parseFloat(this.values.to) < 0) {
        //     console.log(c.red(`Can't pass negative numbers to NativeSender`))
        //     throw Error(`Can't pass negative numbers to NativeSender`)
        // }
        if (this.values.from.includes('%') && this.values.to.includes('%')) {
            let precision = 1000
            let balance = await getBalance(getProvider(networkName), this.signer.address)
            let randomPortion = BigInt(
                (RandomHelpers.getRandomNumber({from: parseFloat(this.values.from), to: parseFloat(this.values.to)}, 3) * precision).toString()
            )
            let value = (balance * randomPortion) / (100n * BigInt(precision))
            return value
        } else if (this.values.from.includes('-') && this.values.to.includes('-')) {
            let balance = await getBalance(getProvider(networkName), this.signer.address)

            let toLeaveFrom = balance - parseEther(this.values.to.replace('-', '')) // balance - max_to_leave
            let toLeaveTo = balance - parseEther(this.values.from.replace('-', '')) // balance - min_to_leave

            let randomValue = BigInt(RandomHelpers.getRandomBigInt({from: toLeaveFrom, to: toLeaveTo}).toString())
            return randomValue
        } else if (
            !this.values.from.includes('%') &&
            !this.values.to.includes('%') &&
            !this.values.from.includes('-') &&
            !this.values.to.includes('-')
        ) {
            let value = parseEther(RandomHelpers.getRandomNumber({from: parseFloat(this.values.from), to: parseFloat(this.values.to)}).toString())
            return value
        } else {
            console.log(c.red(`Your "values" in "NativeSenderConfig" are wrong. Should be *number* or *percentage*`))
            throw Error(`Your "values" in "NativeSenderConfig" are wrong. Should be *number* or *percentage*`)
        }
    }
    async getTokenSendValue(networkName: ChainName, tokenAddress: string): Promise<bigint> {
        let balance = await getBalance(getProvider(networkName), this.signer.address, tokenAddress)
        return balance
    }
}

export {NativeSender}
