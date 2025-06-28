const axios = require('axios');
const { sendTelegramMessage } = require('./telegram');

// Захардкоженные токены (примерные адреса)
const TOKENS = [
  { name: 'DEGEN', address: '0xA5E59761eBD4436fa4d20E1A27cBa29FB2471Fc6' },
  { name: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' }
];

// Простейший фильтр: "новый токен, объем выше 1000"
async function analyzeTokens() {
  for (const token of TOKENS) {
    // Пример запроса: заглушка
    const isInteresting = Math.random() > 0.5;

    if (isInteresting) {
      await sendTelegramMessage(`🔥 Найден интересный токен: ${token.name}\n(${token.address})`);
    }
  }
}

module.exports = { analyzeTokens };
