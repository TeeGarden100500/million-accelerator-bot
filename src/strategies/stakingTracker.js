const axios = require('axios');
const fs = require('fs');
const path = require('path');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const HISTORY_PATH = path.join(__dirname, '..', '..', 'storage', 'earnHistory.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read earn history:', err.message);
  }
  return [];
}

function saveHistory(data) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write earn history:', err.message);
  }
}

/**
 * Download Binance Earn page and parse available staking products.
 * @returns {Promise<Array<{symbol:string, apr:string, term:string|null, type:string}>>}
 */
async function fetchStakingEarnList() {
  const url = 'https://www.binance.com/en/earn';
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = res.data;
    const list = [];

    const scriptMatch = html.match(/window\.__APP_DATA__\s*=\s*(\{.*?\})\s*;<\/script>/s);
    let json;
    if (scriptMatch) {
      try {
        json = JSON.parse(scriptMatch[1]);
      } catch (err) {
        json = null;
      }
    }

    if (json) {
      const products = JSON.stringify(json);
      const re = /"type":"(Launchpool|Flexible|Locked)"[^\{]*?"asset":"([A-Z0-9]+)"[^\{]*?"apy":"([\d.]+%?)"[^\{]*?(?:"duration":(\d+))?/g;
      let m;
      while ((m = re.exec(products)) !== null) {
        list.push({
          symbol: m[2],
          apr: m[3],
          term: m[4] ? `${m[4]} days` : null,
          type: m[1],
        });
      }
    } else {
      const re = /data-earn-type="(Launchpool|Flexible|Locked)"[^>]*?data-token="([A-Z0-9]+)"[^>]*?data-apr="([\d.]+%?)"(?:[^>]*?data-term="(\d+))?/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        list.push({
          symbol: m[2],
          apr: m[3],
          term: m[4] ? `${m[4]} days` : null,
          type: m[1],
        });
      }
    }

    logDebug(`Fetched ${list.length} staking items`);
    return list;
  } catch (err) {
    console.error('Failed to fetch Earn page:', err.message);
    return [];
  }
}

async function checkForNewEarnTokens() {
  const current = await fetchStakingEarnList();
  if (!current.length) return;

  const history = loadHistory();
  const newEntries = [];

  for (const item of current) {
    const exists = history.some(
      (h) => h.symbol === item.symbol && h.type === item.type
    );
    if (!exists) newEntries.push(item);
  }

  for (const item of newEntries) {
    const msg =
      `\uD83D\uDCB0 \u041D\u043E\u0432\u044B\u0439 \u0442\u043E\u043A\u0435\u043D \u0432 Earn!\n` +
      `\u0422\u043E\u043A\u0435\u043D: $${item.symbol}\n` +
      `Earn: ${item.type} \u043D\u0430 Binance\n` +
      `APR: ${item.apr}\n` +
      (item.term ? `\u23F3 \u0421\u0440\u043E\u043A: ${item.term}\n` : '') +
      `\uD83D\uDCC8 \u0412\u043E\u0437\u043C\u043E\u0436\u0435\u043D \u043F\u0440\u0438\u0442\u043E\u043A \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0430 \u2014 \u0440\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0438\u0442\u0435 \u0434\u043B\u044F \u0440\u0430\u043D\u043D\u0435\u0439 \u043F\u043E\u0437\u0438\u0446\u0438\u0438`;
    await sendTelegramAlert(msg);
    history.push({ symbol: item.symbol, type: item.type });
  }

  if (newEntries.length) saveHistory(history);
}

function startStakingTracker() {
  checkForNewEarnTokens();
  const interval = settings.STAKING_TRACK_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(checkForNewEarnTokens, interval);
}

module.exports = { startStakingTracker, fetchStakingEarnList };
