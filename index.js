require('dotenv').config();
const { sendTelegramMessage } = require('./telegram');
const { analyzeTokens } = require('./monitor');

async function start() {
  await sendTelegramMessage('📡 Million Accelerator запущен. Мониторинг активен.');

  // Запускаем цикл: каждые 5 минут
  setInterval(async () => {
    console.log('🕵️ Анализ токенов...');
    await analyzeTokens();
  }, 5 * 60 * 1000); // 5 минут

  // Первый вызов сразу
  await analyzeTokens();
}

start();
