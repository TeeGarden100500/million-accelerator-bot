const fs = require('fs');
const path = require('path');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const POSITIONS_PATH = path.join(__dirname, '..', '..', 'data', 'positions.json');
const COMBO_PATH = path.join(__dirname, '..', '..', 'logs', 'comboSignals.json');
const META_PATH = path.join(__dirname, '..', '..', 'database', 'tokenMeta.json');
const FRESH_PATH = path.join(__dirname, '..', '..', 'signals', 'freshIdeas.json');
const SENT_PATH = path.join(__dirname, '..', '..', 'storage', 'sentRiskAlerts.json');

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

function saveJson(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Failed to write ${path.basename(file)}:`, err.message);
  }
}

function gatherSymbols() {
  const set = new Set();
  const pos = loadJson(POSITIONS_PATH, []);
  const combo = loadJson(COMBO_PATH, []);
  const fresh = loadJson(FRESH_PATH, []);
  pos.forEach((p) => p.symbol && set.add(String(p.symbol).toUpperCase()));
  combo.forEach((c) => c.symbol && set.add(String(c.symbol).toUpperCase()));
  fresh.forEach((f) => f.symbol && set.add(String(f.symbol).toUpperCase()));
  return Array.from(set);
}

function buildRiskList(symbol, meta) {
  if (!meta) return [];
  const risks = [];
  if (typeof meta.unlockInDays === 'number' && meta.unlockInDays <= 3) {
    risks.push({ type: 'unlock', msg: `🚨 Разлок через ${meta.unlockInDays} дня` });
  }
  if (Array.isArray(meta.tags) && (meta.tags.includes('NegNews') || meta.tags.includes('BadPR'))) {
    risks.push({ type: 'news', msg: '📰 Негативный новостной фон' });
  }
  if (typeof meta.priceChange24h === 'number' && meta.priceChange24h <= -20) {
    risks.push({ type: 'drop', msg: `📉 Просадка ${meta.priceChange24h}% за сутки` });
  }
  if (typeof meta.volumeChange3d === 'number' && meta.volumeChange3d <= -50) {
    risks.push({ type: 'volume', msg: `🧊 Объём упал на ${Math.abs(meta.volumeChange3d)}%` });
  }
  return risks;
}

async function checkRisks() {
  const metas = loadJson(META_PATH, []);
  const bySymbol = {};
  metas.forEach((m) => {
    if (m.symbol) bySymbol[String(m.symbol).toUpperCase()] = m;
  });

  const symbols = gatherSymbols();
  if (!symbols.length) return;

  const history = loadJson(SENT_PATH, {});
  const now = Date.now();
  let updated = false;

  for (const sym of symbols) {
    const meta = bySymbol[sym];
    const risks = buildRiskList(sym, meta);
    if (!risks.length) continue;

    const newRisks = risks.filter((r) => {
      const last = history[sym]?.[r.type] || 0;
      return now - last >= 24 * 60 * 60 * 1000;
    });
    if (!newRisks.length) continue;

    const lines = newRisks.map((r) => `• ${r.msg}`).join('\n');
    const message =
      `⚠️ Обнаружен риск по токену $${sym}:\n` +
      `${lines}\n\n` +
      '🔁 Рекомендуем:\n' +
      '• Зафиксировать 50% позиции\n' +
      '• Отслеживать новостной фон';
    logDebug(`Risk alert for ${sym}\n${lines}`);
    await sendTelegramAlert(message);

    history[sym] = history[sym] || {};
    newRisks.forEach((r) => {
      history[sym][r.type] = now;
    });
    updated = true;
  }

  if (updated) saveJson(SENT_PATH, history);
}

function startRiskAlerts() {
  checkRisks();
  setInterval(checkRisks, 60 * 60 * 1000);
}

module.exports = { startRiskAlerts, checkRisks };
