const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');
const { getTokenPrice } = require('../../services/geckoService');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const schedule = [
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

async function checkHalvingProximity(token) {
  const daysLeft = daysUntil(token.date);
  if (daysLeft < settings.HALVING_ALERT_THRESHOLD_DAYS && daysLeft >= 0) {
    const price = await getTokenPrice({ symbol: token.cgId });
    const message =
      `🪙 Приближается Halving!\n` +
      `Токен: ${token.name} ($${token.symbol})\n` +
      `⏳ Осталось: ${daysLeft} дней\n` +
      `Цена сейчас: $${price}\n` +
      `⚠️ Исторически после халвинга цена ${token.symbol} росла на +200–300%`;
    logDebug(`Halving alert for ${token.symbol}: ${daysLeft} days left`);
    await sendTelegramAlert(message);
    return true;
  }
  return false;
}

async function checkAll() {
  for (const token of schedule) {
    try {
      await checkHalvingProximity(token);
    } catch (err) {
      console.error('Halving check error:', err.message);
    }
  }
}

function startHalvingMonitor() {
  checkAll();
  setInterval(checkAll, 24 * 60 * 60 * 1000);
}

module.exports = { startHalvingMonitor, checkHalvingProximity };
