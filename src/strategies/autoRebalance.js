const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');
const { getTokenPrice } = require('../../services/geckoService');
const { fetchUpcomingUnlocks } = require('./unlockRiskTracker');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const POSITIONS_PATH = path.join(__dirname, '..', '..', 'data', 'positions.json');
const SENTIMENT_PATH = path.join(__dirname, '..', '..', 'signals', 'sentimentScanner.json');
const FRESH_IDEAS_PATH = path.join(__dirname, '..', '..', 'signals', 'freshIdeas.json');
const COMBO_PATH = path.join(__dirname, '..', '..', 'logs', 'comboSignals.json');

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

function loadPositions() {
  return loadJson(POSITIONS_PATH);
}

function loadSentiment() {
  return loadJson(SENTIMENT_PATH);
}

function loadFreshIdeas() {
  return loadJson(FRESH_IDEAS_PATH);
}

function loadComboSignals() {
  return loadJson(COMBO_PATH);
}

function formatPercent(num) {
  return `${(num * 100).toFixed(0)}%`;
}

function getRecent(list, symbol, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return list
    .filter((e) => {
      const sym = String(e.symbol || e.token || '').toUpperCase();
      const time = new Date(e.date || e.timestamp || e.time || 0).getTime();
      return sym === symbol.toUpperCase() && !isNaN(time) && time >= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(a.date || a.timestamp || a.time || 0) -
        new Date(b.date || b.timestamp || b.time || 0),
    );
}

function isDeclining(entries, field) {
  if (entries.length < 3) return false;
  let down = 0;
  for (let i = 1; i < entries.length; i += 1) {
    if (Number(entries[i][field]) < Number(entries[i - 1][field])) down += 1;
  }
  return down >= 2;
}

function isRising(entries, field) {
  if (entries.length < 2) return false;
  let up = 0;
  for (let i = 1; i < entries.length; i += 1) {
    if (Number(entries[i][field]) > Number(entries[i - 1][field])) up += 1;
  }
  return up >= 1;
}

function lastSignalDate(list, symbol) {
  const filtered = list.filter(
    (e) =>
      String(e.symbol || e.token || '').toUpperCase() === symbol.toUpperCase(),
  );
  if (!filtered.length) return 0;
  return Math.max(
    ...filtered.map((e) => new Date(e.date || e.timestamp || e.time || 0).getTime()),
  );
}

function daysUntil(dateStr) {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  return Math.ceil((target - now) / (24 * 60 * 60 * 1000));
}

async function hasUnlockSoon(symbol, unlocks) {
  const ev = unlocks.find(
    (u) => String(u.symbol || u.token || '').toUpperCase() === symbol.toUpperCase(),
  );
  return ev ? daysUntil(ev.date) <= 7 : false;
}

function chooseCandidate(fresh, sentiment, combo, unlocks) {
  const all = [...fresh, ...sentiment];
  for (const c of all) {
    const symbol = String(c.symbol || c.token || c).toUpperCase();
    const sentEntries = getRecent(sentiment, symbol, 3);
    if (!isRising(sentEntries, 'hype') || !isRising(sentEntries, 'volume')) continue;
    const lastCombo = lastSignalDate(combo, symbol);
    if (!lastCombo || Date.now() - lastCombo > 3 * 24 * 60 * 60 * 1000) continue;
    if (
      unlocks &&
      unlocks.some(
        (u) =>
          String(u.symbol || u.token || '').toUpperCase() === symbol &&
          daysUntil(u.date) <= 7,
      )
    )
      continue;
    return { symbol };
  }
  return null;
}

async function analyzePortfolio() {
  const positions = loadPositions();
  if (!positions.length) return;

  const sentiment = loadSentiment();
  const ideas = loadFreshIdeas();
  const combo = loadComboSignals();

  let unlocks = [];
  try {
    unlocks = await fetchUpcomingUnlocks();
  } catch (err) {
    logDebug(`Unlock fetch failed: ${err.message}`);
  }

  for (const pos of positions) {
    try {
      const price = await getTokenPrice({ symbol: pos.symbol });
      if (!price) continue;
      const profit = (price - pos.entryPrice) / pos.entryPrice;
      if (profit >= settings.MIN_PROFIT_TO_KEEP) continue;

      const entries = getRecent(sentiment, pos.symbol, 3);
      const hypeDown = isDeclining(entries, 'hype');
      const volDown = isDeclining(entries, 'volume');
      const lastCombo = lastSignalDate(combo, pos.symbol);
      const comboOld =
        !lastCombo ||
        Date.now() - lastCombo > settings.COMBO_SIGNAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      const unlockSoon = await hasUnlockSoon(pos.symbol, unlocks);

      if (hypeDown && volDown && comboOld && !unlockSoon) {
        const candidate = chooseCandidate(ideas, sentiment, combo, unlocks);
        if (candidate) {
          const msg =
            `\u267B\uFE0F Ребалансировка\n` +
            `Токен $${pos.symbol} ослаб: ${formatPercent(profit)} профит, Volume \u2193, Hype \u2193\n` +
            `\u27A4 Рекомендуем: заменить на $${candidate.symbol} (Hype\u2191, combo-сигнал, объём растёт)`;
          logDebug(`AutoRebalance ${pos.symbol} -> ${candidate.symbol}`);
          await sendTelegramAlert(msg);
        }
      }
    } catch (err) {
      console.error(`AutoRebalance error for ${pos.symbol}:`, err.message);
    }
  }
}

function startAutoRebalance() {
  analyzePortfolio();
  const interval = settings.REBALANCE_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(analyzePortfolio, interval);
}

module.exports = { startAutoRebalance, analyzePortfolio };
