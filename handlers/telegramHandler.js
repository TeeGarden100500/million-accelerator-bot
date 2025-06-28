const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Базовые команды
bot.start((ctx) => ctx.reply('Добро пожаловать в Million Accelerator'));
bot.command('ping', (ctx) => ctx.reply('pong'));

module.exports = bot;
