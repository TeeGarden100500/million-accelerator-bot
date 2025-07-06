// 🔁 Циклический анализ токенов с логированием и Telegram-оповещением

const defaultTokens = [
  '0xA5E59761eBD4436fa4d20E1A27c8a29FB2471Fc6', // DEGEN
  '0x6982508145454Ce325DdBE47a25d4ec3d2311933', // PEPE
];

const { sendTelegramMessage } = require("../utils/telegram");
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scanToken(token) {
  try {
    console.log(`[SCAN] ▶️ Начинаем анализ токена: ${token}`);
    // Здесь будет логика анализа (эмуляция)
    await delay(1000); // эмуляция работы
    console.log(`[SCAN] ✅ Анализ завершён: ${token}`);
  } catch (err) {
    console.error(`[SCAN ERROR] ❌ Ошибка при анализе токена ${token}: ${err.message}`);
    await sendTelegramMessage(`❌ Ошибка при анализе токена:\n${token}\n\n${err.message}`);
  }
}

async function startScannerLoop(tokens = defaultTokens) {
  if (!tokens.length) {
    console.error('[ERROR] Список токенов пуст. Останавливаем анализ.');
    return;
  }

  console.log('🚀 Запускаем цикл анализа токенов...');
  while (true) {
    for (const token of tokens) {
      await scanToken(token);
      await delay(10000); // 10 секунд между токенами
    }
  }
}

if (require.main === module) {
  startScannerLoop();
}

module.exports = { scanToken, startScannerLoop };
