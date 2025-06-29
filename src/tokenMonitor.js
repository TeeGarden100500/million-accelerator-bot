const WebSocket = require('ws');
const { sendTelegramMessage } = require('./utils/telegram');

const UNISWAP_WSS = `wss://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`;

// Топик логов создания пар UniswapV2
const PAIR_CREATED_TOPIC = '0x0d3648bd0f6bae9f657ba61e3e8ceab7...';

const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) {
    console.log(msg);
  }
}

function startTokenMonitor() {
  const ws = new WebSocket(UNISWAP_WSS);

  ws.on('open', () => {
    logDebug('🛰️ WebSocket подключен к Alchemy для мониторинга новых токенов');
    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_subscribe',
        params: [
          'logs',
          {
            address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
            topics: [PAIR_CREATED_TOPIC],
          },
        ],
      })
    );
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg?.params?.result?.topics) {
        const log = msg.params.result;
        const token0 = '0x' + log.topics[1].slice(26);
        const token1 = '0x' + log.topics[2].slice(26);

        const alert = `🆕 Обнаружен новый токеновый пул:\nToken0: ${token0}\nToken1: ${token1}`;
        console.log(alert);
        await sendTelegramMessage(alert);
      }
    } catch (err) {
      console.error('Ошибка при разборе токенов:', err.message);
    }
  });

  ws.on('close', () => {
    console.warn('🔌 WebSocket отключен, перезапуск...');
    setTimeout(startTokenMonitor, 5000);
  });

  ws.on('error', (err) => {
    console.error('🚨 Ошибка WebSocket:', err.message);
  });
}

module.exports = { startTokenMonitor };
