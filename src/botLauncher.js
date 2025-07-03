const { launchBot } = require('../handlers/telegramHandler');

function launchWebhookBot() {
  launchBot({
    webhook: {
      domain: 'https://million-accelerator-bot.onrender.com',
      port: process.env.PORT || 10000,
    },
  });

  console.log(
    '🚀 Webhook mode enabled. Bot listening on port',
    process.env.PORT || 10000,
  );

  // Graceful shutdown is handled inside Telegraf once launched
}

module.exports = { launchWebhookBot };
