require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;
const { startErc20Watcher } = require('./handlers/erc20Watcher');
const { launchBot } = require('./handlers/telegramHandler');

// Запуск Telegram-бота
launchBot();

startErc20Watcher();

// Заглушка для Render
app.get('/', (req, res) => {
  res.send('Million Accelerator Bot is running.');
});

app.listen(PORT, () => {
  console.log(`🌐 Dummy server listening on port ${PORT}`);
});
