import {Chain, ChainName, StargateParams} from './types'

export const timeout = 5

export const scenarios = [
    {
        name: `Balance cheker`,
        value: 'Balance cheker'
    },
    {
        name: `Garbage collector`,
        value: 'Garbage collector'
    },
    {
        name: `Garbage collector & native sender`,
        value: 'Garbage collector & native sender'
    },
    {
        name: `Stargate/Relay bridge`,
        value: 'Stargate/Relay bridge'
    },
    {
        name: `Claim linea`,
        value: 'Claim linea'
    },
    {
        name: `Claim and transfer to exch`,
        value: 'Claim and transfer to exch'
    },
    {
        name: `Claim and sell (into ETH)`,
        value: 'Claim and sell'
    }
]
// prettier-ignore
export const sushiswapV2Routers: {[key in ChainName]: string} = {
    Ethereum: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    Arbitrum: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    Optimism: '0x2ABf469074dc0b54d793850807E6eb5Faf2625b1',
    Base:     '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891',
    Linea:    '0x2ABf469074dc0b54d793850807E6eb5Faf2625b1',
    Zksync:   '',
    Bsc:      '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    Opbnb:    '',
    Polygon:  '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    Avalanche:'0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    Scroll:   '0x9B3336186a38E1b6c21955d112dbb0343Ee061eE',
    Blast:    '0x54CF3d259a06601b5bC45F61A16443ed5404DD64',
    Mantle:   '',
    Gnosis:   '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    Fantom:   '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    Celo:     '0x1421bDe4B10e8dd459b3BCb598810B1337D56842', // router exists, butthey have no WTOKEN. No idea why..
    Core:     '0x9B3336186a38E1b6c21955d112dbb0343Ee061eE',
    Manta:    '',
    Taiko:    '',
    // Zora:     '',
    Nova: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
}
// prettier-ignore
export const stargateParams: {[key in ChainName]: StargateParams} = {
    Ethereum: {stargatePoolNativeAddress: '0x77b2043768d28E9C9aB44E1aBfC95944bcE57931', eid: 30101},
    Arbitrum: {stargatePoolNativeAddress: '0xA45B5130f36CDcA45667738e2a258AB09f4A5f7F', eid: 30110},
    Optimism: {stargatePoolNativeAddress: '0xe8CDF27AcD73a434D661C84887215F7598e7d0d3', eid: 30111},
    Base:     {stargatePoolNativeAddress: '0xdc181Bd607330aeeBEF6ea62e03e5e1Fb4B6F7C7', eid: 30184},
    Linea:    {stargatePoolNativeAddress: '0x81F6138153d473E8c5EcebD3DC8Cd4903506B075', eid: 30183},
    Zksync:   undefined,
    Bsc:      undefined,
    Opbnb:    undefined,
    Polygon:  undefined,
    Avalanche:undefined,
    Scroll:   {stargatePoolNativeAddress: '0xC2b638Cb5042c1B3c5d5C969361fB50569840583', eid: 30214},
    Blast:    undefined,
    Mantle:   undefined,
    Gnosis:   undefined,
    Fantom:   undefined,
    Celo:     undefined,
    Core:     undefined,
    Manta:    undefined,
    Taiko:    undefined,
    // Zora:     undefined,
    Nova:     undefined
}
export const networkNameToCoingeckoQueryString: {[key in ChainName]: string} = {
    Ethereum: 'ethereum',
    Arbitrum: 'arbitrum-one',
    Optimism: 'optimistic-ethereum',
    Base: 'base',
    Linea: 'linea',
    Zksync: 'zksync',
    Bsc: 'binance-smart-chain',
    Opbnb: 'opbnb',
    Polygon: 'polygon-pos',
    Avalanche: 'avalanche',
    Scroll: 'scroll',
    Blast: 'blast',
    Mantle: 'mantle',
    Gnosis: 'xdai',
    Fantom: 'fantom',
    Celo: 'celo',
    Core: 'core',
    Manta: '',
    Taiko: '',
    // Zora: 'zora',
    Nova: 'arbitrum-nova'
}
export const withdrawNetworks: {[key: string]: {name: string; token: string; fee: string}} = {
    Optimism: {
        name: 'Optimism',
        token: 'ETH',
        fee: '0.00004'
    },
    Arbitrum: {
        name: 'Arbitrum One',
        token: 'ETH',
        fee: '0.0001'
    },
    Linea: {
        name: 'Linea',
        token: 'ETH',
        fee: '0.0002'
    },
    Base: {
        name: 'Base',
        token: 'ETH',
        fee: '0.00004'
    },
    Zksync: {
        name: 'zkSync Era',
        token: 'ETH',
        fee: '0.000041'
    },
    Ethereum: {
        name: 'ERC20',
        token: 'ETH',
        fee: '0.0016'
    }
}

export const chains: {[key: string]: Chain} = {
    Ethereum: {
        id: 1,
        lzId: '101',

        rpc: ['https://ethereum.publicnode.com'],
        explorer: 'https://etherscan.io/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'Ethereum',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Arbitrum: {
        id: 42161,
        lzId: '110',
        rpc: ['https://arbitrum-one.publicnode.com', 'https://arb1.arbitrum.io/rpc'],
        explorer: 'https://arbiscan.io/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'Ethereum',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Optimism: {
        id: 10,
        lzId: '111',
        rpc: ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com'],
        explorer: 'https://optimistic.etherscan.io/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'Ethereum',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0x4200000000000000000000000000000000000006'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Base: {
        id: 8453,
        lzId: '184',
        rpc: ['https://mainnet.base.org'],
        explorer: 'https://basescan.org/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'Ethereum',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0x4200000000000000000000000000000000000006'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Linea: {
        id: 59144,
        lzId: '183',
        rpc: ['https://rpc.linea.build'],
        explorer: 'https://lineascan.build/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'Ethereum',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Zksync: {
        id: 324,
        lzId: '165',
        rpc: ['https://mainnet.era.zksync.io'],
        explorer: 'https://era.zksync.network/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'Ethereum',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'
            }
        },
        multicall: '0xb1F9b5FCD56122CdfD7086e017ec63E50dC075e7'
    },
    Bsc: {
        id: 56,
        lzId: '102',
        rpc: ['https://bsc-dataseed.bnbchain.org'],
        explorer: 'https://bscscan.com/tx/',
        currency: {name: 'BNB'},
        tokens: {
            BNB: {
                name: 'Binance coin',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WBNB',
                decimals: 18n,
                address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Opbnb: {
        id: 204,
        lzId: '202',
        rpc: ['https://opbnb-mainnet-rpc.bnbchain.org'],
        explorer: 'https://opbnbscan.com/tx/',
        currency: {name: 'BNB'},
        tokens: {
            BNB: {
                name: 'Binance coin',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WBNB',
                decimals: 18n,
                address: '0x4200000000000000000000000000000000000006'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Polygon: {
        id: 137,
        lzId: '109',
        rpc: ['https://polygon-rpc.com'],
        explorer: 'https://polygonscan.com/tx/',
        currency: {name: 'MATIC'},
        tokens: {
            MATIC: {
                name: 'MATIC',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WMATIC',
                decimals: 18n,
                address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Avalanche: {
        id: 43114,
        lzId: '106',

        rpc: ['https://avalanche-c-chain-rpc.publicnode.com', 'https://avalanche.drpc.org'],
        explorer: 'https://snowtrace.io/tx/',
        currency: {name: 'AVAX'},
        tokens: {
            AVAX: {
                name: 'AVAX',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WAVAX',
                decimals: 18n,
                address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Scroll: {
        id: 534352,
        lzId: '214',
        rpc: ['https://rpc.scroll.io'],
        explorer: 'https://scrollscan.com/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'Ethereum',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0x5300000000000000000000000000000000000004'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Blast: {
        id: 81457,
        lzId: '243',

        rpc: ['https://rpc.blast.io'],
        explorer: 'https://blastscan.io/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'ETH',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0x4300000000000000000000000000000000000004'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Mantle: {
        id: 5000,
        lzId: '181',
        rpc: ['https://rpc.mantle.xyz'],
        explorer: 'https://mantlescan.info/tx/',
        currency: {name: 'MNT'},
        tokens: {
            MNT: {
                name: 'Mantle',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WMNT',
                decimals: 18n,
                address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Gnosis: {
        id: 100,
        lzId: '145',
        rpc: ['https://rpc.gnosischain.com', 'https://rpc.gnosis.gateway.fm'],
        explorer: 'https://gnosisscan.io/tx/',
        currency: {name: 'xDAI'},
        tokens: {
            xDAI: {
                name: 'xDAI',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WxDAI',
                decimals: 18n,
                address: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Fantom: {
        id: 250,
        lzId: '112',
        rpc: ['https://rpc.fantom.network'],
        explorer: 'https://ftmscan.com/tx/',
        currency: {name: 'FTM'},
        tokens: {
            FTM: {
                name: 'FTM',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WFTM',
                decimals: 18n,
                address: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Celo: {
        id: 42220,
        lzId: '125',
        rpc: ['https://forno.celo.org'],
        explorer: 'https://celoscan.io/tx/',
        currency: {name: 'CELO'},
        tokens: {
            CELO: {
                name: 'Celo',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'Celo',
                decimals: 18n,
                address: '0x471ece3750da237f93b8e339c536989b8978a438' // Celo actually doesn't have wCELO lol
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Core: {
        id: 1116,
        lzId: '153',
        rpc: ['https://rpc.coredao.org'],
        explorer: 'https://scan.coredao.org/tx/',
        currency: {name: 'CORE'},
        tokens: {
            CORE: {
                name: 'Core',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WCORE',
                decimals: 18n,
                address: '0x40375C92d9FAf44d2f9db9Bd9ba41a3317a2404f'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Manta: {
        id: 169,
        lzId: '217',
        rpc: ['https://manta-pacific.drpc.org'],
        explorer: 'https://manta.socialscan.io/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'ETH',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0x0dc808adce2099a9f62aa87d9670745aba741746'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    Taiko: {
        id: 167000,
        lzId: '290',
        rpc: ['https://rpc.taiko.xyz'],
        explorer: 'https://taikoscan.io/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'ETH',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0xA51894664A773981C6C112C43ce576f315d5b1B6'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    // Zora: { // not supported by coingecko xdd
    //     id: 7777777,
    //     lzId: '290',
    //     rpc: ['https://rpc.zora.energy'],
    //     explorer: 'https://zora.superscan.network/tx/',
    //     currency: {name: 'ETH'},
    //     tokens: {
    //         ETH: {
    //             name: 'ETH',
    //             decimals: 18n,
    //             address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    //         }
    //     },
    //     multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    // },
    Nova: {
        id: 42170,
        lzId: '175',
        rpc: ['https://arbitrum-nova-rpc.publicnode.com'],
        explorer: 'https://nova.arbiscan.io/tx/',
        currency: {name: 'ETH'},
        tokens: {
            ETH: {
                name: 'ETH',
                decimals: 18n,
                address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            },
            WNATIVE: {
                name: 'WETH',
                decimals: 18n,
                address: '0xA51894664A773981C6C112C43ce576f315d5b1B6'
            }
        },
        multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    }
}
