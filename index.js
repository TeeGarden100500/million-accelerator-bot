require('dotenv').config();
const bot = require('./handlers/telegramHandler');

bot.launch();
console.log('Million Accelerator Bot started');
