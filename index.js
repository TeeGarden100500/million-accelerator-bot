require('dotenv').config();
console.log('Million Accelerator Bot started');

// ==== Render Port Binding Dummy Server ====
const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Million Accelerator Bot is running.\n');
}).listen(PORT, () => {
  console.log(`Dummy server listening on port ${PORT}`);
});

const { analyzeTokens } = require('./monitor');

(async () => {
  console.log('🚀 Запуск анализа токенов...');
  await analyzeTokens();
})();
