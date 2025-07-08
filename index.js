require('dotenv').config();
console.log('Million Accelerator Bot started');

const { selectTopTokens, checkDexScreenerHealth } = require('./src/monitoring/topTokenSelector');

(async () => {
  const healthy = await checkDexScreenerHealth();
  if (healthy) {
    await selectTopTokens();
  } else {
    console.error('Skipping selectTopTokens due to DexScreener health failure');
  }
})();
