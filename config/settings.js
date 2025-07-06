const path = require('path');

module.exports = {
  ALERT_INTERVAL_SEC: 60,
  TOKENS_FILE: path.join(__dirname, '..', 'database', 'tokens.json'),
  MIN_TX_USD: 10000,
  PUMP_PROFIT_THRESHOLD_VOLUME:
    Number(process.env.PUMP_PROFIT_THRESHOLD_VOLUME) || 200,
  PUMP_PROFIT_THRESHOLD_PRICE:
    Number(process.env.PUMP_PROFIT_THRESHOLD_PRICE) || 20,
  HALVING_ALERT_THRESHOLD_DAYS:
    Number(process.env.HALVING_ALERT_THRESHOLD_DAYS) || 90,
  STAKING_TRACK_INTERVAL_HOURS:
    Number(process.env.STAKING_TRACK_INTERVAL_HOURS) || 12,
};
