import {formatEther, parseEther, Wallet} from 'ethers'
import {NativeSenderConfig, sleepBetweenActions} from '../../config'
import {ChainName, NotChainName} from '../utils/types'
import {bigintToPrettyStr, c, defaultSleep, RandomHelpers} from '../utils/helpers'
import {chains} from '../utils/constants'
import {estimateTx, getBalance, getGwei, transfer} from '../periphery/web3Client'
import {getProvider} from '../periphery/utils'

class NativeSender extends NativeSenderConfig {
    signer: Wallet
    receiver: string
    constructor(signer: Wallet, receiver: string) {
        super()
        this.signer = signer
        this.receiver = receiver
        if (receiver == undefined || receiver.match(/(0x)?[a-fA-F0-9]{40}/) == null) {
            console.log(c.red(`${receiver} is not correct! You could've lost it ALL!`))
            throw Error(`${receiver} is not correct! You could've lost it ALL!`)
        }
        this.chainsToExclude = this.chainsToExclude.map((elem) => elem.toLowerCase().trim()) as (ChainName | NotChainName)[]
    }

    async sendNative(): Promise<boolean> {
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

            try {
                let tx = {
                    from: this.signer,
                    to: this.receiver,
                    value: 1n
                }
                let value = await this.getSendValue(networkName)
                if (this.deductFee) {
                    let gasLimit = await estimateTx(this.signer.connect(getProvider(networkName)), tx, 1.1)
                    let {gasPrice} = await getGwei(getProvider(networkName), 1.1)
                    let txCost = gasLimit * gasPrice
                    value = value - txCost
                    if (value < 0n) {
                        console.log(c.red(`Can't send negative value`))
                        return false
                    }
                }
                let sendHash = await transfer(this.signer.connect(getProvider(networkName)), this.receiver, value, undefined, {price: 1, limit: 1})
                console.log(
                    c.green(
                        `${bigintToPrettyStr(value, 18n, 4)} ${chains[networkName].currency.name} sent to ${this.receiver} ${
                            chains[networkName].explorer + sendHash
                        }`
                    )
                )
                await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions))
            } catch (e: any) {
                console.log(e?.message)
                console.log(c.red(`Could not send ${chains[networkName].currency.name} to ${this.receiver}`))
            }
        }
        return true
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

export {NativeSender}
