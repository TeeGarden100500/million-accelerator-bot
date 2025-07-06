const axios = require('axios');
const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const HISTORY_PATH = path.join(__dirname, '..', '..', 'storage', 'dexSeenTokens.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read dex history:', err.message);
  }
  return {};
}

function saveHistory(history) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Failed to write dex history:', err.message);
  }
}

async function fetchTrendingPools() {
  const url = 'https://www.geckoterminal.com/api/p1/eth/trending_pools';
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = Array.isArray(res.data?.data) ? res.data.data : [];
    return data.map((p) => {
      const attrs = p.attributes || {};
      return {
        symbol: attrs.base_token_symbol || attrs.symbol || 'UNKNOWN',
        volumeRatio: parseFloat(attrs.volume_usd_change || attrs.volume_1h_change || 0),
        liquidityRatio: parseFloat(attrs.liquidity_usd_change || attrs.liquidity_1h_change || 0),
        traders30m: parseInt(attrs.traders_30m || attrs.new_traders || 0, 10),
      };
    });
  } catch (err) {
    console.error('Failed to fetch trending pools:', err.message);
    return [];
  }
}

async function checkDexActivity() {
  const pools = await fetchTrendingPools();
  if (!pools.length) return;

  const history = loadHistory();
  const now = Date.now();
  let updated = false;

  for (const p of pools) {
    if (
      p.volumeRatio >= settings.DEX_VOLUME_THRESHOLD &&
      p.liquidityRatio >= settings.DEX_LIQUIDITY_THRESHOLD &&
      p.traders30m >= settings.DEX_MIN_TRADERS
    ) {
      const last = history[p.symbol] || 0;
      if (now - last >= 6 * 60 * 60 * 1000) {
        const msg =
          `🔥 DEX-активность: $${p.symbol}\n` +
          `Объем: +${(p.volumeRatio * 100).toFixed(0)}% (1ч)\n` +
          `Ликвидность: +${(p.liquidityRatio * 100).toFixed(0)}%\n` +
          `Новых трейдеров: +${p.traders30m}\n` +
          `👉 Проверь график – возможен рост`;
        logDebug(`Alert for ${p.symbol}`);
        await sendTelegramAlert(msg);
        history[p.symbol] = now;
        updated = true;
      }
    }
  }
  if (updated) saveHistory(history);
}

function startDexActivityWatcher() {
  checkDexActivity();
  const interval = settings.DEX_ACTIVITY_INTERVAL_MINUTES * 60 * 1000;
  setInterval(checkDexActivity, interval);
}

module.exports = { startDexActivityWatcher, fetchTrendingPools };
