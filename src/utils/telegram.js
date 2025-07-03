const axios = require('axios');

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
  } catch (error) {
    console.error('Ошибка отправки Telegram-сообщения:', error.message);
  }
}

async function sendTelegramAlert(message) {
  await sendTelegramMessage(message);
}

module.exports = { sendTelegramMessage, sendTelegramAlert };
