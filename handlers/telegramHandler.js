const { Telegraf } = require('telegraf');
const { sendAlert } = require('../services/alertService');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.start((ctx) => ctx.reply('Добро пожаловать в Million Accelerator'));
bot.command('ping', (ctx) => ctx.reply('pong'));

let isLaunched = false;

async function launchBot(options = {}) {
  if (isLaunched || bot.polling) {
    console.warn('⚠️ Bot already running — skipping launch');
    return;
  }
  try {
    await bot.launch(options);
    isLaunched = true;
    sendAlert('📢 Бот успешно запущен. Начинаем мониторинг токенов...');
  } catch (err) {
    if (
      (err.code === 'ETELEGRAM' && err.response?.error_code === 409) ||
      String(err).includes('409')
    ) {
      console.warn('⚠️ Bot already running — skipping launch');
    } else {
      console.error('Telegram bot launch failed:', err.message);
      throw err;
    }
  }
}

module.exports = { launchBot, bot };
