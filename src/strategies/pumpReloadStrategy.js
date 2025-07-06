const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const WATCHLIST_PATH = path.join(__dirname, '..', '..', 'data', 'pumpWatchlist.json');

function loadWatchlist() {
  try {
    if (fs.existsSync(WATCHLIST_PATH)) {
      return JSON.parse(fs.readFileSync(WATCHLIST_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read pump watchlist:', err.message);
  }
  return {};
}

function saveWatchlist(list) {
  try {
    fs.mkdirSync(path.dirname(WATCHLIST_PATH), { recursive: true });
    fs.writeFileSync(WATCHLIST_PATH, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Failed to write pump watchlist:', err.message);
  }
}

function recordPumpEvent({ symbol, percent, days, price, marketCap }) {
  if (!symbol || !price) return;
  if (marketCap && (marketCap < 10_000_000 || marketCap > 300_000_000)) return;

  const list = loadWatchlist();
  list[symbol] = {
    symbol,
    peakPrice: price,
    lastPrice: price,
    percent,
    days,
    added: Date.now(),
  };
  saveWatchlist(list);

  const msg = `\uD83D\uDE80 $${symbol} вырос на ${percent}% за ${days} дня – сигнал на выход`;
  logDebug(`Pump detected for ${symbol}`);
  sendTelegramAlert(msg);
}

function updatePrice(symbol, price) {
  const list = loadWatchlist();
  const entry = list[symbol];
  if (!entry) return;
  entry.lastPrice = price;
  if (price > entry.peakPrice) entry.peakPrice = price;
  saveWatchlist(list);
}

function hasNegativeNews() {
  // Placeholder stub – integrate with NewsShockResponse if data available
  return false;
}

async function evaluateReloads() {
  const list = loadWatchlist();
  const now = Date.now();
  let updated = false;

  for (const [symbol, entry] of Object.entries(list)) {
    if (now - entry.added > settings.PUMP_RELOAD_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      delete list[symbol];
      updated = true;
      continue;
    }

    const price = entry.lastPrice;
    if (!price || !entry.peakPrice) continue;
    const drop = (entry.peakPrice - price) / entry.peakPrice;
    if (drop >= settings.PUMP_RELOAD_THRESHOLD && !hasNegativeNews(symbol)) {
      const msg =
        `\uD83D\uDD01 Перезаход: $${symbol}\n` +
        `Цена упала на -${Math.round(drop * 100)}% после пампа\n` +
        `\u27A4 Нет негативных новостей\n` +
        `\u27A4 В Discord/DEX активность сохраняется\n` +
        '→ Рассмотри повторный вход на коррекции';
      logDebug(`Reload alert for ${symbol}`);
      await sendTelegramAlert(msg);
      delete list[symbol];
      updated = true;
    }
  }

  if (updated) saveWatchlist(list);
}

function startPumpReloadWatcher() {
  evaluateReloads();
  setInterval(evaluateReloads, 60 * 60 * 1000);
}

module.exports = {
  recordPumpEvent,
  updatePrice,
  evaluateReloads,
  startPumpReloadWatcher,
};
