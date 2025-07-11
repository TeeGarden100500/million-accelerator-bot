const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { sendTelegramMessage } = require('../utils/telegram');

const TOP_TOKENS_FILE = process.env.TOP_TOKENS_JSON ||
  path.join(__dirname, '..', '..', 'data', 'top-tokens.json');
const BLACKLIST_FILE = path.join(__dirname, '..', '..', 'config', 'blacklist.json');

const REFRESH_INTERVAL_MIN = Number(process.env.TOKEN_REFRESH_INTERVAL_MINUTES) || 60;
const MAX_TOKENS = 20;
const MIN_HOLDERS = Number(process.env.MIN_HOLDERS) || 200;
const MIN_AGE = Number(process.env.TOKEN_MIN_AGE_DAYS) || 90;
const MAX_AGE = Number(process.env.TOKEN_MAX_AGE_DAYS) || 180;
const EXCLUDE_SCAM_TAGS = String(process.env.EXCLUDE_SCAM_TAGS || 'true') !== 'false';
const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';

function logDebug(msg) {
  if (DEBUG) {
    console.log(`[TOP-TOKENS] ${msg}`);
  }
}

async function fetchWithRetry(url, opts = {}, retries = 3) {
  for (let i = 0; i < retries; i += 1) {
    try {
      return await axios.get(url, opts);
    } catch (err) {
      const status = err.response?.status;
      if ((status === 429 || status >= 500) && i < retries - 1) {
        const delayMs = 1000 * (i + 1);
        logDebug(`Retry ${url} in ${delayMs}ms due to ${status}`);
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      throw err;
    }
  }
  return null;
}

function readJSON(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      logDebug(`File ${path.basename(filePath)} пуст`);
      return fallback;
    }
    return JSON.parse(raw);
  } catch (err) {
    logDebug(`Failed to read ${filePath}: ${err.message}`);
    return fallback;
  }
}

function saveJSON(filePath, data) {
  try {
    if (Array.isArray(data) && !data.length) {
      logDebug('skip saving empty token list');
      return;
    }
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
    const url = 'https://api.dexscreener.com/latest/dex/pairs';
    logDebug(`Request URL ${url}`);
    const res = await fetchWithRetry(url);
    const { data } = res;
    logDebug(`Received ${data?.pairs?.length ?? data?.length ?? 0} pairs`);
    return data.pairs || data;
  } catch (err) {
    const msg = `DexScreener API error: ${err.message}`;
    console.error(msg);
    logDebug(msg);
    await sendTelegramMessage(`❗ ${msg}`);
    return null;
  }
}

async function checkDexScreenerHealth() {
  const url = 'https://api.dexscreener.com/latest/dex/pairs?limit=1';
  try {
    await axios.get(url, { timeout: 5000 });
    logDebug('DexScreener health check ok');
    return true;
  } catch (err) {
    const msg = `DexScreener health check failed: ${err.message}`;
    console.error(`[TOP-TOKENS] ${msg}`);
    logDebug(msg);
    try {
      await sendTelegramMessage(`❗ ${msg}`);
    } catch (tErr) {
      console.error('Failed to send Telegram alert:', tErr.message);
    }
    return false;
  }
}

async function fetchGeckoInfo(address) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`;
    const { data } = await fetchWithRetry(url);
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
  const list = readJSON(TOP_TOKENS_FILE, []);
  if (!list.length) {
    logDebug('Cached token file пуст или не найден');
  }
  return list;
}

async function selectTopTokens() {
  const blacklist = loadBlacklist();
  const result = [];
  logDebug(`\u2699\uFE0F Фильтруем токены: возраст ${MIN_AGE}-${MAX_AGE} дней, холдеров > ${MIN_HOLDERS}`);
  const dexTokens = await fetchDexTokens();
  if (!dexTokens || !dexTokens.length) {
    console.error('[TOP-TOKENS] Получен пустой список токенов');
    await sendTelegramMessage('❌ Получен пустой список токенов. Пропускаем итерацию.');
    logDebug('Using cached tokens due to DexScreener failure or empty list');
    return loadCachedTokens();
  }

  for (const t of dexTokens) {
    if (result.length >= MAX_TOKENS) break;
    const address = t?.baseToken?.address?.toLowerCase();
    if (!address || address.startsWith('0x0000000000000000000000000000000000000000')) {
      continue;
    }
    if (
      t.chainId &&
      !['eth', 'ethereum', 'bsc'].includes(t.chainId.toLowerCase())
    ) {
      continue;
    }
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

    if (
      EXCLUDE_SCAM_TAGS &&
      Array.isArray(t.tags) &&
      t.tags.some((tag) => /scam/i.test(tag))
    ) {
      logDebug(`Reject ${address} - scam tag`);
      continue;
    }

    const holders = Number(t.holders || t.baseToken?.holders || 0);
    if (!holders || holders < MIN_HOLDERS) {
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
    if (age === null || age < MIN_AGE || age > MAX_AGE) {
      logDebug(`Reject ${address} age ${age}`);
      continue;
    }

    result.push(address);
    logDebug(`Added ${address}`);
  }

  if (result.length) {
    saveJSON(TOP_TOKENS_FILE, result);
    logDebug(`Saved ${result.length} tokens`);
    await sendTelegramMessage(`\uD83E\uDDE0 Загружено ${result.length} токенов из DexScreener`);
    return result;
  }

  logDebug('No tokens selected - returning cached list');
  const cached = loadCachedTokens();
  if (!cached.length) {
    console.warn('[TOP-TOKENS] ⚠️ Пустой список токенов.');
  } else {
    logDebug(`Loaded ${cached.length} tokens from cache`);
  }
  return cached;
}

function startSelector() {
  selectTopTokens();
  setInterval(selectTopTokens, REFRESH_INTERVAL_MIN * 60 * 1000);
}

module.exports = { selectTopTokens, startSelector, checkDexScreenerHealth };
