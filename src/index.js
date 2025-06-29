require('dotenv').config();
console.log('Million Accelerator Bot started');

const { startTokenMonitor } = require('./tokenMonitor');
startTokenMonitor();
