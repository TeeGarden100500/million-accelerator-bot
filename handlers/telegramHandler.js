const { Telegraf } = require('telegraf');
const { sendAlert } = require('../services/alertService');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Добро пожаловать в Million Accelerator'));
bot.command('ping', (ctx) => ctx.reply('pong'));

function launchBot() {
  bot.launch();
  sendAlert('📢 Бот успешно запущен. Начинаем мониторинг токенов...');
}

module.exports = { launchBot };
