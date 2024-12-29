import {Wallet} from 'ethers'
import {BridgeType, ChainName} from '../../utils/types'

interface BridgeInterface {
    bridgeType: BridgeType
    bridgeSpecificSettings: {[key in BridgeType]: {[key: string]: any}}

    fromNetworks: ChainName[]
    toNetwork: ChainName

    minToBridge: string
    values: {from: string; to: string}
    deductFee: boolean

    signer: Wallet

    /**
     *
     * @returns Has any bridge tx been executed?
     */
    bridge(signer: Wallet, currency: 'ETH', fromNetwork: ChainName, toNetwork: ChainName, value: bigint): Promise<boolean>

    /**
     *
     * @returns bridge fee
     */
    estimateBridgeFee(signer: Wallet, currency: 'ETH', fromNetwork: ChainName, toNetwork: ChainName, value: bigint, additionalParams: any | undefined): Promise<bigint>

    getSendValue(networkName: ChainName): Promise<bigint>
}
export {BridgeInterface}
