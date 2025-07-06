require('dotenv').config();
console.log('Million Accelerator Bot started');

const { startTokenMonitor } = require('./tokenMonitor');
const { startHalvingMonitor } = require('./strategies/halvingDetector');
const { startStakingTracker } = require('./strategies/stakingTracker');
const { startTokenScoringEngine } = require('./strategies/tokenScoringEngine');
const { startDexActivityWatcher } = require('./strategies/dexActivityWatcher');

startTokenMonitor();
startHalvingMonitor();
startStakingTracker();
startTokenScoringEngine();
startDexActivityWatcher();
