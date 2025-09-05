import {Contract, formatEther, isAddress, parseEther, Wallet} from 'ethers'
import {estimateTx, getBalance, sendRawTx, sendTx, transfer} from './web3Client'
import {bigintToPrettyStr, c, defaultSleep, RandomHelpers, retry} from '../utils/helpers'
import {maxRetries, BridgeConfig, sleepBetweenActions, minPricePerLineaToSell} from '../../config'
import {getNativeCoinPrice, getProvider} from './utils'
import {L2TokenWithPermit, L2TokenWithPermit__factory, LineaClaim, LineaClaim__factory} from '../../typechain'
import {chains} from '../utils/constants'
import {GarbageCollector} from '../core/garbageCollector'
import {OdosAggregator} from './odosAggregator'

class LineaClaimer {
    index: number | string | undefined
    signer: Wallet
    receiver: string | undefined
    LINEA_TOKEN_ADDRESS = '0x1789e0043623282D5DCc7F213d703C6D8BAfBB04'
    LINEA_CLAIM_ADDRESS = '0x87baa1694381ae3ecae2660d97fe60404080eb64'
    LINEA_TOKEN_CONTRACT: L2TokenWithPermit
    LINEA_CLAIM_CONTRACT: LineaClaim

    claimed: boolean | undefined
    allo: bigint | undefined
    canClaim: boolean | undefined

    constructor(index: number | string | undefined, signer: Wallet, receiver: string | undefined) {
        this.index = index
        this.signer = signer
        this.receiver = receiver
        if (this.signer.provider == null || this.signer.provider == undefined) {
            this.signer = this.signer.connect(getProvider('Linea'))
        }
        this.LINEA_TOKEN_CONTRACT = L2TokenWithPermit__factory.connect(this.LINEA_TOKEN_ADDRESS, this.signer)
        this.LINEA_CLAIM_CONTRACT = LineaClaim__factory.connect(this.LINEA_CLAIM_ADDRESS, this.signer)
    }
    async init() {
        if (this.claimed == undefined) {
            this.claimed = await this.hasClaimed()
        }
        if (this.allo == undefined) {
            this.allo = await this.getAllocation()
        }
        if (this.canClaim == undefined) {
            this.canClaim = await this.claimOpen()
        }
    }
    async claimOpen() {
        let claimContractBalance = await getBalance(this.signer, this.LINEA_CLAIM_ADDRESS, this.LINEA_TOKEN_ADDRESS)
        if (claimContractBalance <= 0n) {
            return false
        }
        return true
    }
    async getAllocation() {
        let allo = await this.LINEA_CLAIM_CONTRACT.calculateAllocation(this.signer.address)
        this.allo = allo
        return allo
    }
    async hasClaimed() {
        let hasClaimed = await this.LINEA_CLAIM_CONTRACT.hasClaimed(this.signer.address)
        this.claimed = hasClaimed
        return hasClaimed
    }
    async claim() {
        if (this.claimed == undefined || this.allo == undefined || this.canClaim == undefined) {
            await this.init()
        }
        if (this.claimed) {
            return false
        }
        if (!this.canClaim) {
            this.print(`Claim is not open yet (No tokens on distributor contract)`, c.yellow)
            return false
        }
        let tx = {
            to: this.LINEA_CLAIM_ADDRESS,
            data: this.LINEA_CLAIM_CONTRACT.interface.encodeFunctionData('claim')
        }
        let hash = await sendTx(this.signer, tx)
        if (hash != '') {
            this.print(`Claimed $Linea: ${chains['Linea'].explorer + hash}`, c.green)
            return true
        }
        return false
    }
    async transfer() {
        let balance: bigint
        if (this.claimed == undefined || this.allo == undefined || this.canClaim == undefined) {
            await this.init()
        }
        if (this.claimed) {
            balance = await getBalance(this.signer, this.signer.address, this.LINEA_TOKEN_ADDRESS)
        } else {
            if (this.allo == undefined) {
                this.allo = await this.getAllocation()
            }
            if (this.allo <= 0n) {
                this.print(`[Transfer] Not eligible`, c.yellow)
                return false
            }
            this.claimed = await this.claim()
            await defaultSleep(RandomHelpers.getRandomNumber({from: 5, to: 15}), false)
            balance = this.allo
        }
        if (!this.claimed) {
            return false
        }
        if (balance <= 0n) {
            this.print(`[Transfer] No $Linea on account`, c.yellow)
            return false
        }
        if (this.receiver == undefined || this.receiver == '' || isAddress(this.receiver)) {
            this.print(`Receiving address is incorrect, cant transfer funds: ${this.receiver}`, c.red)
            return false
        }
        let transferHash = await transfer(this.signer, this.receiver, balance, this.LINEA_TOKEN_ADDRESS)
        if (transferHash != '') {
            this.print(`Sent ${bigintToPrettyStr(balance, 18n, 3)} $Linea to ${this.receiver}: ${chains['Linea'].explorer + transferHash}`, c.red)
            return true
        }
        return false
    }
    async sell(proxies: string[]) {
        if (this.claimed == undefined || this.allo == undefined || this.canClaim == undefined) {
            await this.init()
        }
        let balance = 0n
        if (this.claimed) {
            balance = await getBalance(this.signer, this.signer.address, this.LINEA_TOKEN_ADDRESS)
        } else {
            this.claimed = await this.claim()
            await defaultSleep(RandomHelpers.getRandomNumber({from: 5, to: 15}), false)
        }
        if (!this.claimed) {
            return false
        }
        let odos = new OdosAggregator(this.signer, 'Linea', RandomHelpers.getRandomElementFromArray(proxies ?? []), proxies)
        const lineaToken = {
            address: this.LINEA_TOKEN_ADDRESS,
            name: 'LINEA',
            symbol: 'LINEA',
            decimals: 18n
        }
        const nativeToken = {
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            name: chains['Linea'].currency.name,
            symbol: chains['Linea'].currency.name,
            decimals: 18n
        }
        let quoteResp = await odos.quoteSwap(lineaToken, nativeToken, balance)
        if (quoteResp == undefined) {
            this.print('Could not get qoute from odos', c.red)
            throw Error('Could not get qoute from odos')
        }
        let sumValueIn = quoteResp.inValues.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
        let lineaPrice = sumValueIn / parseFloat((balance / 10n ** 18n).toString())
        if (lineaPrice < parseFloat(minPricePerLineaToSell)) {
            this.print(`Linea price is below set value: ${lineaPrice.toFixed(6)} < ${minPricePerLineaToSell}`, c.yellow)
            throw Error('Linea price is below set value')
        }
        if (sumValueIn * 0.95 < quoteResp.netOutValue) {
            this.print('>5% slippage quote received from odos, trying again', c.red)
            throw Error('>5% slippage quote received from odos')
        }
        this.print(`Received quote from odos, trying to swap ${sumValueIn} of $Linea to ${quoteResp.netOutValue} of $ETH`)
        let result = await odos.executeSwap(lineaToken, nativeToken, quoteResp)
        if (!result) {
            this.print('Swap failed', c.red)
            throw Error('Swap failed')
        }
        return true
    }
    print(text: string, chalk?: (...text: unknown[]) => string) {
        if (chalk != undefined) {
            console.log(c.hex(this.signer.address)(`#${this.index ?? '?'} ${this.signer.address}:`), chalk(text))
        } else {
            console.log(c.hex(this.signer.address)(`#${this.index ?? '?'} ${this.signer.address}:`), text)
        }
    }
}

async function executeClaim(index: string | number, signer: Wallet) {
    let claimer = new LineaClaimer(index, signer, undefined)
    let result: boolean | undefined = await retry(
        async () => {
            await claimer.init()
            let claimed = await claimer.claim()
            return claimed
        },
        {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
    )

    // for sleep delay
    if (result == undefined || result) {
        return true
    } else {
        return false
    }
}
async function executeClaimAndTransfer(index: string | number, signer: Wallet, receiver: string) {
    let claimer = new LineaClaimer(index, signer, receiver)
    let result: boolean | undefined = await retry(
        async () => {
            await claimer.init()
            let claimed = await claimer.claim()
            if (!claimed) {
                claimer.print('Error on claiming tokens', c.red)
                return false
            }
            await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions), false)
            let transferred = await claimer.transfer()
            if (transferred) {
                await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions), false)
            }
            return transferred
        },
        {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
    )

    // for sleep delay
    if (result == undefined || result) {
        return true
    } else {
        return false
    }
}
async function executeClaimAndSell(index: string | number, signer: Wallet, proxies: string[] | undefined) {
    let claimer = new LineaClaimer(index, signer, undefined)
    let result: boolean | undefined = await retry(
        async () => {
            await claimer.init()
            let claimed = await claimer.claim()
            if (!claimed) {
                claimer.print('Error on claiming tokens', c.red)
                return false
            }
            await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions), false)
            let sold = await claimer.sell(proxies ?? [])
            if (sold) {
                await defaultSleep(RandomHelpers.getRandomNumber(sleepBetweenActions), false)
            }
            return sold
        },
        {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
    )

    // for sleep delay
    if (result == undefined || result) {
        return true
    } else {
        return false
    }
}
export {LineaClaimer, executeClaim, executeClaimAndTransfer, executeClaimAndSell}
