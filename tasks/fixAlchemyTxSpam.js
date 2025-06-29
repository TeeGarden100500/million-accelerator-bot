/**
 * Цель: починить спам-ошибку в боте Telegram,
 * связанную с WebSocket-подпиской Alchemy.
 */

const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

const { sendTelegramMessage } = require('../telegram');
const { isImportantWallet } = require('../src/utils/importantWallets');

const wsUrl = process.env.ALCHEMY_WSS;

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('[WebSocket] Connected to Alchemy');
  ws.send(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: ['alchemy_minedTransactions', { includeRemoved: false, hashesOnly: true }],
    })
  );
});

ws.on('message', async (data) => {
  try {
    const parsed = JSON.parse(data);
    if (parsed.method === 'eth_subscription') {
      const txHash = parsed.params?.result;
      if (!txHash || typeof txHash !== 'string') return;

      const response = await axios.post(
        wsUrl.replace('wss://', 'https://'),
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'eth_getTransactionByHash',
          params: [txHash],
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const tx = response.data?.result;
      if (!tx || !tx.from || !tx.to) return;

      if (!isImportantWallet(tx.from) && !isImportantWallet(tx.to)) return;

      const message = `\uD83C\uDF10 Новая транзакция:\nFrom: ${tx.from}\nTo: ${tx.to}\nHash: ${tx.hash}`;
      await sendTelegramMessage(message);
    }
  } catch (err) {
    console.error('[WebSocket Message Error]', err.message);
  }
});

ws.on('close', () => {
  console.warn('[WebSocket] Closed connection to Alchemy.');
});

ws.on('error', (err) => {
  console.error('[WebSocket Error]', err.message);
});
