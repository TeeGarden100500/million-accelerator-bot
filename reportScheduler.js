const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { sendTelegramMessage } = require('./telegram');
const { sendHeartbeat } = require('./utils/moduleMonitor');
const MODULE_NAME = 'reportScheduler.js';

const TOP_TOKENS_FILE = path.join(__dirname, 'data', 'top-tokens.json');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const PATHS = {
  profitHistory: path.join(__dirname, 'history', 'profitHistory.json'),
  positions: path.join(__dirname, 'data', 'positions.json'),
  comboSignals: path.join(__dirname, 'logs', 'comboSignals.json'),
  capital: path.join(__dirname, 'data', 'capital.json'),
  freshIdeas: path.join(__dirname, 'signals', 'freshIdeas.json'),
  sentiment: path.join(__dirname, 'signals', 'sentimentScanner.json'),
  reportsDir: path.join(__dirname, 'history', 'reports'),
};

function hasTokens() {
  try {
    const raw = fs.readFileSync(TOP_TOKENS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0;
  } catch {
    return false;
  }
}

function loadJson(file, def = []) {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error(`Failed to read ${path.basename(file)}:`, err.message);
  }
  return def;
}

function saveReport(period, report) {
  try {
    fs.mkdirSync(PATHS.reportsDir, { recursive: true });
    const file = path.join(PATHS.reportsDir, `${period}.json`);
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('Failed to save report:', err.message);
  }
}

function buildReport(period) {
  const profitHistory = loadJson(PATHS.profitHistory);
  const positions = loadJson(PATHS.positions);
  const combo = loadJson(PATHS.comboSignals);
  const capital = loadJson(PATHS.capital, {});
  const ideas = loadJson(PATHS.freshIdeas);
  const sentiment = loadJson(PATHS.sentiment);

  const daysMap = { weekly: 7, monthly: 30, quarterly: 90, semiannual: 182, yearly: 365 };
  const days = daysMap[period] || 7;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const entries = profitHistory.filter(p => new Date(p.timestamp || p.date || 0).getTime() >= cutoff);
  let profit = 0;
  if (entries.length >= 2) {
    const start = entries[0].totalCapitalUSD;
    const end = entries[entries.length - 1].totalCapitalUSD;
    if (start && end) profit = (end - start) / start;
  }

  const newSignals = combo.filter(c => new Date(c.date || 0).getTime() >= cutoff).length;

  return {
    date: new Date().toISOString(),
    period,
    profit,
    positions: positions.length,
    newSignals,
    ideas: ideas.length,
    sentimentRecords: sentiment.length,
    capital,
  };
}

async function sendReport(period) {
  sendHeartbeat(MODULE_NAME);
  try {
    const report = buildReport(period);
    saveReport(period, report);

    let message = `\uD83D\uDCC8 Отчёт за ${period}\n`;
    if (report.profit) {
      const pct = (report.profit * 100).toFixed(2);
      message += `Доходность: ${report.profit >= 0 ? '+' : ''}${pct}%\n`;
    } else {
      message += 'Доходность: нет данных\n';
    }
    message += `Открытых позиций: ${report.positions}\n`;
    if (report.newSignals)
      message += `Новые комбо-сигналы: ${report.newSignals}\n`;
    if (report.ideas)
      message += `Свежие идеи: ${report.ideas}\n`;
    logDebug(message.trim());
    await sendTelegramMessage(message.trim());
  } catch (err) {
    console.error('[REPORT] Ошибка формирования отчёта:', err.message);
    await sendTelegramMessage(`❗ Ошибка формирования отчёта: ${err.message}`);
  }
}

function startReportScheduler() {
  if (!hasTokens()) {
    const msg = '[REPORT] top-tokens.json пуст, планировщик не запущен';
    console.warn(msg);
    sendTelegramMessage(msg);
    return;
  }
  const cronMap = {
    weekly: '0 9 * * 1',
    monthly: '0 10 1 * *',
    quarterly: '0 11 1 1,4,7,10 *',
    semiannual: '0 12 1 1,7 *',
    yearly: '0 13 1 1 *',
  };
  Object.entries(cronMap).forEach(([period, expr]) => {
    cron.schedule(expr, () => sendReport(period));
  });
  logDebug('Report scheduler started');
  sendHeartbeat(MODULE_NAME);
  setInterval(() => sendHeartbeat(MODULE_NAME), 60 * 1000);
}

module.exports = { startReportScheduler };
