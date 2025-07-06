const axios = require('axios');
const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');
const { calculateTokenScore } = require('./tokenScoringEngine');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const HISTORY_PATH = path.join(__dirname, '..', '..', 'storage', 'hypeSeen.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read hype history:', err.message);
  }
  return {};
}

function saveHistory(data) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write hype history:', err.message);
  }
}

function computeHypeScore({ mentions = 0, growthRate = 0, toneWeight = 1 }) {
  const raw = mentions * growthRate * toneWeight;
  return Math.max(0, Math.min(10, Number(raw.toFixed(2))));
}

async function fetchHypeData() {
  const url = `https://api.lunarcrush.com/v2?data=assets&interval=1d&key=${process.env.LUNARCRUSH_KEY}`;
  try {
    const res = await axios.get(url);
    const list = Array.isArray(res.data?.data) ? res.data.data : [];
    return list.map((t) => ({
      symbol: t.symbol,
      mentions: Number(t.social_volume || 0),
      growthRate: Number(t.social_volume_change_24h || 0),
      toneWeight: Number(t.average_sentiment || 1),
    }));
  } catch (err) {
    logDebug(`Failed to fetch LunarCrush data: ${err.message}`);
    return [];
  }
}

async function sendToScoringEngine(symbol) {
  try {
    await calculateTokenScore({ symbol });
  } catch (err) {
    logDebug(`Failed to score ${symbol}: ${err.message}`);
  }
}

async function analyzeHype() {
  const data = await fetchHypeData();
  if (!data.length) return;

  const history = loadHistory();
  const now = Date.now();
  const scored = data
    .map((t) => ({ ...t, hype: computeHypeScore(t) }))
    .filter((t) => !history[t.symbol] || now - history[t.symbol] > 24 * 60 * 60 * 1000)
    .sort((a, b) => b.hype - a.hype)
    .slice(0, settings.HYPE_TOP_N);

  if (!scored.length) return;

  let message = '🔎 Hype-обзор:\n';
  scored.forEach((t, idx) => {
    message += `${idx + 1}. $${t.symbol} — Hype Score: ${t.hype}/10\n`;
    history[t.symbol] = now;
    if (t.hype >= settings.HYPE_SCORE_MIN_PRIORITY) {
      sendToScoringEngine(t.symbol);
    }
  });
  message += `Источник: LunarCrush\n→ Рассмотри анализ этих токенов`;
  logDebug('Sending hype alert');
  await sendTelegramAlert(message);
  saveHistory(history);
}

function startSentimentHypeScanner() {
  analyzeHype();
  const interval = settings.HYPE_REFRESH_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(analyzeHype, interval);
}

module.exports = { startSentimentHypeScanner, computeHypeScore };
