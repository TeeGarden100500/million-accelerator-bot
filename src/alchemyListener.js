const WebSocket = require('ws');
const { sendTelegramMessage } = require('./utils/telegram');

const ALCHEMY_WSS = process.env.ALCHEMY_WSS;
const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';

function logDebug(msg) {
  if (DEBUG) {
    console.log(msg);
  }
}

function startAlchemyListener() {
  if (!ALCHEMY_WSS) {
    console.error('ALCHEMY_WSS is not defined');
    return;
  }

  const ws = new WebSocket(ALCHEMY_WSS);

  ws.on('open', () => {
    logDebug('🛰️ Подключение к Alchemy WebSocket установлено');
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_subscribe',
        params: [
          'alchemy_minedTransactions',
          {
            addresses: [],
            includeRemoved: false,
            hashesOnly: false,
          },
        ],
      })
    );
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      const tx = msg?.params?.result;
      if (tx) {
        const text = `💸 Новая транзакция: от ${tx.from} к ${tx.to}, hash: ${tx.hash}`;
        logDebug(text);
        await sendTelegramMessage(text);
      }
    } catch (err) {
      console.error('Ошибка обработки события Alchemy:', err.message);
    }
  });

  ws.on('close', () => {
    console.warn('🔌 Соединение с Alchemy закрыто, переподключение через 5с...');
    setTimeout(startAlchemyListener, 5000);
  });

  ws.on('error', (err) => {
    console.error('🚨 Ошибка WebSocket Alchemy:', err.message);
  });
}

module.exports = { startAlchemyListener };
