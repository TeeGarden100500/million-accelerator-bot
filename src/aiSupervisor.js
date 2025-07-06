const fs = require('fs');
const path = require('path');
const { sendTelegramAlert } = require('./utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const POSITIONS_PATH = path.join(__dirname, '..', 'data', 'positions.json');
const COMBO_PATH = path.join(__dirname, '..', 'logs', 'comboSignals.json');
const PROFIT_PATH = path.join(__dirname, '..', 'history', 'profitHistory.json');
const RISK_PATH = path.join(__dirname, '..', 'logs', 'riskAlerts.json');
const FRESH_PATH = path.join(__dirname, '..', 'signals', 'freshIdeas.json');
const SENTIMENT_PATH = path.join(__dirname, '..', 'signals', 'sentimentScanner.json');
const DECISIONS_DIR = path.join(__dirname, '..', 'decisions');

function chooseCandidate(posSymbols, ideas, sentiment) {
  for (const idea of ideas) {
    const sym = String(idea.symbol || idea.token).toUpperCase();
    if (!posSymbols.has(sym)) return sym;
  }
  for (let i = sentiment.length - 1; i >= 0; i -= 1) {
    const sym = String(sentiment[i].symbol).toUpperCase();
    if (!posSymbols.has(sym)) return sym;
  }
  return null;
}

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

function getLatestSnapshot() {
  const history = loadJson(PROFIT_PATH, []);
  if (!history.length) return null;
  return history[history.length - 1];
}

function roiForToken(snapshot, symbol) {
  if (!snapshot) return null;
  const t = snapshot.tokens.find(
    (e) => String(e.symbol).toUpperCase() === symbol.toUpperCase(),
  );
  if (!t) return null;
  const entry = Number(t.entryPrice);
  const price = Number(t.price);
  if (!entry || !price) return null;
  return (price - entry) / entry;
}

function recentCombo(symbol, combo) {
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return combo.some(
    (c) =>
      String(c.symbol).toUpperCase() === symbol.toUpperCase() &&
      new Date(c.date || c.time || 0).getTime() >= cutoff,
  );
}

function getSentimentEntries(symbol, sentiment) {
  return sentiment
    .filter((s) => String(s.symbol).toUpperCase() === symbol.toUpperCase())
    .sort((a, b) => new Date(a.date || a.time) - new Date(b.date || b.time))
    .slice(-3);
}

function isIncreasing(list, field) {
  if (list.length < 2) return false;
  let up = 0;
  for (let i = 1; i < list.length; i += 1) {
    if (Number(list[i][field]) > Number(list[i - 1][field])) up += 1;
  }
  return up >= 2;
}

function isDecreasing(list, field) {
  if (list.length < 2) return false;
  let down = 0;
  for (let i = 1; i < list.length; i += 1) {
    if (Number(list[i][field]) < Number(list[i - 1][field])) down += 1;
  }
  return down >= 2;
}

function buildDecisions() {
  const positions = loadJson(POSITIONS_PATH, []);
  if (!positions.length) return [];

  const combo = loadJson(COMBO_PATH, []);
  const snapshot = getLatestSnapshot();
  const risks = loadJson(RISK_PATH, []);
  const ideas = loadJson(FRESH_PATH, []);
  const sentiment = loadJson(SENTIMENT_PATH, []);

  const posSymbols = new Set(positions.map((p) => String(p.symbol).toUpperCase()));
  const candidate = chooseCandidate(posSymbols, ideas, sentiment);

  const decisions = [];

  positions.forEach((p) => {
    const sym = String(p.symbol).toUpperCase();
    const reasons = [];
    let decision = 'HOLD';

    const roi = roiForToken(snapshot, sym);
    if (roi !== null) reasons.push(`ROI: ${(roi * 100).toFixed(0)}%`);

    const risk = risks.find(
      (r) => String(r.symbol).toUpperCase() === sym,
    );
    if (risk) {
      decision = 'SELL';
      reasons.push(risk.message || 'Обнаружен риск');
    }

    const sentimentEntries = getSentimentEntries(sym, sentiment);
    const trendUp = isIncreasing(sentimentEntries, 'volume') && isIncreasing(sentimentEntries, 'hype');
    const trendDown = isDecreasing(sentimentEntries, 'volume') && isDecreasing(sentimentEntries, 'hype');

    const comboRecent = recentCombo(sym, combo);
    if (!risk) {
      if (comboRecent && trendUp) {
        decision = 'ADD';
        reasons.push('Подтверждённый Combo-сигнал');
        reasons.push('Объём и hype растут');
      } else if (trendDown && !comboRecent) {
        decision = 'ROTATE';
        reasons.push('Объём и hype падают');
        if (candidate) reasons.push(`Возможная замена: $${candidate}`);
      }
    }

    decisions.push({ symbol: sym, decision, reasons });
  });

  return decisions;
}

function formatMessage(list) {
  if (!list.length) return null;
  const lines = list.map((d) => {
    const icon =
      d.decision === 'HOLD'
        ? '🟢'
        : d.decision === 'ADD'
        ? '🔵'
        : d.decision === 'ROTATE'
        ? '🟠'
        : '🔴';
    return `$${d.symbol} — ${icon} ${d.decision}\n${d.reasons.map((r) => `• ${r}`).join('\n')}`;
  });
  return `🧠 AI Supervisor — обзор портфеля\n\n${lines.join('\n\n')}`;
}

function saveHistory(list) {
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(DECISIONS_DIR, `history-${date}.json`);
  saveJson(file, list);
}

async function runSupervisor() {
  const list = buildDecisions();
  if (!list.length) return;
  saveHistory(list);
  const message = formatMessage(list);
  logDebug(`Supervisor report:\n${message}`);
  if (message) await sendTelegramAlert(message);
}

function schedule() {
  const hour = Number(process.env.AI_SUPERVISOR_HOUR_UTC) || 9;
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
  if (now >= target) target.setUTCDate(target.getUTCDate() + 1);
  const delay = target.getTime() - now.getTime();
  setTimeout(() => {
    runSupervisor();
    setInterval(runSupervisor, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startAiSupervisor: schedule, buildDecisions };
