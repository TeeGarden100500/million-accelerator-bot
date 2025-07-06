const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');
const { getTokenPrice } = require('../../services/geckoService');
const { fetchTrendingPools } = require('./dexActivityWatcher');
const { fetchUpcomingUnlocks } = require('./unlockRiskTracker');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const POSITIONS_FILE = path.join(__dirname, '..', '..', 'data', 'positions.json');

function loadPositions() {
  try {
    const data = fs.readFileSync(POSITIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read positions:', err.message);
    return [];
  }
}

function daysUntil(dateStr) {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  return Math.ceil((target - now) / (24 * 60 * 60 * 1000));
}

function formatPercent(num) {
  return `${(num * 100).toFixed(0)}%`;
}

function chooseRecommendation({ profit, volumeDown, hasUnlock }) {
  if (hasUnlock || profit <= settings.SPM_PROFIT_THRESHOLD_EXIT) {
    return 'Возможен слив';
  }
  if (profit >= settings.SPM_PROFIT_THRESHOLD_CAUTION && volumeDown) {
    return 'Рассмотри фиксацию прибыли';
  }
  return 'Держать позицию';
}

async function analyzePositions() {
  const positions = loadPositions();
  if (!positions.length) return;

  const pools = await fetchTrendingPools();
  const unlocks = await fetchUpcomingUnlocks();

  for (const pos of positions) {
    try {
      const price = await getTokenPrice({ symbol: pos.symbol });
      if (!price) continue;
      const profit = (price - pos.entryPrice) / pos.entryPrice;
      const pool = pools.find(
        (p) => p.symbol.toUpperCase() === pos.symbol.toUpperCase(),
      );
      const volumeDown = pool ? pool.volumeRatio < 0 : true;
      const unlock = unlocks.find(
        (u) => u.symbol.toUpperCase() === pos.symbol.toUpperCase(),
      );
      const unlockInfo = unlock ? `Unlock через ${daysUntil(unlock.date)} дн` : '';

      const rec = chooseRecommendation({ profit, volumeDown, hasUnlock: !!unlock });
      let message = `📊 Smart-оценка: $${pos.symbol}\n`;
      message += `Текущая прибыль: ${formatPercent(profit)}\n`;
      message += volumeDown ? 'Объём ↓ ' : 'Объём ↑ ';
      if (unlockInfo) message += `/ ${unlockInfo}`;
      message += `\n➤ Рекомендация: ${rec}`;
      logDebug(`SPM ${pos.symbol}: ${rec}`);
      await sendTelegramAlert(message);
    } catch (err) {
      console.error(`SPM error for ${pos.symbol}:`, err.message);
    }
  }
}

function startSmartPositionManager() {
  analyzePositions();
  const ms = settings.SPM_UPDATE_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(analyzePositions, ms);
}

module.exports = { startSmartPositionManager, analyzePositions };
