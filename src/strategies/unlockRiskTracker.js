const axios = require('axios');
const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const SEEN_PATH = path.join(__dirname, '..', '..', 'storage', 'unlocksSeen.json');

function loadSeen() {
  try {
    if (fs.existsSync(SEEN_PATH)) {
      return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read unlock history:', err.message);
  }
  return {};
}

function saveSeen(data) {
  try {
    fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
    fs.writeFileSync(SEEN_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write unlock history:', err.message);
  }
}

async function fetchUpcomingUnlocks() {
  const url = 'https://token.unlocks.app/api/v1/upcoming';
  try {
    const res = await axios.get(url, {
      params: { days: settings.UNLOCK_LOOKAHEAD_DAYS },
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const raw = Array.isArray(res.data?.data) ? res.data.data : res.data || [];
    return raw.map((e) => ({
      id: e.id || `${e.symbol}-${e.date}`,
      symbol: e.symbol || e.token,
      date: e.date || e.timestamp,
      usd: parseFloat(e.usdAmount || e.amountUsd || e.valueUsd || 0),
      percent: parseFloat(e.percent || e.percentOfCirculation || 0),
      source: 'TokenUnlocks',
    }));
  } catch (err) {
    console.error('Failed to fetch unlock info:', err.message);
    return [];
  }
}

function daysUntil(dateStr) {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  return Math.ceil((target - now) / (24 * 60 * 60 * 1000));
}

async function checkUnlocks() {
  const events = await fetchUpcomingUnlocks();
  if (!events.length) return;

  const seen = loadSeen();
  const now = Date.now();
  let updated = false;

  for (const ev of events) {
    if (isNaN(ev.percent) && isNaN(ev.usd)) continue;
    if (
      ev.percent >= settings.UNLOCK_MIN_PERCENT ||
      ev.usd >= settings.UNLOCK_MIN_USD
    ) {
      const last = seen[ev.id] || 0;
      if (now - last >= settings.UNLOCK_SPAM_INTERVAL_HOURS * 60 * 60 * 1000) {
        const days = daysUntil(ev.date);
        const usdFmt = `$${(ev.usd / 1_000_000).toFixed(1)}M`;
        const msg =
          `⚠️ Разлок токена $${ev.symbol} через ${days} дня\n` +
          `Объем: ${usdFmt} (${ev.percent.toFixed(1)}% от циркуляции)\n` +
          `Платформа: ${ev.source}\n` +
          '→ Возможен дамп. Рассмотри фиксацию или отложи покупку.';
        logDebug(`Unlock alert for ${ev.symbol}`);
        await sendTelegramAlert(msg);
        seen[ev.id] = now;
        updated = true;
      }
    }
  }

  if (updated) saveSeen(seen);
}

function startUnlockRiskTracker() {
  checkUnlocks();
  setInterval(checkUnlocks, 6 * 60 * 60 * 1000);
}

module.exports = { startUnlockRiskTracker, fetchUpcomingUnlocks, checkUnlocks };
