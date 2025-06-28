require('dotenv').config();
const { sendTelegramMessage } = require('./telegram');
const { analyzeTokens } = require('./monitor');
const http = require('http');

// Dummy server для Render
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Million Accelerator Bot is running\n');
}).listen(process.env.PORT || 10000);

async function start() {
  await sendTelegramMessage('\ud83d\udce1 Million Accelerator снова в строю. \u0426\u0438\u043a\u043b \u0437\u0430\u043f\u0443\u0449\u0435\u043d.');

  setInterval(async () => {
    console.log('\ud83d\udd75\ufe0f \u0426\u0438\u043a\u043b\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0430\u043d\u0430\u043b\u0438\u0437 \u0442\u043e\u043a\u0435\u043d\u043e\u0432...');
    await analyzeTokens();
  }, 5 * 60 * 1000); // 5 \u043c\u0438\u043d\u0443\u0442

  await analyzeTokens();
}

start();
