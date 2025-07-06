const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const SEEN_PATH = path.join(__dirname, '..', '..', 'storage', 'newsSeen.json');
const KEYWORDS = [
  'hack',
  'exploit',
  'rug',
  'ban',
  'regulation',
  'lawsuit',
  'arrested',
  'SEC',
  'FBI',
  'delist',
  'shutdown',
  'depeg',
  'stablecoin crash',
  'crash',
];

let lastAlerts = [];

function loadSeen() {
  try {
    if (fs.existsSync(SEEN_PATH)) {
      return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read news history:', err.message);
  }
  return {};
}

function saveSeen(data) {
  try {
    fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
    fs.writeFileSync(SEEN_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to write news history:', err.message);
  }
}

function analyzeText(text) {
  let level = 0;
  const found = [];
  for (const kw of KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(text)) {
      level += 1;
      found.push(kw);
    }
  }
  return { level, found };
}

function canSendAlert() {
  const now = Date.now();
  lastAlerts = lastAlerts.filter((t) => now - t < 60 * 60 * 1000);
  const last = lastAlerts[lastAlerts.length - 1] || 0;
  return (
    lastAlerts.length < 2 &&
    now - last >= settings.NEWS_SPAM_INTERVAL_MINUTES * 60 * 1000
  );
}

async function fetchArticles() {
  const parser = new Parser();
  const articles = [];
  for (const url of settings.RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(url);
      const source = feed.title || url;
      (feed.items || []).forEach((item) => {
        articles.push({
          id: item.guid || item.link,
          title: item.title || '',
          content: item.contentSnippet || item.content || '',
          link: item.link,
          source,
        });
      });
    } catch (err) {
      logDebug(`Failed to parse RSS ${url}: ${err.message}`);
    }
  }
  return articles;
}

async function checkNews() {
  const seen = loadSeen();
  const articles = await fetchArticles();
  let updated = false;

  for (const a of articles) {
    if (!a.id || seen[a.id]) continue;
    seen[a.id] = Date.now();
    updated = true;
    const { level, found } = analyzeText(`${a.title} ${a.content}`);
    if (level >= settings.NEWS_ALARM_THRESHOLD && canSendAlert()) {
      const msg =
        '⚠️ ВНИМАНИЕ! Важная новость:\n' +
        `- ${a.title}\n` +
        `- Источник: ${a.source}\n` +
        (found.length ? `- Ключевые слова: ${found.join(', ')}\n` : '') +
        '→ Возможна просадка рынка. Рассмотри сокращение позиций.';
      logDebug(`Alerting news ${a.id}`);
      await sendTelegramAlert(msg);
      lastAlerts.push(Date.now());
    }
  }

  if (updated) saveSeen(seen);
}

function startNewsShockResponse() {
  checkNews();
  setInterval(checkNews, 10 * 60 * 1000);
}

module.exports = { startNewsShockResponse, analyzeText };
