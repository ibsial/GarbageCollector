export declare type FeeType = {maxFeePerGas: bigint; maxPriorityFeePerGas: bigint} | {gasPrice: bigint}

export declare type Chain = {
    id: number
    lzId: string
    rpc: string[]
    explorer: string
    currency: string
    tokens: {
        [key: string]: {
            name: string
            decimals: bigint
            address: string
        }
    }
    multicall?: string
}

export declare type ChainName =
    | 'Ethereum'
    | 'Arbitrum'
    | 'Optimism'
    | 'Base'
    | 'Linea'
    | 'Zksync'
    | 'Bsc'
    | 'Opbnb'
    | 'Polygon'
    | 'Avalanche'
    | 'Scroll'
    | 'Blast'
    | 'Mantle'
    | 'Gnosis'
    | 'Fantom'
    | 'Celo'
    | 'Core'
    | 'Manta'
    | 'Taiko'
// | 'Zora'

export declare type NotChainName =
    | '!Ethereum'
    | '!Arbitrum'
    | '!Optimism'
    | '!Base'
    | '!Linea'
    | '!Zksync'
    | '!Bsc'
    | '!Opbnb'
    | '!Polygon'
    | '!Avalanche'
    | '!Scroll'
    | '!Blast'
    | '!Mantle'
    | '!Gnosis'
    | '!Fantom'
    | '!Celo'
    | '!Core'
    | '!Manta'
    | '!Taiko'
// | '!Zora'

export declare type TokenlistResp = {
    name: string
    keywords: any
    logoURI: string
    timestamp: string
    version: any
    tokens: {
        chainId: number
        address: string
        name: string
        symbol: string
        decimals: number
        logoURI: string
    }[]
}

export declare type OdosQuoteType = {
    inTokens: string[]
    outTokens: string[]
    inAmounts: string[]
    outAmounts: string[]
    gasEstimate: number
    dataGasEstimate: number
    gweiPerGas: number
    gasEstimateValue: number
    inValues: number[]
    outValues: number[]
    netOutValue: number
    priceImpact: number
    percentDiff: number
    partnerFeePercent: number
    pathId: string
    pathViz?: any
    blockNumber?: number
}
export declare type OdosAssembleType = {
    deprecated?: any
    blockNumber: number
    gasEstimate: number
    gasEstimateValue: number
    inputTokens: {
        tokenAddress: string
        amount: string
    }[]
    outputTokens: {
        tokenAddress: string
        amount: string
    }[]
    netOutValue: number
    outValues: string[]
    transaction: {
        gas?: number
        gasPrice: number
        value: string
        to: string
        from: string
        data: string
        nonce: number
        chainId: number
    }
    simulation: {
        isSuccess: boolean
        amountsOut: number[]
        gasEstimate: number
        simulationError: any
    }
}
