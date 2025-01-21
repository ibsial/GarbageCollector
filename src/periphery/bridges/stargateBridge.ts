import {dataLength, formatEther, parseEther, solidityPacked, TransactionRequest, Wallet, zeroPadValue} from 'ethers'
import {chains, stargateParams} from '../../utils/constants'
import axios from 'axios'
import {estimateTx, getBalance, getGwei, sendRawTx, sendTx} from '../web3Client'
import {bigintToPrettyStr, c, defaultSleep, RandomHelpers, retry} from '../../utils/helpers'
import {maxRetries, BridgeConfig, sleepBetweenActions, DEV} from '../../../config'
import {BusQueueResp, ChainName, StargateSendParam} from '../../utils/types'
import {getProvider} from '../utils'
import {StargatePoolNative__factory} from '../../../typechain'
import {MessagingFeeStructOutput} from '../../../typechain/StargatePoolNative'
import {BridgeInterface} from './baseBridgeInterface'

/*
https://lineascan.build/address/0x81f6138153d473e8c5ecebd3dc8cd4903506b075#code
https://stargateprotocol.gitbook.io/stargate/v2-developer-docs/integrate-with-stargate/estimating-fees
*/
class StargateBridge extends BridgeConfig implements BridgeInterface {
    signer: Wallet
    constructor(signer: Wallet) {
        super()
        this.signer = signer
        const allowedNetworks = Object.keys(stargateParams).filter((elem) => stargateParams[elem as ChainName] != undefined) as ChainName[]

        // basic user input check
        for (let network of this.fromNetworks) {
            if (!allowedNetworks.includes(network)) {
                console.log(c.red(`'${network}' is not allowed by Stargate!`))
                process.exit(1)
            }
        }
        if (!allowedNetworks.includes(this.toNetwork)) {
            console.log(c.red(`'${this.toNetwork}' is not allowed by Stargate!`))
            process.exit(1)
        }
    }
    async #executeBridge(signer: Wallet, currency = 'ETH', fromNetwork: ChainName, toNetwork: ChainName, value: bigint): Promise<boolean> {
        let result: boolean | undefined = await retry(
            async () => {
                // guys help me. Why do i have to do stargateParams[network]! after this check? Is TS just stupid?
                if (stargateParams[fromNetwork] == undefined || stargateParams[toNetwork] == undefined) {
                    return undefined
                }
                if (stargateParams[toNetwork] == undefined || stargateParams[fromNetwork] == undefined) {
                    return undefined
                }
                if (stargateParams[fromNetwork]!.stargatePoolNativeAddress == '' || stargateParams[toNetwork]!.stargatePoolNativeAddress == '') {
                    return undefined
                }

                const payWithZRO = false
                this.signer = signer.connect(getProvider(fromNetwork))
                const stargatePoolNative = StargatePoolNative__factory.connect(stargateParams[fromNetwork]!.stargatePoolNativeAddress, this.signer)

                let sendParam = this.#getSendParam(signer, currency, toNetwork, value)
                let bridgeFee = await this.getLzFee(this.signer, fromNetwork, sendParam, payWithZRO)
                if (bridgeFee == undefined) {
                    console.log(c.red(`[Stargate] Can't estimate LZ fee ${fromNetwork} to ${toNetwork}`))
                    return false
                }
                if (DEV) {
                    console.log(`Lz fee: ${bridgeFee[0]} ${chains[fromNetwork].currency.name}, ${bridgeFee[1]} ZRO`)
                }
                let valueToBridge: bigint
                let valueToBridgeAndLzFee: bigint
                if (payWithZRO) {
                    // TODO: Add ZRO payment
                    valueToBridge = value
                    valueToBridgeAndLzFee = value
                } else {
                    valueToBridge = this.deductFee ? value - bridgeFee[0] : value
                    valueToBridgeAndLzFee = valueToBridge + bridgeFee[0]
                    sendParam.amountLD = valueToBridge
                    sendParam.minAmountLD = (sendParam.amountLD * 995n) / 1000n
                }
                if (valueToBridge <= 0n) {
                    console.log(
                        c.red(
                            `[Stargate] Can't send from ${fromNetwork} to ${toNetwork} ${bigintToPrettyStr(
                                valueToBridge,
                                undefined,
                                6
                            )} ${currency}: Small amount`
                        )
                    )
                    return false
                }

                let tx: TransactionRequest = {
                    to: await stargatePoolNative.getAddress(),
                    data: stargatePoolNative.interface.encodeFunctionData('send', [
                        sendParam, // sendParam
                        {nativeFee: payWithZRO ? 0 : bridgeFee[0], lzTokenFee: payWithZRO ? bridgeFee[1] : 0}, // fee
                        this.signer.address // refund address
                    ]),
                    value: payWithZRO ? valueToBridge : valueToBridgeAndLzFee
                }
                let estimate = await estimateTx(this.signer, tx)
                tx.gasLimit = estimate
                let {gasPrice} = await getGwei(getProvider(fromNetwork), 1.3)
                let cost = (gasPrice * BigInt(estimate) * 15n) / 10n
                if (this.deductFee) {
                    tx.value = (tx.value as bigint) - cost
                    sendParam.amountLD = valueToBridge - cost
                    sendParam.minAmountLD = ((sendParam.amountLD - cost) * 995n) / 1000n
                    tx.data = stargatePoolNative.interface.encodeFunctionData('send', [
                        sendParam, // sendParam
                        {nativeFee: payWithZRO ? 0 : bridgeFee[0], lzTokenFee: payWithZRO ? bridgeFee[1] : 0}, // fee
                        this.signer.address // refund address
                    ])
                }
                if ((tx.value as bigint) <= 0n) {
                    console.log(
                        c.red(
                            `[Stargate] Can't send from ${fromNetwork} to ${toNetwork} ${bigintToPrettyStr(
                                tx.value as bigint,
                                undefined,
                                6
                            )} ${currency}: Value is too small after fee deduction`
                        )
                    )
                    return false
                }

                console.log(
                    c.yellow(
                        `[Stargate ${this.bridgeSpecificSettings.Stargate.mode}] bridging ${bigintToPrettyStr(
                            valueToBridge,
                            undefined,
                            6
                        )} ETH (fee: ${bigintToPrettyStr(payWithZRO ? bridgeFee[1] : bridgeFee[0], undefined, 7)} ${
                            payWithZRO ? 'ZRO' : 'ETH'
                        }) from ${fromNetwork} to ${toNetwork}`
                    )
                )
                let hash = await sendTx(signer, tx, {price: 1.2, limit: 1.2}, true)
                console.log(
                    c.green(
                        `[Stargate] ${formatEther(tx.value as bigint)} ${currency}: ${fromNetwork} --> ${toNetwork} ${
                            chains[fromNetwork].explorer + hash
                        }`
                    )
                )
                if (this.bridgeSpecificSettings.Stargate.mode == 'economy' && this.bridgeSpecificSettings.Stargate.waitBus > 0) {
                    return this.#waitBus(hash)
                }
                return true
            },
            {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
        )
        if (result == undefined) {
            console.log(c.red(`[Stargate] Bridge from ${fromNetwork} to ${toNetwork} failed`))
            return false
        } else {
            return result
        }
    }

    async bridge(signer: Wallet, currency = 'ETH') {
        let networks = RandomHelpers.shuffleArray(this.fromNetworks)
        let hasBridged = false
        for (let i = 0; i < networks.length; i++) {
            let fromNetwork = networks[i] as ChainName
            let toNetwork = this.toNetwork
            // since stargate bridge is good only for eth, require that from user
            if (
                chains[fromNetwork].currency.name.toLowerCase() != currency.toLowerCase() ||
                chains[toNetwork].currency.name.toLowerCase() != currency.toLowerCase()
            ) {
                console.log(
                    '[Stargate]',
                    c.red('You can bridge only ETH on ETH-specific chains.', `${fromNetwork} or ${toNetwork} is not ETH-specific.`)
                )
                return false
            }
            let valueToBridge = await this.getSendValue(fromNetwork)
            if (valueToBridge < 0n) {
                console.log(c.red(`[Stargate] value to bridge must be > 0. Got: ${formatEther(valueToBridge)}`))
                continue
            }
            if (valueToBridge < parseEther(this.minToBridge)) {
                console.log(
                    c.yellow(
                        `[Stargate] value to bridge from ${fromNetwork} is below limit of ${this.minToBridge} ${chains[fromNetwork].currency.name}`
                    )
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

    async #waitBus(hash: string) {
        console.log(`[Stargate] Waiting for a bus driver... (from 5 to 7 min on average)`)
        const url = 'https://d3k4i7b673n27r.cloudfront.net/v1/buses/bus-queue/'
        const maxWaitTime = this.bridgeSpecificSettings.Stargate.waitBus
        const sleepTime = 15
        let timeElapsed = 0
        let status = 'DRIVABLE' // or 'DRIVEN' or 'NOT_DRIVEN'
        while (status == 'DRIVABLE' || status == 'NOT_DRIVEN') {
            if (timeElapsed >= maxWaitTime) {
                process.stdout.clearLine(0) // clear current text
                process.stdout.cursorTo(0)
                console.log(c.blue(`[Stargate] Driver did not arrive in ${Math.floor(maxWaitTime / 60)} min, but bridge could succeed later`))
                return true
            }
            await defaultSleep(sleepTime, false)
            timeElapsed += sleepTime
            let res: BusQueueResp | undefined = await retry(
                async () => {
                    let resp = await axios.get(url + hash)
                    // console.log(resp.data)
                    return resp.data
                },
                {maxRetryCount: 3, retryInterval: 10, needLog: false, errorMessage: '[Stargate] Bus status request failed'}
            )
            if (res == undefined) {
                if (timeElapsed > sleepTime) {
                    process.stdout.clearLine(0) // clear current text
                    process.stdout.cursorTo(0)
                }
                console.log(c.blue(`[Stargate] Could not get bus status, but bridge could succeed anyway`))
                return true
            }
            let body
            if ('bus' in res[0]) {
                body = res[0].bus
            } else {
                body = res[0].queue
            }
            if (body == undefined) {
                if (timeElapsed > maxWaitTime) {
                    process.stdout.clearLine(0) // clear current text
                    process.stdout.cursorTo(0)

                    console.log(c.blue(`[Stargate] Could not get bus status, but bridge could succeed anyway`))
                    return true
                }
                continue
            }
            if (timeElapsed > sleepTime) {
                process.stdout.clearLine(0) // clear current text
                process.stdout.cursorTo(0)
            }
            process.stdout.write(`Passengers count: ${body.passengers.length}`)
            status = body.passengers[0].rideStatus
        }
        process.stdout.clearLine(0) // clear current text
        process.stdout.cursorTo(0)
        console.log(c.green(`[Stargate] Bus waiting finished with status: ${status}`))
        return true
    }
    /**
     * function used "under the hood" since different type is returned
     */
    async getLzFee(signer: Wallet, fromNetwork: ChainName, sendParam: StargateSendParam, payWithZro: boolean = false) {
        let result: MessagingFeeStructOutput | undefined = await retry(
            async () => {
                const stargatePoolNative = StargatePoolNative__factory.connect(stargateParams[fromNetwork]!.stargatePoolNativeAddress, signer)
                let fee = await stargatePoolNative.quoteSend(sendParam, payWithZro)
                return fee
            },
            {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
        )
        return result
    }
    /**
     * Interface-complient function
     */
    async estimateBridgeFee(signer: Wallet, currency: 'ETH', fromNetwork: ChainName, toNetwork: ChainName, value: bigint): Promise<bigint> {
        const sendParam: StargateSendParam = this.#getSendParam(signer, currency, toNetwork, value)
        const payWithZRO = false
        let result: MessagingFeeStructOutput | undefined = await retry(
            async () => {
                const stargatePoolNative = StargatePoolNative__factory.connect(stargateParams[fromNetwork]!.stargatePoolNativeAddress, signer)
                let fee = await stargatePoolNative.quoteSend(sendParam, payWithZRO)
                return fee
            },
            {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
        )
        if (result == undefined) {
            throw Error('[Stargate] Could not estimate bridge fee')
        }
        return result[0]
    }
    #getSendParam(signer: Wallet, currency = 'ETH', toNetwork: ChainName, value: bigint) {
        if (this.bridgeSpecificSettings.Stargate.mode == 'fast') {
            const fastSendParam: StargateSendParam = {
                dstEid: stargateParams[toNetwork]!.eid, // uint32 Destination endpoint ID.
                to: zeroPadValue(signer.address, 32), // bytes32 Recipient address.
                amountLD: value, // uint256 Amount to send in local decimals.
                minAmountLD: (value * 995n) / 1000n, // uint256 Minimum amount to send in local decimals.
                extraOptions: '0x', // bytes Additional options supplied by the caller to be used in the LayerZero message.
                composeMsg: '0x', // bytes The composed message for the send() operation.
                oftCmd: '0x' // bytes The OFT command to be executed, unused in default OFT implementations.
            }
            return fastSendParam
        } else if (this.bridgeSpecificSettings.Stargate.mode == 'economy') {
            const economySendParam: StargateSendParam = {
                dstEid: stargateParams[toNetwork]!.eid, // uint32 Destination endpoint ID.
                to: zeroPadValue(signer.address, 32), // bytes32 Recipient address.
                amountLD: value, // uint256 Amount to send in local decimals.
                minAmountLD: (value * 995n) / 1000n, // uint256 Minimum amount to send in local decimals.
                extraOptions: '0x', // bytes Additional options supplied by the caller to be used in the LayerZero message.
                composeMsg: '0x', // bytes The composed message for the send() operation.
                oftCmd: '0x01' // bytes The OFT command to be executed, unused in default OFT implementations.
            }
            return economySendParam
        } else {
            throw Error(`Unknown Stargate bridge mode ${this.bridgeSpecificSettings.Stargate.mode}. Only 'fast' and 'economy' are known`)
        }
    }
    async getSendValue(networkName: ChainName): Promise<bigint> {
        if (this.values.from.includes('%') && this.values.to.includes('%')) {
            if (parseFloat(this.values.from) < 0 || parseFloat(this.values.to) < 0) {
                console.log(c.red(`Can't pass negative numbers to Stargate bridge`))
                throw Error(`Can't pass negative numbers to Stargate bridge`)
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
            console.log(c.red(`Your "values" in "stargateBridgeConfig" are wrong. Should be *number*, *percentage* or *to leave*`))
            throw Error(`Your "values" in "stargateBridgeConfig" are wrong. Should be *number*, *percentage* or *to leave*`)
        }
    }
}
export {StargateBridge}
