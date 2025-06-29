require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 10000;
const { startSafeAlchemyTxWatcher } = require('./src/safeAlchemyTxWatcher');

bot.start((ctx) => ctx.reply('Добро пожаловать в Million Accelerator'));
bot.command('ping', (ctx) => ctx.reply('pong'));

// Запуск Telegram-бота
bot.launch().then(() => {
  console.log('🤖 Telegram bot started');
});

startSafeAlchemyTxWatcher();

// Заглушка для Render
app.get('/', (req, res) => {
  res.send('Million Accelerator Bot is running.');
});

app.listen(PORT, () => {
  console.log(`🌐 Dummy server listening on port ${PORT}`);
});
