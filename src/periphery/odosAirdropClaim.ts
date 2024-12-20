import {Contract, formatUnits, Wallet} from 'ethers'
import {bigintToPrettyStr, c, RandomHelpers, retry} from '../utils/helpers'
import axios, {AxiosError, AxiosInstance} from 'axios'
import {HttpsProxyAgent} from 'https-proxy-agent'
import {getProvider} from './utils'
import {sendTx} from './web3Client'
import {chains} from '../utils/constants'
import {maxRetries} from '../../config'
class OdosClient {
    signer: Wallet
    session: AxiosInstance
    proxies: string[]
    constructor(signer: Wallet, proxies: string[]) {
        this.signer = signer.connect(getProvider('Base'))
        this.proxies = proxies
        let proxy = RandomHelpers.getRandomElementFromArray(proxies)
        if (proxy != undefined) {
            this.session = axios.create({
                httpAgent: new HttpsProxyAgent('http://' + proxy, {timeout: 7000}),
                httpsAgent: new HttpsProxyAgent('http://' + proxy, {timeout: 7000})
            })
        } else {
            this.session = axios.create({})
        }
    }
    async claim() {
        let result: boolean = await retry(
            async () => {
                let agreementSig = await this.signDAOAgreement()
                let claimSig = await this.getAirdropSig()
                if (claimSig == undefined) {
                    return false
                }
                let odos = new Contract(
                    '0x4C8f8055D88705f52c9994969DDe61AB574895a3',
                    [
                        {
                            inputs: [
                                {
                                    components: [
                                        {
                                            internalType: 'address',
                                            name: 'sender',
                                            type: 'address'
                                        },
                                        {
                                            internalType: 'address',
                                            name: 'recipient',
                                            type: 'address'
                                        },
                                        {
                                            internalType: 'address',
                                            name: 'payoutToken',
                                            type: 'address'
                                        },
                                        {
                                            internalType: 'uint256',
                                            name: 'amount',
                                            type: 'uint256'
                                        },
                                        {
                                            internalType: 'uint256',
                                            name: 'nonce',
                                            type: 'uint256'
                                        },
                                        {
                                            internalType: 'uint256',
                                            name: 'deadline',
                                            type: 'uint256'
                                        }
                                    ],
                                    internalType: 'struct Claim',
                                    name: '_claim',
                                    type: 'tuple'
                                },
                                {
                                    components: [
                                        {
                                            internalType: 'address',
                                            name: 'member',
                                            type: 'address'
                                        },
                                        {
                                            internalType: 'string',
                                            name: 'agreement',
                                            type: 'string'
                                        },
                                        {
                                            internalType: 'uint256',
                                            name: 'nonce',
                                            type: 'uint256'
                                        }
                                    ],
                                    internalType: 'struct Registration',
                                    name: '_registration',
                                    type: 'tuple'
                                },
                                {
                                    internalType: 'bytes',
                                    name: '_claimSignature',
                                    type: 'bytes'
                                },
                                {
                                    internalType: 'bytes',
                                    name: '_registrationSignature',
                                    type: 'bytes'
                                }
                            ],
                            name: 'registerAndClaim',
                            outputs: [],
                            stateMutability: 'nonpayable',
                            type: 'function'
                        }
                    ],
                    this.signer
                )
                let txData = odos.interface.encodeFunctionData('registerAndClaim', [
                    {
                        sender: this.signer.address,
                        recipient: this.signer.address,
                        payoutToken: claimSig.data.claim.payoutToken,
                        amount: claimSig.data.claim.amount,
                        nonce: claimSig.data.claim.nonce,
                        deadline: claimSig.data.claim.deadline
                    },
                    {
                        member: this.signer.address,
                        agreement: `By signing this, you agree to be bound by the terms set forth in the Odos DAO LLC Amended and Restated Operating Agreement (as amended from time to time), available at: https://docs.odos.xyz/home/dao/operating-agreement.`,
                        nonce: 0
                    },
                    claimSig.data.signature,
                    agreementSig
                ])
                let hash = await sendTx(this.signer, {data: txData, to: '0x4C8f8055D88705f52c9994969DDe61AB574895a3'})
                console.log(
                    c.green(`[odos claimer] claimed ${bigintToPrettyStr(BigInt(claimSig.data.claim.amount), 18n, 4)}`),
                    chains['Base'].explorer + hash
                )
                return true
            },
            {maxRetryCount: maxRetries, retryInterval: 10, throwOnError: false}
        )
        if (result == undefined) {
            return false
        }
        return result
    }
    async login() {
        let loginMsg = this.getLoginMesage()
        let sig = await this.signer.signMessage(loginMsg)
        let resp = await this.session.post('https://api.odos.xyz/user/login', {
            signInMessage: loginMsg,
            signature: sig
        })
        this.session.defaults.headers.common['Authorization'] = `Bearer ${resp.data.token}`
    }

    getLoginMesage() {
        let currentTimestamp = () => new Date().toISOString()
        const getNonce = () => {
            const length = 16
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            let result = ''

            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * characters.length)
                result += characters[randomIndex]
            }

            return result
        }
        let odosMsg = `https://app.odos.xyz wants you to sign in with your Ethereum account:\n${
            this.signer.address
        }\n\nSign in with Ethereum on Odos. This is NOT a transaction and does NOT give Odos or anyone else permission to send transactions or interact with your assets. By signing in, you accept all terms at https://docs.odos.xyz/resources/policies/terms-of-use\n\nURI: https://app.odos.xyz\nVersion: 1\nChain ID: 42161\nNonce: ${getNonce()}\nIssued At: ${currentTimestamp()}`
        return odosMsg
    }

    async getAirdropSig() {
        try {
            let url = `https://api.odos.xyz/loyalty/permits/8453/0xca73ed1815e5915489570014e024b7EbE65dE679/${this.signer.address}`
            let resp = await this.session.get(url)
            // console.log(resp.data)

            return resp.data as
                | {
                      data: {
                          claim: {
                              sender: string
                              recipient: string
                              payoutToken: string
                              amount: string
                              nonce: number
                              deadline: number
                          }
                          hashedClaim: string
                          messageHash: string
                          signature: string
                      }
                      timestamp: string
                  }
                | undefined
        } catch (e: any) {
            if (e instanceof AxiosError) {
                if (e.response!.data.detail.includes('No available rewards')) {
                    console.log(c.yellow(`[odos claimer] $Odos already claimed`))
                    return undefined
                }
            }
            throw Error('request failed')
        }
    }
    async signDAOAgreement() {
        let eip712Data = {
            domain: {name: 'OdosDaoRegistry', version: '1', chainId: 8453, verifyingContract: '0x8bDA13Bc6DC08d4008C9f3A72C4572C98478502c'},
            types: {
                // EIP712Domain: [
                //     {name: 'name', type: 'string'},
                //     {name: 'version', type: 'string'},
                //     {name: 'chainId', type: 'uint256'},
                //     {name: 'verifyingContract', type: 'address'}
                // ],
                Registration: [
                    {name: 'member', type: 'address'},
                    {name: 'agreement', type: 'string'},
                    {name: 'nonce', type: 'uint256'}
                ]
            },
            primaryType: 'Registration',
            message: {
                member: this.signer.address,
                agreement:
                    'By signing this, you agree to be bound by the terms set forth in the Odos DAO LLC Amended and Restated Operating Agreement (as amended from time to time), available at: https://docs.odos.xyz/home/dao/operating-agreement.',
                nonce: '0'
            }
        }
        let sig = await this.signer.signTypedData(eip712Data.domain, eip712Data.types, eip712Data.message)
        return sig
    }
}

export {OdosClient}
