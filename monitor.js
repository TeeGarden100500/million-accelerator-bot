const axios = require('axios');
const { sendTelegramMessage, sendTelegramAlert } = require('./telegram');
const { checkPumpSignal } = require('./src/strategies/pumpProfitSniper');
const settings = require('./config/settings');

// Токены для мониторинга
const TOKENS = [
  { name: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' },
  { name: 'DEGEN', address: '0xA5E59761eBD4436fa4d20E1A27cBa29FB2471Fc6' },
];

// Проверяем объем торгов через Dexscreener
async function analyzeTokens() {
  for (const token of TOKENS) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${token.address}`;
      const res = await axios.get(url);

      const data = res.data.pairs?.[0];
      if (!data) continue;

      const volume24h = parseFloat(data.volume?.h24Usd || 0);
      const volume1h = parseFloat(data.volume?.h1Usd || 0);
      const priceChange = parseFloat(data.priceChange?.h1 || 0);
      const prevVolume = volume24h - volume1h;
      const volumeChangePercent = prevVolume > 0 ? (volume1h / prevVolume) * 100 : 0;

      if (volume24h > 10000) {
        await sendTelegramMessage(
          `💰 Объем по ${token.name}: $${volume24h.toLocaleString()} — токен интересен.\n🔗 ${data.url}`
        );
      }

      checkPumpSignal({
        symbol: token.name,
        priceChangePercent: priceChange,
        volumeChangePercent,
      });
    } catch (err) {
      console.error(`Ошибка при анализе ${token.name}:`, err.message);
    }
  }
}

module.exports = { analyzeTokens };
