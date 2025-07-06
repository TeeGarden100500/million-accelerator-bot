const fs = require('fs');
const path = require('path');
const { fetchTokenList } = require('./geckoService');
const { scanToken } = require('./tokenScanner');
const settings = require('../config/settings');

const TOP_TOKENS_FILE = path.join(__dirname, '..', 'data', 'top-tokens.json');
const UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';

let tokens = [];

function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

function loadTokensFromFile() {
  try {
    const data = fs.readFileSync(TOP_TOKENS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    tokens = parsed.map((t) => t.address);
  } catch (err) {
    logDebug(`Failed to read ${TOP_TOKENS_FILE}: ${err.message}`);
    tokens = [];
  }
}

async function updateTokensFromApi() {
  try {
    const list = await fetchTokenList();
    if (Array.isArray(list) && list.length) {
      const subset = list.slice(0, 100);
      const normalized = subset.map((t, i) => ({
        symbol: t.symbol || `TOKEN${i}`,
        address: t.id || ''
      }));
      fs.writeFileSync(TOP_TOKENS_FILE, JSON.stringify(normalized, null, 2));
      tokens = normalized.map((t) => t.address);
    }
  } catch (err) {
    logDebug(`Token API update failed: ${err.message}`);
  }
}

function logSelectedTokens() {
  console.log('[SCANNER] \uD83D\uDCC8 Выбраны реальные токены для анализа:');
  tokens.slice(0, 10).forEach((address, idx) => {
    const label = `0x...${idx + 1}`;
    console.log(`- ${label} (${address})`);
  });
}

async function refreshTokens() {
  await updateTokensFromApi();
  if (!tokens.length) loadTokensFromFile();
  logSelectedTokens();
}

function getTokenList() {
  try {
    const data = fs.readFileSync(TOP_TOKENS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    logDebug(`Failed to load token list: ${err.message}`);
    return [];
  }
}

async function startRealScan() {
  if (settings.USE_MOCK_TOKENS) {
    console.log('[SCANNER] Mock tokens enabled. realTokenScan skipped.');
    return;
  }
  await refreshTokens();
  setInterval(refreshTokens, UPDATE_INTERVAL);

  while (true) {
    for (const token of tokens) {
      await scanToken(token);
      await delay(10000);
    }
  }
}

if (require.main === module) {
  startRealScan();
}

module.exports = { startRealScan, getTokenList };
