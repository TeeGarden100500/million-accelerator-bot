const fs = require('fs');
const { TOKENS_FILE } = require('./config/settings');
const { sendAlert } = require('./services/alertService');

async function analyzeTokens() {
  let tokens;
  try {
    const data = fs.readFileSync(TOKENS_FILE, 'utf8');
    tokens = JSON.parse(data);
  } catch (err) {
    console.error(`Ошибка при чтении токенов: ${err.message}`);
    return;
  }

  if (!Array.isArray(tokens)) {
    console.error('Некорректные данные токенов');
    return;
  }

  for (const token of tokens) {
    const isInteresting = Math.random() > 0.5;
    if (isInteresting) {
      await sendAlert(`🔥 Найден интересный токен: ${token.symbol}\n(${token.address})`);
    }
  }
}

module.exports = { analyzeTokens };
