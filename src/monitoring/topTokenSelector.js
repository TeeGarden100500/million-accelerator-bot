const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TOP_TOKENS_FILE = path.join(__dirname, '..', '..', 'data', 'top-tokens.json');
const BLACKLIST_FILE = path.join(__dirname, '..', '..', 'config', 'blacklist.json');

const REFRESH_INTERVAL_HOURS = Number(process.env.TOP_TOKEN_REFRESH_HOURS) || 6;
const MAX_TOKENS = 20;
const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';

function logDebug(msg) {
  if (DEBUG) {
    console.log(`[TOP-TOKENS] ${msg}`);
  }
}

function readJSON(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    logDebug(`Failed to read ${filePath}: ${err.message}`);
    return fallback;
  }
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    logDebug(`Failed to write ${filePath}: ${err.message}`);
  }
}

function loadBlacklist() {
  const list = readJSON(BLACKLIST_FILE, []);
  return new Set(list.map((a) => a.toLowerCase()));
}

async function fetchDexTokens() {
  try {
    const url =
      'https://api.dexscreener.com/latest/dex/tokens?chain=base';
    const { data } = await axios.get(url);
    return data.pairs || data;
  } catch (err) {
    logDebug(`DexScreener API error: ${err.message}`);
    return null;
  }
}

async function fetchGeckoInfo(address) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`;
    const { data } = await axios.get(url);
    return data;
  } catch (err) {
    logDebug(`CoinGecko fetch failed for ${address}: ${err.message}`);
    return null;
  }
}

function tokenAgeDays(dateString) {
  if (!dateString) return null;
  const ts = Date.parse(dateString);
  if (Number.isNaN(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

function loadCachedTokens() {
  return readJSON(TOP_TOKENS_FILE, []);
}

async function selectTopTokens() {
  const blacklist = loadBlacklist();
  const result = [];
  const dexTokens = await fetchDexTokens();
  if (!dexTokens) {
    logDebug('Using cached tokens due to DexScreener failure');
    return loadCachedTokens();
  }

  for (const t of dexTokens) {
    if (result.length >= MAX_TOKENS) break;
    const address = t?.baseToken?.address?.toLowerCase();
    if (!address) continue;
    if (t.chainId && t.chainId.toLowerCase() !== 'base') continue;
    if (blacklist.has(address)) {
      logDebug(`Skip ${address} - blacklisted`);
      continue;
    }
    if (result.includes(address)) continue;

    const volume24h = Number(t.volume?.h24 || t.volume24h || t.volume24hUsd || 0);
    if (volume24h < 300000) {
      logDebug(`Reject ${address} volume ${volume24h}`);
      continue;
    }

    const holders = Number(t.holders || t.baseToken?.holders || 0);
    if (!holders || holders < 1000) {
      logDebug(`Reject ${address} holders ${holders}`);
      continue;
    }

    const gecko = await fetchGeckoInfo(address);
    if (!gecko) {
      logDebug(`Reject ${address} - no CoinGecko data`);
      continue;
    }

    const marketCap = gecko.market_data?.market_cap?.usd || gecko.market_data?.fully_diluted_valuation?.usd || 0;
    if (marketCap < 5000000 || marketCap > 200000000) {
      logDebug(`Reject ${address} market cap ${marketCap}`);
      continue;
    }

    const price = gecko.market_data?.current_price?.usd;
    if (price < 0.001 || price > 2) {
      logDebug(`Reject ${address} price ${price}`);
      continue;
    }

    const age = tokenAgeDays(
      gecko.genesis_date || gecko.date_added || t.pairCreatedAt
    );
    if (age === null || age < 90 || age > 180) {
      logDebug(`Reject ${address} age ${age}`);
      continue;
    }

    result.push(address);
    logDebug(`Added ${address}`);
  }

  if (result.length) {
    saveJSON(TOP_TOKENS_FILE, result);
    return result;
  }

  logDebug('No tokens selected - returning cached list');
  const cached = loadCachedTokens();
  if (!cached.length) {
    console.warn('[TOP-TOKENS] ⚠️ Пустой список токенов.');
  }
  return cached;
}

function startSelector() {
  selectTopTokens();
  setInterval(selectTopTokens, REFRESH_INTERVAL_HOURS * 60 * 60 * 1000);
}

module.exports = { selectTopTokens, startSelector };
