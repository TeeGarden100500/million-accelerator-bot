const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');
const { getTokenPrice } = require('../../services/geckoService');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const POSITIONS_PATH = path.join(__dirname, '..', '..', 'data', 'positions.json');
const HISTORY_PATH = path.join(__dirname, '..', '..', 'history', 'profitHistory.json');

function loadJson(file, def = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Failed to read ${path.basename(file)}:`, err.message);
  }
  return def;
}

function saveJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Failed to write ${path.basename(file)}:`, err.message);
  }
}

function loadPositions() {
  return loadJson(POSITIONS_PATH);
}

function loadHistory() {
  return loadJson(HISTORY_PATH);
}

function saveHistory(list) {
  saveJson(HISTORY_PATH, list);
}

function formatPercent(num) {
  return `${(num * 100).toFixed(0)}%`;
}

async function createSnapshot() {
  const positions = loadPositions();
  if (!positions.length) return null;

  const tokens = [];
  let total = 0;

  for (const pos of positions) {
    try {
      const price = await getTokenPrice({ symbol: pos.symbol });
      if (!price) continue;
      tokens.push({ symbol: pos.symbol, price, entryPrice: pos.entryPrice });
      total += price;
    } catch (err) {
      console.error(`ProfitTracker price error for ${pos.symbol}:`, err.message);
    }
  }

  const snapshot = {
    timestamp: new Date().toISOString(),
    tokens,
    totalCapitalUSD: total,
    freeCapitalUSD: 0,
  };

  const history = loadHistory();
  history.push(snapshot);
  saveHistory(history);

  return snapshot;
}

function calcGrowth(history, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = history.filter((h) => new Date(h.timestamp).getTime() >= cutoff);
  if (recent.length < 2) return 0;
  const start = recent[0].totalCapitalUSD;
  const end = recent[recent.length - 1].totalCapitalUSD;
  return start ? (end - start) / start : 0;
}

function tokenPerformance(history, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const first = history.find((h) => new Date(h.timestamp).getTime() >= cutoff) || history[0];
  const last = history[history.length - 1];
  if (!first || !last) return [];

  const firstMap = {};
  first.tokens.forEach((t) => {
    firstMap[t.symbol] = t.price;
  });

  const perf = last.tokens.map((t) => {
    const start = firstMap[t.symbol] ?? t.entryPrice;
    const gain = start ? (t.price - start) / start : 0;
    return { symbol: t.symbol, gain };
  });

  return perf.sort((a, b) => b.gain - a.gain);
}

async function generateReport() {
  const history = loadHistory();
  const snapshot = await createSnapshot();
  if (!snapshot) return;

  const fullHistory = [...history, snapshot];

  const gain7 = calcGrowth(fullHistory, 7);
  const gain30 = calcGrowth(fullHistory, 30);
  const gain90 = calcGrowth(fullHistory, 90);

  const perf = tokenPerformance(fullHistory, 30);
  const top = perf.slice(0, settings.PROFIT_TOP_TOKENS);
  const bottom = perf.slice(-settings.PROFIT_BOTTOM_TOKENS).reverse();

  let message = `\uD83D\uDCCA Доходность за 30 дней: ${gain30 >= 0 ? '+' : ''}${formatPercent(gain30)}\n`;
  if (top.length) {
    message += `\uD83D\uDCC8 Лучшие токены: ${top
      .map((t) => `$${t.symbol} (${t.gain >= 0 ? '+' : ''}${formatPercent(t.gain)})`)
      .join(', ')}\n`;
  }
  if (bottom.length) {
    message += `\uD83D\uDCC9 Слабые: ${bottom
      .map((t) => `$${t.symbol} (${t.gain >= 0 ? '+' : ''}${formatPercent(t.gain)})`)
      .join(', ')}`;
  }

  logDebug(`ProfitTracker report:\n${message}`);
  await sendTelegramAlert(message.trim());
}

function scheduleReport() {
  const now = new Date();
  const target = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      settings.PROFIT_TRACKER_HOUR_UTC,
      0,
      0,
    ),
  );
  if (now >= target) target.setUTCDate(target.getUTCDate() + 1);
  const delay = target.getTime() - now.getTime();
  setTimeout(() => {
    generateReport();
    setInterval(generateReport, 24 * 60 * 60 * 1000);
  }, delay);
}

function startProfitTracker() {
  scheduleReport();
}

module.exports = { startProfitTracker, generateReport, createSnapshot };
