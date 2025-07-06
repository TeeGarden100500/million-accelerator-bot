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
  TOKEN_SCORING_INTERVAL_HOURS:
    Number(process.env.TOKEN_SCORING_INTERVAL_HOURS) || 12,
  DEX_ACTIVITY_INTERVAL_MINUTES:
    Number(process.env.DEX_ACTIVITY_INTERVAL_MINUTES) || 30,
  DEX_VOLUME_THRESHOLD: Number(process.env.DEX_VOLUME_THRESHOLD) || 3.0,
  DEX_LIQUIDITY_THRESHOLD:
    Number(process.env.DEX_LIQUIDITY_THRESHOLD) || 0.5,
  DEX_MIN_TRADERS: Number(process.env.DEX_MIN_TRADERS) || 20,
  RSS_SOURCES: (process.env.RSS_SOURCES
    ? process.env.RSS_SOURCES.split(',')
    : [
        'https://cointelegraph.com/rss',
        'https://decrypt.co/feed',
        'https://whalewire.com/feed',
        'https://watcherguru.com/feed',
      ]),
  NEWS_ALARM_THRESHOLD: Number(process.env.NEWS_ALARM_THRESHOLD) || 3,
  NEWS_SPAM_INTERVAL_MINUTES:
    Number(process.env.NEWS_SPAM_INTERVAL_MINUTES) || 30,
  UNLOCK_LOOKAHEAD_DAYS: Number(process.env.UNLOCK_LOOKAHEAD_DAYS) || 7,
  UNLOCK_MIN_PERCENT: Number(process.env.UNLOCK_MIN_PERCENT) || 1.0,
  UNLOCK_MIN_USD: Number(process.env.UNLOCK_MIN_USD) || 1_000_000,
  UNLOCK_SPAM_INTERVAL_HOURS:
    Number(process.env.UNLOCK_SPAM_INTERVAL_HOURS) || 24,
  PUMP_RELOAD_THRESHOLD:
    Number(process.env.PUMP_RELOAD_THRESHOLD) || 0.3,
  PUMP_RELOAD_WINDOW_DAYS:
    Number(process.env.PUMP_RELOAD_WINDOW_DAYS) || 5,
  HYPE_SCORE_MIN_PRIORITY:
    Number(process.env.HYPE_SCORE_MIN_PRIORITY) || 8.5,
  HYPE_TOP_N: Number(process.env.HYPE_TOP_N) || 3,
  HYPE_REFRESH_INTERVAL_HOURS:
    Number(process.env.HYPE_REFRESH_INTERVAL_HOURS) || 12,
  SPM_UPDATE_INTERVAL_HOURS:
    Number(process.env.SPM_UPDATE_INTERVAL_HOURS) || 12,
  SPM_PROFIT_THRESHOLD_CAUTION:
    Number(process.env.SPM_PROFIT_THRESHOLD_CAUTION) || 0.5,
  SPM_PROFIT_THRESHOLD_EXIT:
    Number(process.env.SPM_PROFIT_THRESHOLD_EXIT) || -0.25,
  PHRB_SNAPSHOT_HOUR_UTC: Number(process.env.PHRB_SNAPSHOT_HOUR_UTC) || 7,
  PHRB_MAX_RISK: Number(process.env.PHRB_MAX_RISK) || 0.3,
  PHRB_MIN_GAIN_TO_HOLD: Number(process.env.PHRB_MIN_GAIN_TO_HOLD) || 0.05,
  REBALANCE_INTERVAL_HOURS:
    Number(process.env.REBALANCE_INTERVAL_HOURS) || 24,
  MIN_PROFIT_TO_KEEP: Number(process.env.MIN_PROFIT_TO_KEEP) || 0.1,
  COMBO_SIGNAL_EXPIRY_DAYS:
    Number(process.env.COMBO_SIGNAL_EXPIRY_DAYS) || 7,
};
