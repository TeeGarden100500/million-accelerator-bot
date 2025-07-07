const { selectTopTokens } = require('../monitoring/topTokenSelector');

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
const INTERVAL_MIN = Number(process.env.TOP_TOKEN_REFRESH_MINUTES) || 60;

function logDebug(msg) {
  if (DEBUG) console.log(`[TOKEN-REFRESH] ${msg}`);
}

async function refresh() {
  try {
    const tokens = await selectTopTokens();
    logDebug(`Обновлено токенов: ${tokens.length}`);
  } catch (err) {
    console.error('[TOKEN-REFRESH] Ошибка выбора токенов:', err.message);
  }
}

function startTokenRefreshScheduler() {
  refresh();
  setInterval(refresh, INTERVAL_MIN * 60 * 1000);
}

if (require.main === module) {
  startTokenRefreshScheduler();
}

module.exports = { startTokenRefreshScheduler };
