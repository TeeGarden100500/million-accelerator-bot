const fs = require('fs');
const path = require('path');
const { sendTelegramMessage } = require('./utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const SIGNAL_FILE = path.join(__dirname, '..', 'storage', 'signals.json');
const MAX_SIGNALS = 100;
const SPAM_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

function loadSignals() {
  try {
    if (fs.existsSync(SIGNAL_FILE)) {
      return JSON.parse(fs.readFileSync(SIGNAL_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read signals:', err.message);
  }
  return [];
}

function saveSignals(data) {
  try {
    fs.mkdirSync(path.dirname(SIGNAL_FILE), { recursive: true });
    const trimmed = data.slice(-MAX_SIGNALS);
    fs.writeFileSync(SIGNAL_FILE, JSON.stringify(trimmed, null, 2));
  } catch (err) {
    console.error('Failed to write signals:', err.message);
  }
}

function recentlySent(list, token) {
  const now = Date.now();
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const s = list[i];
    if (String(s.token).toUpperCase() === String(token).toUpperCase()) {
      const t = new Date(s.time || s.timestamp || s.date || 0).getTime();
      if (now - t < SPAM_INTERVAL) return true;
      break;
    }
  }
  return false;
}

async function generateSignal(tokenData) {
  if (!tokenData) return null;
  const {
    token = tokenData.symbol,
    source = tokenData.tags || [],
    reasons = tokenData.reasons || [],
    score,
    message: msg,
    action: act,
  } = tokenData;

  if ((!Array.isArray(source) || source.length === 0) && reasons.length === 0) {
    return null;
  }

  const confidence = Number(
    Math.min(10, score ? score / 10 : 5 + reasons.length / 2).toFixed(1)
  );
  const message = msg || reasons.join('. ');
  const action = act || 'Вход малой позицией / ожидание подтверждения';

  const signal = {
    token,
    source: Array.isArray(source) ? source : [source],
    confidence,
    message,
    action,
    time: new Date().toISOString(),
  };

  const history = loadSignals();
  if (recentlySent(history, token)) {
    logDebug(`Skip spam signal for ${token}`);
    return null;
  }

  history.push(signal);
  saveSignals(history);

  const text =
    `\uD83D\uDE80 Новый сигнал: ${signal.token}\n` +
    `Источники: ${signal.source.join(', ')}\n` +
    `\uD83D\uDCCA Уверенность: ${signal.confidence} / 10\n` +
    `\uD83D\uDCCC Комментарий: ${signal.message}\n` +
    `\u2705 Действие: ${signal.action}`;

  try {
    await sendTelegramMessage(text);
  } catch (err) {
    console.error('Failed to send signal to Telegram:', err.message);
  }

  return signal;
}

module.exports = { generateSignal };
