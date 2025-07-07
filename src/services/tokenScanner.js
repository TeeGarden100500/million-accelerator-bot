// 🔁 Циклический анализ токенов с логированием и Telegram-оповещением

const fs = require('fs');
const path = require('path');

const defaultTokens = [
  '0xA5E59761eBD4436fa4d20E1A27c8a29FB2471Fc6', // DEGEN
  '0x6982508145454Ce325DdBE47a25d4ec3d2311933', // PEPE
];

const { sendTelegramMessage } = require('../utils/telegram');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
const TOP_TOKENS_FILE = path.join(__dirname, '..', '..', 'data', 'top-tokens.json');

function logDebug(msg) {
  if (DEBUG) console.log(`[SCANNER] ${msg}`);
}

function loadTokensFromFile() {
  try {
    const raw = fs.readFileSync(TOP_TOKENS_FILE, 'utf8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || !list.length) {
      logDebug('Файл top-tokens.json пуст.');
      return [];
    }
    return list;
  } catch (err) {
    logDebug(`Не удалось загрузить top-tokens.json: ${err.message}`);
    return [];
  }
}

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

let isScanning = false;

async function startTokenScanCycle(tokens = defaultTokens) {
  if (!tokens.length) {
    console.error('[ERROR] Список токенов пуст. Останавливаем анализ.');
    return;
  }

  console.log('🚀 Запускаем цикл анализа токенов...');
  for (const token of tokens) {
    await scanToken(token);
    await delay(10000); // 10 секунд между токенами
  }
}

function startScheduledTokenScan(initialTokens) {
  console.log('[SCHEDULER] ⏳ Запускаем отложенный анализ токенов...');
  const run = async () => {
    if (isScanning) {
      console.warn('[SCHEDULER] ⚠️ Анализ уже выполняется. Пропускаем запуск.');
      return;
    }

    let tokens = Array.isArray(initialTokens) ? initialTokens : [];
    initialTokens = null;
    if (!tokens.length) {
      tokens = loadTokensFromFile();
      logDebug(`Загружено ${tokens.length} токенов из файла.`);
    }

    if (!tokens.length) {
      console.warn('[SCHEDULER] ⚠️ Пустой список токенов. Пропускаем итерацию.');
      return;
    }

    console.log(`[SCHEDULER] 🔁 Анализируем ${tokens.length} токенов...`);
    isScanning = true;
    try {
      await startTokenScanCycle(tokens);
    } finally {
      isScanning = false;
    }
  };

  run();
  setInterval(run, 5 * 60 * 1000); // каждые 5 минут
}

if (require.main === module) {
  startScheduledTokenScan();
}

module.exports = { scanToken, startTokenScanCycle, startScheduledTokenScan };
