const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const { sendHeartbeat } = require('./utils/moduleMonitor');
const { sendTelegramAlert } = require('./telegram');
const { fetchTokenList } = require('./services/geckoService');
const { getTokenList } = require('./services/realTokenScan');
const settings = require('./config/settings');
const { updatePrice } = require('./src/strategies/pumpReloadStrategy');
const MODULE_NAME = 'signalScanner.js';

const INTERVAL_MS = 60 * 1000; // 1 minute
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let running = false;

async function scanSignals() {
  logDebug('[signalScanner] scanning for signals');
  let tokens = [];
  try {
    tokens = await getTokenList();
  } catch (err) {
    console.error('[signalScanner] failed to get token list:', err.message);
    return;
  }

  if (!tokens.length) {
    logDebug('[signalScanner] no tokens to scan');
    return;
  }

  let marketData = [];
  try {
    marketData = await fetchTokenList();
  } catch (err) {
    console.error('[signalScanner] market data fetch error:', err.message);
  }

  for (const token of tokens) {
    const data = marketData.find(
      (d) => d.symbol && d.symbol.toUpperCase() === token.symbol.toUpperCase()
    );
    if (!data) continue;

    const priceChangePercent = Number(data.change24h) || 0;
    const volumeChangePercent = data.marketCap
      ? Number(((data.volume / data.marketCap) * 100).toFixed(2))
      : 0;

    updatePrice(token.symbol, data.price);

    if (
      priceChangePercent >= settings.PUMP_PROFIT_THRESHOLD_PRICE &&
      volumeChangePercent >= settings.PUMP_PROFIT_THRESHOLD_VOLUME
    ) {
      const text =
        `[\uD83D\uDE80 SIGNAL] Токен: ${token.symbol} (${token.name || token.symbol})\n` +
        `Стратегия: PumpProfitSniper\n` +
        `Краткий совет: Рост цены и объёма, возможен памп`;
      logDebug(`Pump signal for ${token.symbol}`);
      await sendTelegramAlert(text);
    }
  }
}

async function runLoop() {
  while (running) {
    logDebug('[signalScanner] iteration start');
    try {
      await scanSignals();
      logDebug('[signalScanner] iteration complete');
    } catch (err) {
      console.error('[signalScanner] scan error:', err.message);
    }
    sendHeartbeat(MODULE_NAME);
    if (!running) break;
    await delay(INTERVAL_MS);
  }
  logDebug('[signalScanner] loop stopped');
}

function startSignalScanner() {
  if (running) return;
  running = true;
  logDebug('[signalScanner] started');
  sendHeartbeat(MODULE_NAME);
  runLoop();
}

function stopSignalScanner() {
  running = false;
  logDebug('[signalScanner] stopping...');
}

process.on('uncaughtException', err => {
  console.error('[signalScanner] uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', err => {
  console.error('[signalScanner] unhandled rejection:', err);
  process.exit(1);
});

if (require.main === module) {
  startSignalScanner();
  process.on('SIGINT', () => {
    stopSignalScanner();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopSignalScanner();
    process.exit(0);
  });
}

module.exports = { startSignalScanner, stopSignalScanner };
