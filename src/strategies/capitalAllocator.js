const fs = require('fs');
const path = require('path');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const POSITIONS_FILE = path.join(__dirname, '..', '..', 'data', 'positions.json');
const CAPITAL_FILE = path.join(__dirname, '..', '..', 'data', 'capital.json');
const FRESH_PATH = path.join(__dirname, '..', '..', 'signals', 'freshIdeas.json');
const SENTIMENT_PATH = path.join(
  __dirname,
  '..',
  '..',
  'signals',
  'sentimentScanner.json',
);
const COMBO_PATH = path.join(__dirname, '..', '..', 'logs', 'comboSignals.json');

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

function loadPositions() {
  const data = loadJson(POSITIONS_FILE, []);
  return Array.isArray(data) ? data : data.positions || [];
}

function getFreeCapital() {
  const capital = loadJson(CAPITAL_FILE, null);
  if (capital && typeof capital.freeCapital === 'number') return capital.freeCapital;
  const pos = loadJson(POSITIONS_FILE, null);
  if (pos && typeof pos.freeCapital === 'number') return pos.freeCapital;
  return 0;
}

function aggregateCandidates() {
  const now = Date.now();
  const limit = 48 * 60 * 60 * 1000;
  const map = {};

  function add(symbol, opts = {}) {
    if (!symbol) return;
    const key = symbol.toUpperCase();
    if (!map[key]) {
      map[key] = {
        symbol: key,
        hype: 0,
        volume: 0,
        comboScore: 0,
        tags: new Set(),
        lastSignal: 0,
        sources: new Set(),
      };
    }
    const item = map[key];
    if (opts.time && opts.time > item.lastSignal) item.lastSignal = opts.time;
    if (opts.hype && opts.hype > item.hype) item.hype = Number(opts.hype);
    if (opts.volume && opts.volume > item.volume) item.volume = Number(opts.volume);
    if (opts.tags) opts.tags.forEach((t) => item.tags.add(t));
    if (opts.combo) item.comboScore += opts.combo;
    if (opts.source) item.sources.add(opts.source);
  }

  loadJson(FRESH_PATH).forEach((e) => {
    const time = new Date(e.date || e.timestamp || 0).getTime();
    add(e.symbol || e.token, { time, tags: e.tags || [], source: 'fresh' });
  });

  loadJson(SENTIMENT_PATH).forEach((e) => {
    const time = new Date(e.date || e.timestamp || 0).getTime();
    add(e.symbol || e.token, {
      time,
      hype: e.hype,
      volume: e.volume,
      tags: e.tags || [],
      source: 'sentiment',
    });
  });

  loadJson(COMBO_PATH).forEach((e) => {
    const time = new Date(e.date || e.timestamp || 0).getTime();
    add(e.symbol || e.token, {
      time,
      combo: 1,
      tags: e.tags || [],
      source: 'combo',
    });
  });

  return Object.values(map).filter((c) => now - c.lastSignal <= limit);
}

function filterCandidates(cands, positions) {
  const posSet = new Set(
    positions.map((p) => String(p.symbol || p.token || '').toUpperCase()),
  );
  const NEG = ['UNLOCKSOON', 'NEGNEWS', 'LOWVOL'];
  return cands.filter((c) => {
    if (posSet.has(c.symbol)) return false;
    for (const t of c.tags) {
      if (NEG.includes(String(t).toUpperCase())) return false;
    }
    return c.comboScore >= 2;
  });
}

function sortCandidates(list) {
  return list.sort((a, b) => {
    if (b.hype !== a.hype) return b.hype - a.hype;
    if (b.volume !== a.volume) return b.volume - a.volume;
    return b.comboScore - a.comboScore;
  });
}

async function analyzeCapital() {
  const freeCapital = getFreeCapital();
  if (freeCapital <= 100) return;

  const positions = loadPositions();
  const aggregated = aggregateCandidates();
  const filtered = filterCandidates(aggregated, positions);
  const sorted = sortCandidates(filtered);
  if (!sorted.length) return;

  const top = sorted.slice(0, 3);
  const allocation = Math.floor(freeCapital / top.length);

  let message = `\uD83D\uDCB0 Аллокация капитала ($${freeCapital} доступно):\n\n`;

  top.forEach((c, idx) => {
    const reasons = [];
    if (c.hype) reasons.push('Hype\u2191');
    if (c.volume) reasons.push('Volume\u2191');
    if (c.sources.has('fresh')) reasons.push('Fresh');
    if (c.tags.has('HalvingSoon')) reasons.push('HalvingSoon');
    message += `${idx + 1}. $${c.symbol} — ${reasons.join(' + ')}, Combo: ${c.comboScore} \u2192 до $${allocation}\n`;
  });

  logDebug(`CapitalAllocator message:\n${message}`);
  await sendTelegramAlert(message.trim());
}

function startCapitalAllocator() {
  analyzeCapital();
  const DAY = 24 * 60 * 60 * 1000;
  setInterval(analyzeCapital, DAY);

  if (fs.existsSync(CAPITAL_FILE)) {
    fs.watchFile(CAPITAL_FILE, { interval: 5 * 60 * 1000 }, () => analyzeCapital());
  } else {
    fs.watchFile(POSITIONS_FILE, { interval: 5 * 60 * 1000 }, () => analyzeCapital());
  }
}

module.exports = { startCapitalAllocator, analyzeCapital };
