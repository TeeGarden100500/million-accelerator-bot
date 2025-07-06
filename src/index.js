require('dotenv').config();
console.log('Million Accelerator Bot started');

const { startTokenMonitor } = require('./tokenMonitor');
const { startHalvingMonitor } = require('./strategies/halvingDetector');
const { startStakingTracker } = require('./strategies/stakingTracker');
const { startTokenScoringEngine } = require('./strategies/tokenScoringEngine');
const { startDexActivityWatcher } = require('./strategies/dexActivityWatcher');
const { startNewsShockResponse } = require('./strategies/newsShockResponse');
const { startPumpReloadWatcher } = require('./strategies/pumpReloadStrategy');
const { startSentimentHypeScanner } = require('./strategies/sentimentHypeScanner');
const { startPortfolioHeatmap } = require('./strategies/portfolioHeatmap');

startTokenMonitor();
startHalvingMonitor();
startStakingTracker();
startTokenScoringEngine();
startDexActivityWatcher();
startNewsShockResponse();
startPumpReloadWatcher();
startSentimentHypeScanner();
startPortfolioHeatmap();
