require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 10000;
const { startErc20Watcher } = require('./handlers/erc20Watcher');
const { launchBot } = require('./handlers/telegramHandler');
const { startReportScheduler } = require('./reportScheduler');
const { start: startSmartDeploymentManager } = require('./smartDeploymentManager');
const { selectTopTokens, startSelector } = require('./src/monitoring/topTokenSelector');
const { startScheduledTokenScan } = require('./src/services/tokenScanner');

// Запуск Telegram-бота
launchBot();

startErc20Watcher();
startReportScheduler();
startSmartDeploymentManager();

(async () => {
  const tokens = await selectTopTokens();
  if (!tokens.length) {
    console.warn('[INIT] ⚠️ Список токенов пуст.');
  }
  startScheduledTokenScan(tokens);
  startSelector();
})();

// Заглушка для Render
app.get('/', (req, res) => {
  res.send('Million Accelerator Bot is running.');
});

app.listen(PORT, () => {
  console.log(`🌐 Dummy server listening on port ${PORT}`);
});
