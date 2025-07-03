const settings = require('../../config/settings');
const { sendTelegramAlert } = require('../utils/telegram');
const { saveToHistory } = require('../utils/historyLogger');

function checkPumpSignal(tokenData) {
  if (!tokenData) return false;
  const {
    symbol = 'Unknown',
    priceChangePercent = 0,
    volumeChangePercent = 0,
  } = tokenData;

  const priceOk = priceChangePercent >= settings.PUMP_PROFIT_THRESHOLD_PRICE;
  const volumeOk = volumeChangePercent >= settings.PUMP_PROFIT_THRESHOLD_VOLUME;

  if (priceOk && volumeOk) {
    const message = `🚀 Всплеск активности!\nТокен: ${symbol}\nЦена: +${priceChangePercent}% | Объём: +${volumeChangePercent}%\nВозможен памп — проверь на DEX!`;
    sendTelegramAlert(message);
    saveToHistory({
      timestamp: new Date().toISOString(),
      type: 'PumpProfitSniper',
      token: symbol,
      priceChange: priceChangePercent,
      volumeChange: volumeChangePercent,
    });
    return true;
  }
  return false;
}

module.exports = { checkPumpSignal };
