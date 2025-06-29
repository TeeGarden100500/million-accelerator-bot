const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Добро пожаловать в Million Accelerator'));
bot.command('ping', (ctx) => ctx.reply('pong'));

// Включаем Webhook режим
bot.launch({
  webhook: {
    domain: 'https://million-accelerator-bot.onrender.com',
    port: process.env.PORT || 10000,
  },
});

console.log('🚀 Webhook mode enabled. Bot listening on port', process.env.PORT || 10000);

// Завершаем по сигналу
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
