const tokens = ['0x...', '0x...']; // Твой список токенов
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const { sendTelegramMessage } = require('../telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';

function logDebug(message) {
  if (DEBUG) {
    console.log(message);
  }
}

async function scanToken(token) {
  try {
    logDebug(`[SCAN] Начинаем анализ токена: ${token}`);
    // ... логика анализа токена ...
    logDebug(`[SCAN] Успешно завершён анализ токена: ${token}`);
  } catch (err) {
    console.error(`[ERROR] Ошибка при анализе токена ${token}:`, err.message);
    await sendTelegramMessage(`❗️ Ошибка анализа токена: ${token}\n${err.message}`);
  }
}

async function startTokenScanner() {
  if (!tokens.length) {
    console.error('[ERROR] Список токенов пуст. Останавливаем анализ.');
    return;
  }

  while (true) {
    logDebug('🔁 Циклический анализ токенов...');
    for (const token of tokens) {
      await scanToken(token);
      await delay(10000); // Пауза 10 сек между токенами
    }
  }
}

startTokenScanner();
