import select from '@inquirer/select'
import { scenarios } from '../utils/constants'

class Menu {
    async chooseTask() {
        const questions = {
            name: 'mode',
            type: 'list',
            message: `Choose task`,
            choices: scenarios,
            default: 'Balance cheker',
            loop: true
        }
        if (questions.choices.length < 2) {
            return questions.choices[0].value
        }
        const answers = await select(questions)
        return answers
    }
}

export const menu = new Menu()
