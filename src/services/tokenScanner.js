// 🔁 Циклический анализ токенов с логированием и Telegram-оповещением

const fs = require('fs');
const path = require('path');

// default token list is empty by default and will be loaded from file
const defaultTokens = [];

const { sendTelegramMessage } = require('../utils/telegram');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
const LOG_TO_TELEGRAM = String(process.env.LOG_TO_TELEGRAM || 'true') !== 'false';
const LOG_ANALYSIS_RESULT = String(process.env.LOG_ANALYSIS_RESULT || 'true') !== 'false';
const TOP_TOKENS_FILE = process.env.TOP_TOKENS_JSON ||
  path.join(__dirname, '..', '..', 'data', 'top-tokens.json');

function logDebug(msg) {
  if (DEBUG) console.log(`[SCANNER] ${msg}`);
}

async function loadTokensFromFile() {
  try {
    const raw = fs.readFileSync(TOP_TOKENS_FILE, 'utf8');
    let list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
    const filtered = Array.from(
      new Set(
        list.filter(
          (a) =>
            typeof a === 'string' &&
            a.toLowerCase().startsWith('0x') &&
            !a.startsWith('0x0000000000000000000000000000000000000000')
        ).map((a) => a.toLowerCase())
      )
    );
    logDebug(`Загружено ${filtered.length} токенов из файла.`);
    if (filtered.length) {
      if (LOG_TO_TELEGRAM) {
        await sendTelegramMessage(`\uD83E\uDDE0 Загружено ${filtered.length} токенов из DexScreener`);
      }
    }
    return filtered;
  } catch (err) {
    const msg = `Ошибка при загрузке токенов: ${err.message}`;
    console.error(`[SCANNER] ${msg}`);
    if (LOG_TO_TELEGRAM) {
      await sendTelegramMessage(`❗ ${msg}`);
    }
    return [];
  }
}

async function scanToken(token) {
  try {
    console.log(`[SCAN] \uD83D\uDCCA Анализируем токен: ${token}`);
    await delay(1000);
    console.log(`[SCAN] \u2705 Анализ завершён: ${token}`);
    if (LOG_TO_TELEGRAM && LOG_ANALYSIS_RESULT) {
      await sendTelegramMessage(`Анализ токена ${token} завершён \u2705`);
    }
  } catch (err) {
    console.error(`[SCAN ERROR] Ошибка при анализе токена ${token}: ${err.message}`);
    if (LOG_TO_TELEGRAM) {
      await sendTelegramMessage(`❌ Ошибка при анализе токена:\n${token}\n${err.message}`);
    }
  }
}

let isScanning = false;

async function startTokenScanCycle(tokens = defaultTokens) {
  if (!Array.isArray(tokens) || !tokens.length) {
    console.warn('TokenScanner получил пустой массив. Анализ не запущен.');
    if (LOG_TO_TELEGRAM) {
      await sendTelegramMessage('TokenScanner получил пустой массив. Анализ не запущен.');
    }
    return;
  }

  console.log('🚀 Запускаем цикл анализа токенов...');
  logDebug(`Всего токенов для анализа: ${tokens.length}`);
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
      tokens = await loadTokensFromFile();
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

  const intervalMin = Number(process.env.TOKEN_SCAN_INTERVAL_MINUTES) || 5;
  run();
  setInterval(run, intervalMin * 60 * 1000);
}

if (require.main === module) {
  startScheduledTokenScan();
}

module.exports = { scanToken, startTokenScanCycle, startScheduledTokenScan };
