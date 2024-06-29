import c from 'chalk'
import {DEV, maxRetries} from '../../config'
import {SingleBar, Presets} from 'cli-progress'
import * as fs from 'fs'
import * as readline from 'readline'
import {once} from 'events'
import {Wallet, formatUnits, isAddress} from 'ethers'

const log = console.log

async function sleep(sec: number) {
    if (sec > 1) {
        sec = Math.round(sec)
    }
    let bar = new SingleBar(
        {
            format: `${c.bgGrey('{bar}')} | ${c.blue('{value}/{total} sec')}`,
            barsize: 80
        },
        Presets.shades_grey
    )
    bar.start(sec, 0)
    for (let i = 0; i < sec; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1 * 1000))
        bar.increment()
    }
    bar.stop()
    process.stdout.clearLine(0)
}
async function defaultSleep(sec: number, needProgress = true) {
    if (needProgress) {
        let newpaste = ['-', `\\`, `|`, `/`]
        for (let i = 0; i < sec * 2; i++) {
            process.stdout.clearLine(0) // clear current text
            process.stdout.cursorTo(0)
            process.stdout.write(`${newpaste[i % 4]}`)
            await new Promise((resolve) => setTimeout(resolve, 500))
        }
        process.stdout.clearLine(0) // clear current text
        process.stdout.cursorTo(0)
        return
    }
    return await new Promise((resolve) => setTimeout(resolve, sec * 1000))
}
async function delayedPrint(paste: string, delay = 0.05) {
    for (let i = 0; i < paste.length; i++) {
        process.stdout.write(paste[i])
        await defaultSleep(delay, false)
    }
}
const retry = async (
    fn: any,
    {maxRetryCount = maxRetries ?? 5, retryInterval = 10, backoff = 1, needLog = true, throwOnError = true},
    ...args: any
): Promise<any> => {
    retryInterval = retryInterval * backoff
    let i = 1
    let lastError
    while (i <= maxRetryCount) {
        try {
            return await fn(...args)
        } catch (e: any) {
            lastError = e
            if (DEV) {
                console.log(e)
            }
            if (needLog) {
                // console.log(e?.message)
                console.log(e?.response?.data)
                console.log(`catched error, retrying... [${i}]`)
            }
            // console.log(c.magenta('if you see this, please contact the author and tell about error above'))
            await defaultSleep(retryInterval, false)
        }
        i++
    }
    if (!throwOnError) return
    throw lastError ?? new Error(`Could not execute ${fn.name} in ${maxRetryCount} tries`)
}

class Random {
    getRandomNumber(tier: {from: number; to: number}, precision = 6): number {
        return Number((Math.random() * (tier.to - tier.from) + tier.from).toFixed(precision))
    }
    getRandomBigInt(tier: {from: bigint; to: bigint}) {
        const delta = tier.to - tier.from
        const randValue = BigInt((Math.random() * 1000).toFixed(0))
        return tier.from + (randValue * delta) / 1000n
    }
    getRandomElementFromArray<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)]
    }
    shuffleArray<T>(oldArray: T[]): T[] {
        let array = oldArray.slice()
        let buf
        for (let i = 0; i < array.length; i++) {
            buf = array[i]
            let randNum = Math.floor(Math.random() * array.length)
            array[i] = array[randNum]
            array[randNum] = buf
        }
        return array
    }
    getRandomStructKey(struct: {[key: string]: any}): string {
        var keys = Object.keys(struct)
        return keys[(keys.length * Math.random()) << 0]
    }
}
function bigintToPrettyStr(value: bigint, decimals = 18n, remainder = 4) {
    return parseFloat(formatUnits(value, decimals)).toFixed(remainder)
}
async function importPrivateData(path: string) {
    let data: string[][] = []
    let instream = fs.createReadStream(path)
    let rl = readline.createInterface(instream)
    rl.on('line', (line) => {
        data.push(line.trim().split(','))
    })
    await once(rl, 'close')
    return data
}
async function importAndValidatePrivateData(path: string, validateAddr: boolean) {
    let intialData = await importPrivateData(path)
    let privates: string[] = []
    let addresses: string[] = []
    for (let i = 0; i < intialData.length; i++) {
        try {
            let signer = new Wallet(intialData[i][0])
        } catch (e: any) {
            console.log(c.red(`INVALID private key #${i + 1}: ${intialData[i][0]}`))
            throw new Error(`INVALID private key #${i + 1}: ${intialData[i][0]}`)
        }
        if (validateAddr) {
            if (intialData[i].length == 1) {
                console.log(c.red(`NO ADDRESS #${i + 1}: ${intialData[i][0]}`))
                throw new Error(`NO ADDRESS #${i + 1}: ${intialData[i][0]}`)
            } else {
                if (!isAddress(intialData[i][1])) {
                    throw new Error(`INVALID ADDRESS #${i + 1}: ${intialData[i][0]}`)
                }
            }
        }
        privates.push(intialData[i][0])
        addresses.push(intialData[i][1] == undefined ? '' : intialData[i][1])
    }
    return [privates, addresses]
}
async function importProxies(path: string) {
    let data: string[] = []
    let instream = fs.createReadStream(path)
    let rl = readline.createInterface(instream)
    rl.on('line', (line) => {
        data.push(line)
    })
    await once(rl, 'close')
    return data
}
function appendToFile(file: string, data: string) {
    fs.appendFileSync(`${file}`, data)
}
function writeToFile(file: string, data: string) {
    fs.writeFileSync(`${file}`, data)
}
const RandomHelpers = new Random()

export {
    c,
    log,
    sleep,
    defaultSleep,
    delayedPrint,
    retry,
    RandomHelpers,
    bigintToPrettyStr,
    importPrivateData,
    importAndValidatePrivateData,
    importProxies,
    appendToFile,
    writeToFile
}
