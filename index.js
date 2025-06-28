require('dotenv').config();
const { launchBot } = require('./handlers/telegramHandler');
const { watchTokens } = require('./services/tokenWatcher');

console.log('Million Accelerator Bot started');
launchBot();
watchTokens();
