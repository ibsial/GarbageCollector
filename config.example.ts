import {BridgeType, ChainName, NotChainName} from './src/utils/types'

export const DEV = false

export const maxRetries = 2
export const shuffleWallets = true

export const goodGwei = 100
export const sleepBetweenActions = {from: 5, to: 60} // secs
export const sleepBetweenAccs = {from: 5 * 60, to: 15 * 60} // secs

// MIN LINEA PRICE FOR SELLING SCENARIO. If it's below configured price -- no tokens will be sold
export const minPricePerLineaToSell = '0.05'

/**
 * THIS MODULE SWAPS ALL SHITCOINS INTO NATIVE COIN
 * First ODOS aggregator is used
 * Then SushiSwap v2 is used (you can disable it by setting 'trySushi = false')
 */
export class GarbageCollectorConfig {
    /*********************************************************/
    /*********************** CHAIN LIST **********************
        Ethereum | Arbitrum | Optimism |  Base   |   Linea   |  
        Zksync   |   Bsc    |  Opbnb   | Polygon | Avalanche |
        Scroll   |  Blast   |  Mantle  | Gnosis  |  Fantom   |
        Nova     |  Taiko   |  Core    |  Manta  |   Celo    |
    **********************************************************/
    /* 
        If you want to run *ALL* chains except for *SOME* of them
            chainsToExclude could look like: ['Ethereum', 'Celo', 'Gnosis', 'Taiko', 'Manta', 'Opbnb', 'Nova']

        If you want to run *ONLY ONE* specific chain
            chainsToExclude could look like: ['!Zksync'] -- this will run Zksync only

        Swaps not supported: Opbnb, Manta, Taiko
    */
    chainsToExclude: (ChainName | NotChainName)[] = ['!Linea']
    tokensToIgnore: string[] = [] // token address to ignore
    tokensToInclude: string[] = [] // tokens to check explicitly
    trySushi = true // true | false
}

export class NativeSenderConfig {
    /*********************************************************/
    /*********************** CHAIN LIST **********************
        Ethereum | Arbitrum | Optimism |  Base   |   Linea   |  
        Zksync   |   Bsc    |  Opbnb   | Polygon | Avalanche |
        Scroll   |  Blast   |  Mantle  | Gnosis  |  Fantom   |
        Nova     |  Taiko   |  Core    |  Manta  |   Celo    |
    **********************************************************/
    /** 
        Since a lot of chains are parsed, we exclude some of them instead of "turning on"
        If you want to run *ALL* chains except for *SOME* of them
            chainsToExclude could look like: ['Ethereum', 'Celo', 'Gnosis', 'Taiko', 'Manta', 'Opbnb', 'Nova']

        If you want to run *ONLY ONE* specific chain
            chainsToExclude could look like: ['!Zksync'] -- this will run Zksync only

        Note: Be careful with 'Gnosis', 'Taiko', 'Manta', 'Opbnb', 'Nova' -- not many exchanges accept their natives
    */
    chainsToExclude: (ChainName | NotChainName)[] = ['!Bsc']

    /**
     * value in *USD*, not in token amount
     * set 0 to disable
     */
    minToSend = '1'
    /**
     * You can set value
     * as NUMBER: {from: '0.1', to: '0.11'}
     * as PERCENTAGE: {from: '80%', to: '100%'} (you can also set both 100%)
     * as NUMBER TO LEAVE: {from: '-0.1', to: '-0.2'} ([-0.1, -0.2] means you'll leave from 0.1 to 0.2 in the wallet)
     */
    values: {from: string; to: string} = {from: '-0.0015', to: '-0.004'}
    /**
     * If set to *true*, fee will be deducted before transfer: *(Value - Fee)* will be sent
     * If set to *false*, fee wont be deducted before transfer: *(Value)* will be sent
     */
    deductFee: boolean = true
}

export class BridgeConfig {
    /** Bridge types: Stargate, Relay **/
    bridgeType: BridgeType = 'Stargate'

    bridgeSpecificSettings = {
        Stargate: {
            mode: 'economy', // "economy" (bus) or "fast" (taxi)
            waitBus: 10 * 60, // 10 min, to disable set 0
            maxFee: '0.0005' // max LZ fee in ETH
        },
        Relay: {}
    }
    /**************************************************************************************/
    /************************************* CHAIN LIST **************************************
     * S = Stargate, R = Relay

        Ethereum (S|R) | Arbitrum (S|R) | Optimism (S|R) |  Base (S|R)   |   Linea (S|R)   |  
        Zksync (_|R)   |                |                |               |                 |
        Scroll (S|R)   |  Blast (_|R)   |                |               |                 |
        Nova (_|R)     |                |                | Taiko (_|R)   |                 |
    ***************************************************************************************/
    /**
        This module bridges ONLY ETH between ETH-chains
        
        You can set multiple *from* chains and one *to* chain
        
     */
    fromNetworks: ChainName[] = ['Arbitrum', 'Base']

    toNetwork: ChainName = 'Linea'
    /**
     * If value will be < than minToBridge, action will be skipped
     */
    minToBridge: string = '0.002'
    /**
     * You can set value
     * as NUMBER: {from: '0.1', to: '0.11'}
     * as PERCENTAGE: {from: '80%', to: '100%'} (you can also set both 100%)
     * as NUMBER TO LEAVE: {from: '-0.1', to: '-0.2'} ([-0.1, -0.2] means you'll leave from 0.1 to 0.2 in the wallet)
     * as NUMBER TO HAVE ON DESTINATION: {from: '+0.1', to: '+0.2'} ([+0.1, +0.2] means you'll have at least from 0.1 to 0.2 in destination chain)
     */
    values: {from: string; to: string} = {from: '95%', to: '100%'}
    /**
     * If set to *true*, fee will be deducted before bridge: *(Value - Fee)* will be sent
     * If set to *false*, fee wont be deducted before bridge: *(Value)* will be sent
     */
    deductFee: boolean = true
}
