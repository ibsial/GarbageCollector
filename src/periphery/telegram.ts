import {telegramConfig} from '../../config'
import axios from 'axios'
import {c} from '../utils/helpers'
class Telegram {
    needBot = true
    token
    id
    message = ``
    BaseUrl = `https://api.telegram.org/bot`
    constructor() {
        this.token = telegramConfig.telegramToken
        this.id = telegramConfig.telegramId
        this.needBot = telegramConfig.need
    }
    symbols(status: 'success' | 'fail' | 'party' | 'alien' | 'clown' | 'robot' | 'bridge' | 'scroll' | 'elixir') {
        switch (status) {
            case 'success':
                return `✅`
            case 'fail':
                return `❌`
            case 'party':
                return `🎉`
            case 'alien':
                return `👾`
            case 'clown':
                return `🤡`
            case 'robot':
                return `🤖`
            case 'bridge':
                return `🌉`
            case 'scroll':
                return `📜`
            case 'elixir':
                return `⚗️`
        }
    }
    applyFormatting(msg: string, formatting: 'normal' | 'bold' | 'italic' | 'strikethrough' | 'spoiler' | 'monospace' | 'url') {
        let formatedMsg
        switch (formatting) {
            case 'normal':
                formatedMsg = msg
                break
            case 'bold':
                formatedMsg = `*${msg}*`
                break
            case 'italic':
                formatedMsg = `_${msg}_`
                break
            case 'strikethrough':
                formatedMsg = `~${msg}~`
                break
            case 'spoiler':
                formatedMsg = `||${msg}||`
                break
            case 'monospace':
                formatedMsg = `\`${msg}\``
                break
            case 'url':
                formatedMsg = '[link]' + `(${msg})`
                break
        }
        return formatedMsg
    }
    addMessage(msg: string, formatting: 'normal' | 'bold' | 'italic' | 'strikethrough' | 'spoiler' | 'monospace' | 'url' = 'normal') {
        if (!this.needBot) {
            return
        }
        this.message = this.message + this.applyFormatting(msg, formatting) + ' \n'
    }
    async sendMessage(message = '', formatting: 'normal' | 'bold' | 'italic' | 'strikethrough' | 'spoiler' | 'monospace' | 'url' = 'normal') {
        if (!this.needBot) {
            return true
        }
        try {
            let resp = await axios.get(this.BaseUrl + `${this.token}/sendMessage`, {
                data: {
                    chat_id: this.id,
                    parse_mode: 'markdown',
                    text: message == '' ? this.message : this.applyFormatting(message, formatting)
                }
            })
        } catch (e: any) {
            console.log(e?.message)
            console.log(c.red(`error on sending telegram paste`))
            return false
        }
        if (message == '') {
            this.message = ''
        }
        return true
    }
}
export const telegram = new Telegram()
