require('dotenv').config();
const { launchBot } = require('./handlers/telegramHandler');

console.log('Million Accelerator Bot started');
launchBot();
