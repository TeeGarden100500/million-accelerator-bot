const fs = require('fs');
const { TOKENS_FILE } = require('../config/settings');
const { sendAlert } = require('./alertService');

function watchTokens() {
  let data;
  try {
    data = fs.readFileSync(TOKENS_FILE, 'utf8');
  } catch (err) {
    console.error(`Не удалось прочитать файл токенов: ${err.message}`);
    return;
  }

  let tokens;
  try {
    tokens = JSON.parse(data);
  } catch (err) {
    console.error(`Некорректный JSON в файле токенов: ${err.message}`);
    return;
  }

  if (!Array.isArray(tokens)) {
    console.error('Файл токенов должен содержать массив объектов');
    return;
  }

  tokens.forEach(({ symbol, address }) => {
    if (!symbol || !address) return;
    console.log(`${symbol}: ${address}`);
    sendAlert(`Найден токен: ${symbol} (${address})`);
  });
}

module.exports = { watchTokens };

