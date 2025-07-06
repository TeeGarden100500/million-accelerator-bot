const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { getTokenPrice } = require('../../services/geckoService');
const { fetchTrendingPools } = require('./dexActivityWatcher');
const { fetchUpcomingUnlocks } = require('./unlockRiskTracker');
const { fetchHypeData } = require('./sentimentHypeScanner');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const POSITIONS_PATH = path.join(__dirname, '..', '..', 'data', 'positions.json');

function loadPositions() {
  try {
    const raw = fs.readFileSync(POSITIONS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load positions:', err.message);
    return [];
  }
}

function formatPercent(val) {
  return `${(val * 100).toFixed(0)}%`;
}

function daysUntil(dateStr) {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  return Math.ceil((target - now) / (24 * 60 * 60 * 1000));
}

function classifyRisk({ profit, volumeDown, hypeDown, unlockSoon }) {
  let score = 0;
  if (profit <= -0.25) score += 0.5;
  if (volumeDown) score += 0.2;
  if (hypeDown) score += 0.2;
  if (unlockSoon) score += 0.1;

  const level = score >= 0.6 ? '🔴' : score >= 0.3 ? '🟡' : '🟢';
  return { level, score };
}

function chooseRecommendation({ profit, risk }) {
  if (risk >= settings.PHRB_MAX_RISK) return 'Сократить позицию';
  if (profit >= settings.PHRB_MIN_GAIN_TO_HOLD) return 'Удерживать позицию';
  return 'Усилить позицию';
}

async function generatePortfolioSnapshot() {
  const positions = loadPositions();
  if (!positions.length) return;

  const pools = await fetchTrendingPools();
  const unlocks = await fetchUpcomingUnlocks();
  const hypeList = await fetchHypeData();
  const now = new Date().toUTCString();

  let message = `💼 Portfolio Snapshot (${now})\n`;

  for (const pos of positions) {
    try {
      const price = await getTokenPrice({ symbol: pos.symbol });
      if (!price) continue;

      const profit = (price - pos.entryPrice) / pos.entryPrice;
      const pool = pools.find(
        (p) => p.symbol.toUpperCase() === pos.symbol.toUpperCase(),
      );
      const volumeDown = pool ? pool.volumeRatio < 0 : true;
      const hypeData = hypeList.find(
        (h) => h.symbol.toUpperCase() === pos.symbol.toUpperCase(),
      );
      const hypeDown = hypeData ? hypeData.growthRate < 0 : false;
      const unlock = unlocks.find(
        (u) => u.symbol.toUpperCase() === pos.symbol.toUpperCase(),
      );
      const unlockSoon = unlock ? daysUntil(unlock.date) <= 7 : false;

      const { level, score } = classifyRisk({
        profit,
        volumeDown,
        hypeDown,
        unlockSoon,
      });
      const rec = chooseRecommendation({ profit, risk: score });

      let line = `$${pos.symbol}: ${profit >= 0 ? '+' : ''}${formatPercent(profit)} `;
      line += profit >= 0 ? '📈' : '📉';
      const hypeInfo = hypeData ? (hypeDown ? 'Hype↓' : 'Hype↑') : '';
      const volInfo = volumeDown ? 'Volume↓' : 'Volume↑';
      const unlockInfo = unlockSoon ? 'Unlock⏳' : '';
      const parts = [hypeInfo, volInfo, unlockInfo].filter(Boolean).join(' ');
      if (parts) line += ` | ${parts}`;
      line += ` | ${level}`;
      message += `${line}\n→ ${rec}\n`;
      logDebug(`PHRB ${pos.symbol}: ${rec}`);
    } catch (err) {
      console.error('PHRB error:', err.message);
    }
  }

  await sendTelegramAlert(message.trim());
}

function scheduleSnapshot() {
  const now = new Date();
  const target = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    settings.PHRB_SNAPSHOT_HOUR_UTC,
    0,
    0,
  ));
  if (now >= target) target.setUTCDate(target.getUTCDate() + 1);
  const delay = target.getTime() - now.getTime();
  setTimeout(() => {
    generatePortfolioSnapshot();
    setInterval(generatePortfolioSnapshot, 24 * 60 * 60 * 1000);
  }, delay);
}

function startPortfolioHeatmap() {
  scheduleSnapshot();
}

module.exports = { startPortfolioHeatmap, generatePortfolioSnapshot };
