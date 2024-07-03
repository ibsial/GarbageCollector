import {ChainName, NotChainName} from './src/utils/types'

export const DEV = false

export const maxRetries = 2
export const shuffleWallets = true

export const goodGwei = 5
export const sleepBetweenActions = {from: 5, to: 60} // secs
export const sleepBetweenAccs = {from: 5 * 60, to: 15 * 60} // secs

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
    chainsToExclude: (ChainName | NotChainName)[] = []
    tokensToIgnore: string[] = [] // token address to ignore
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
    chainsToExclude: (ChainName | NotChainName)[] = ['Ethereum']
    /**
     * You can set value
     * as NUMBER: {from: '0.1', to: '0.11'}
     * as PERCENTAGE: {from: '80%', to: '100%'} (you can also set both 100%)
     */
    values: {from: string; to: string} = {from: '90%', to: '100%'}
    /**
     * If set to *true*, fee will be deducted before transfer: *(Value - Fee)* will be sent
     * If set to *false*, fee wont be deducted before transfer: *(Value)* will be sent
     */
    deductFee: boolean = true
}

export class RelayBridgeConfig {
    /*********************************************************/
    /*********************** CHAIN LIST **********************
        Ethereum | Arbitrum | Optimism |  Base   |   Linea   |  
        Zksync   |          |          |         |           |
        Scroll   |  Blast   |          |         |           |
                 |          |          | Taiko   |           |
    **********************************************************/
    /**
        This module bridges ONLY ETH between ETH-chains
        
        You can set multiple *from* chains and one *to* chain
        
     */
    fromNetworks: ChainName[] = ['Zksync']

    toNetwork: ChainName = 'Linea'
    /**
     * If value will be < than minToBridge, action will be skipped
     */
    minToBridge: string = '0.002'
    /**
     * You can set value
     * as NUMBER: {from: '0.1', to: '0.11'}
     * as PERCENTAGE: {from: '80%', to: '100%'} (you can also set both 100%)
     */
    values: {from: string; to: string} = {from: '95%', to: '100%'}
    /**
     * If set to *true*, fee will be deducted before bridge: *(Value - Fee)* will be sent
     * If set to *false*, fee wont be deducted before bridge: *(Value)* will be sent
     */
    deductFee: boolean = true
}
