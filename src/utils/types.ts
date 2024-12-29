export declare type FeeType = {maxFeePerGas: bigint; maxPriorityFeePerGas: bigint} | {gasPrice: bigint}

export declare type Chain = {
    id: number
    lzId: string
    rpc: string[]
    explorer: string
    currency: {name: string; price?: number}
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
    | 'Nova'

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
    | '!Nova'

export declare type BridgeType = 'Stargate' | 'Relay'

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

export declare type StargateParams =
    | {
          stargatePoolNativeAddress: string
          eid: number
      }
    | undefined

export declare type StargateSendParam = {
    dstEid: number // uint32 Destination endpoint ID.
    to: string // bytes32 Recipient address.
    amountLD: bigint // uint256 Amount to send in local decimals.
    minAmountLD: bigint // uint256 Minimum amount to send in local decimals.
    extraOptions: string // bytes Additional options supplied by the caller to be used in the LayerZero message.
    composeMsg: string // bytes The composed message for the send() operation.
    oftCmd: string // bytes The OFT command to be executed, unused in default OFT implementations.
}
export declare type BusQueueResp =
    | {
          srcEid: number
          dstEid: number
          srcChainKey: string
          dstChainKey: string
          inQueue: boolean
          bus: {
              busId: string
              guid: string
              txHash: string
              timestamp: number
              numPassengers: number
              passengers: {
                  sender: string
                  receiver: string
                  ticketId: string
                  assetId: number
                  asset: string
                  amountSD: string
                  rideStatus: string
                  txHash: string
                  blockNumber: number
                  timestamp: number
                  busFare: string
                  nativeDrop: boolean
                  passengerBytes: string
              }[]
          }
      }[]
    | {
          srcEid: number
          dstEid: number
          srcChainKey: string
          dstChainKey: string
          inQueue: boolean
          queue: {
              currentBusParams: {
                  capacity: number
              }
              passengers: {
                  sender: string
                  receiver: string
                  ticketId: string
                  assetId: number
                  asset: string
                  amountSD: string
                  rideStatus: string
                  txHash: string
                  blockNumber: number
                  timestamp: number
                  busFare: string
                  nativeDrop: boolean
                  passengerBytes: string
              }[]
          }
      }[]
