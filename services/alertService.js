const axios = require('axios');

async function sendAlert(message) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error.response?.data || error.message);
  }
}

module.exports = { sendAlert };
