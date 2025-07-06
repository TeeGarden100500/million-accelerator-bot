require('dotenv').config();
console.log('Million Accelerator Bot started');

const { startTokenMonitor } = require('./tokenMonitor');
const { startHalvingMonitor } = require('./strategies/halvingDetector');

startTokenMonitor();
startHalvingMonitor();
