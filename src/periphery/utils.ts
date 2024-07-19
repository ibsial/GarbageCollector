import {JsonRpcProvider, Network} from 'ethers'
import {ChainName} from '../utils/types'
import {chains, networkNameToCoingeckoQueryString} from '../utils/constants'
import {RandomHelpers, retry} from '../utils/helpers'
import axios, {AxiosInstance} from 'axios'
import {HttpsProxyAgent} from 'https-proxy-agent'

function getProvider(networkName: ChainName) {
    // TODO: add proxy & make static
    let provider = new JsonRpcProvider(RandomHelpers.getRandomElementFromArray(chains[networkName].rpc), Network.from(chains[networkName].id), {
        staticNetwork: true
    })
    return provider
}
async function getNativeCoinPrice(networkName: ChainName): Promise<number> {
    let price: number | undefined = await retry(
        async () => {
            if (chains[networkName].currency?.price != undefined && chains[networkName].currency?.price != 0) {
                return chains[networkName].currency?.price
            }
            let url = `https://min-api.cryptocompare.com/data/price?fsym=${chains[networkName].currency.name}&tsyms=USD`
            let resp = await axios.get(url)
            let body: {USD: number} = resp.data
            return body.USD
        },
        {maxRetryCount: 3, retryInterval: 10, throwOnError: false}
    )
    if (price == undefined) price = 0
    return price
}
async function getTokenPrices(networkName: ChainName, addresses: string[]): Promise<{[key: string]: number}> {
    let llamaNetworkName: string = networkName
    switch (networkName) {
        case 'Zksync':
            llamaNetworkName = 'era'
            break
        case 'Nova':
            llamaNetworkName = 'arbitrum_nova'
            break
    }
    let prices: {[key: string]: number} | undefined = await retry(
        async () => {
            let url = `https://coins.llama.fi/prices/current/`
            for (let i = 0; i < addresses.length; i++) {
                // generally url looks like https://coins.llama.fi/prices/current/ethereum:0xaddress1,ethereum:0xaddress2
                url += `${llamaNetworkName.toLowerCase()}:${addresses[i]}${i + 1 == addresses.length ? '' : ','}`
            }
            let resp = await axios.get(url)
            let body: {
                // key -- ethereum:0xaddress1
                [key: string]: {
                    decimals: number
                    symbol: string
                    price: number
                    timestamp: number
                    confidence: number
                }
            } = resp.data.coins
            let prices: {[key: string]: number} = {}
            for (let key of Object.keys(body)) {
                prices[key.split(':')[1]] = body[key].price
            }
            return prices
        },
        {maxRetryCount: 3, retryInterval: 5, throwOnError: false}
    )
    if (prices == undefined) prices = {}
    return prices
}
async function checkConnection(proxy?: string) {
    let session: AxiosInstance
    if (proxy) {
        session = axios.create({
            httpAgent: new HttpsProxyAgent(`http://${proxy}`),
            httpsAgent: new HttpsProxyAgent(`http://${proxy}`),
            timeout: 5_000
        })
    } else {
        session = axios.create({timeout: 5_000})
    }
    try {
        let resp = await session.get('https://api.odos.xyz/info/chains')
        return true
    } catch (e: any) {
        return false
    }
}
export {getProvider, getTokenPrices, getNativeCoinPrice, checkConnection}
