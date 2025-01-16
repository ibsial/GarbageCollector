import {Wallet} from 'ethers'
import {BridgeConfig} from '../../../config'
import {StargateBridge} from './stargateBridge'
import {RelayBridge} from './relayBridge'
import {c} from '../../utils/helpers'
import {BridgeInterface} from './baseBridgeInterface'

class BridgeFactory extends BridgeConfig {
    getBridge(signer: Wallet): BridgeInterface {
        if (this.bridgeType == 'Stargate') {
            return new StargateBridge(signer)
        } else if (this.bridgeType == 'Relay') {
            return new RelayBridge(signer)
        } else {
            console.log(c.red(`invalid bridge type. Only 'Stargate' and 'Relay' are known`))
            process.exit(1)
        }
    }
}
const bridgeFactory = new BridgeFactory()
export {bridgeFactory}