const WebSocket = require('ws');
const axios = require('axios');
const { sendTelegramMessage } = require('./utils/telegram');
const { isImportantWallet } = require('./utils/importantWallets');
require('dotenv').config();

const ALCHEMY_WSS = process.env.ALCHEMY_WSS;
const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';

function logDebug(message) {
  if (DEBUG) {
    console.log(message);
  }
}

function startSafeAlchemyTxWatcher() {
  const ws = new WebSocket(ALCHEMY_WSS);

  ws.on('open', () => {
    logDebug('🔌 WebSocket открыт');
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: ['alchemy_minedTransactions', { includeRemoved: false }]
    };
    ws.send(JSON.stringify(payload));
  });

  ws.on('message', async (data) => {
    try {
      const parsed = JSON.parse(data);
      const txHash = parsed?.params?.result?.hash;
      if (!txHash || txHash === 'undefined') return;

      const txDetails = await axios.post(
        ALCHEMY_WSS.replace('wss', 'https'),
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getTransactionByHash',
          params: [txHash]
        },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const tx = txDetails?.data?.result;
      if (!tx || !tx.from || !tx.to || !tx.hash) return;

      if (!isImportantWallet(tx.from) && !isImportantWallet(tx.to)) return;

      const message = `📦 Новая транзакция:\nот ${tx.from}\nк ${tx.to}\nhash: ${tx.hash}`;
      logDebug(message);
      await sendTelegramMessage(message);
    } catch (err) {
      console.error('❌ Ошибка при обработке транзакции:', err.message);
    }
  });

  ws.on('close', () => console.warn('❗ WebSocket закрыт, повторное подключение...'));
  ws.on('error', (err) => console.error('❗ Ошибка WebSocket:', err.message));
}

module.exports = { startSafeAlchemyTxWatcher };
