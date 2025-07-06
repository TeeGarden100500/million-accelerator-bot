const fs = require('fs');
const path = require('path');
const axios = require('axios');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');
const { fetchStakingEarnList } = require('./stakingTracker');
const { fetchTokenList } = require('../../services/geckoService');
const { generateSignal } = require('../signalGenerator');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const HISTORY_PATH = path.join(__dirname, '..', '..', 'storage', 'history.json');
const halvingSchedule = [
  { symbol: 'BTC', name: 'Bitcoin', cgId: 'bitcoin', date: '2028-04-24' },
  { symbol: 'LTC', name: 'Litecoin', cgId: 'litecoin', date: '2027-07-30' },
  { symbol: 'KAS', name: 'Kaspa', cgId: 'kaspa', date: '2025-11-19' },
  { symbol: 'BCH', name: 'Bitcoin Cash', cgId: 'bitcoin-cash', date: '2028-03-18' },
];

function daysUntil(dateStr) {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read history:', err.message);
  }
  return [];
}

async function fetchGenesisDate(id) {
  try {
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`);
    return res.data?.genesis_date || null;
  } catch (err) {
    logDebug(`Failed to fetch genesis date for ${id}: ${err.message}`);
    return null;
  }
}

async function calculateTokenScore(token, context = {}) {
  const { stakingList = [], marketData = [], genesisCache = {}, txHistory = [] } = context;

  let score = 0;
  const reasons = [];

  const halving = halvingSchedule.find((h) => h.symbol === token.symbol);
  if (halving) {
    const days = daysUntil(halving.date);
    if (days < settings.HALVING_ALERT_THRESHOLD_DAYS && days >= 0) {
      score += 20;
      reasons.push(`Halving через ${days} дней (+20)`);
    }
  }

  const staking = stakingList.find((s) => s.symbol === token.symbol);
  if (staking) {
    score += 30;
    reasons.push(`Earn (${staking.type}${staking.apr ? `, ${staking.apr}` : ''}) (+30)`);
  }

  const whale = txHistory.find(
    (h) =>
      h.token === token.symbol &&
      typeof h.usdValue === 'number' &&
      h.usdValue >= 1_000_000,
  );
  if (whale) {
    score += 25;
    reasons.push(`Whale транзакция $${Math.round(whale.usdValue)} (+25)`);
  }

  const market = marketData.find(
    (m) => m.symbol.toUpperCase() === token.symbol.toUpperCase(),
  );
  if (market && market.marketCap && market.marketCap < 200_000_000) {
    score += 10;
    reasons.push('Низкая капа (<200M) (+10)');
  }

  if (market) {
    let genesis = genesisCache[market.id];
    if (!genesis) {
      genesis = await fetchGenesisDate(market.id);
      genesisCache[market.id] = genesis;
    }
    if (genesis) {
      const ageDays = (Date.now() - new Date(genesis).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < 365) {
        score += 10;
        reasons.push('Молодой токен (<1 года) (+10)');
      }
    }
  }

  return { token, score, reasons };
}

async function evaluateTokens() {
  const tokens = JSON.parse(fs.readFileSync(settings.TOKENS_FILE, 'utf8'));
  const stakingList = await fetchStakingEarnList();
  const marketData = await fetchTokenList();
  const txHistory = loadHistory();
  const genesisCache = {};

  const results = [];
  for (const token of tokens) {
    const info = await calculateTokenScore(token, {
      stakingList,
      marketData,
      genesisCache,
      txHistory,
    });
    results.push(info);
    await generateSignal({
      token: token.symbol,
      source: ['TokenScoringEngine'],
      score: info.score,
      reasons: info.reasons,
    });
  }

  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, 5);

  let message = '📊 Топ токены по системе оценки:\n';
  top.forEach((res, idx) => {
    message += `${idx + 1}. $${res.token.symbol} – ${res.score} баллов\n`;
    res.reasons.forEach((r) => {
      message += `   + ${r}\n`;
    });
    message += '\n';
  });

  await sendTelegramAlert(message.trim());
}

function startTokenScoringEngine() {
  evaluateTokens();
  const interval = settings.TOKEN_SCORING_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(evaluateTokens, interval);
}

module.exports = { startTokenScoringEngine, calculateTokenScore };
