const WebSocket = require('ws');
const { sendTelegramMessage } = require('../telegram');
const tokens = require('../database/tokens.json');

const ALCHEMY_WSS = process.env.ALCHEMY_WSS;
const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
const IMPORTANT_WALLETS = (process.env.IMPORTANT_WALLETS || '')
  .split(',')
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MIN_VALUE = 10000n * 10n ** 18n; // 10k tokens with 18 decimals

function logDebug(msg) {
  if (DEBUG) {
    console.log(msg);
  }
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'unknown';
}

function getTokenSymbol(address) {
  const entry = tokens.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
  return entry ? entry.symbol : shortAddr(address);
}

function startErc20Watcher() {
  if (!ALCHEMY_WSS) {
    console.error('ALCHEMY_WSS is not defined');
    return;
  }

  const ws = new WebSocket(ALCHEMY_WSS);

  ws.on('open', () => {
    logDebug('🛰️ WebSocket подключен к Alchemy для ERC-20 мониторинга');
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_subscribe',
      params: [
        'alchemy_filteredFullPendingTransactions',
        { topics: [TRANSFER_TOPIC] },
      ],
    };
    ws.send(JSON.stringify(payload));
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      const tx = msg?.params?.result;
      if (!tx || !Array.isArray(tx.logs)) return;

      for (const log of tx.logs) {
        if (!log.topics || log.topics[0] !== TRANSFER_TOPIC) continue;

        const from = '0x' + log.topics[1].slice(26);
        const to = '0x' + log.topics[2].slice(26);

        const involved =
          IMPORTANT_WALLETS.length === 0 ||
          IMPORTANT_WALLETS.includes(from.toLowerCase()) ||
          IMPORTANT_WALLETS.includes(to.toLowerCase());
        if (!involved) continue;

        const value = BigInt(log.data);
        if (value < MIN_VALUE) continue;

        const tokenAddress = log.address;
        const symbol = getTokenSymbol(tokenAddress);
        const amount = value / 10n ** 18n;
        const message = `🚀 ERC-20 Transfer >10K$: ${symbol} from: ${shortAddr(from)} to: ${shortAddr(to)}, value: ${amount}`;
        logDebug(message);
        await sendTelegramMessage(message);
      }
    } catch (err) {
      console.error('Ошибка обработки ERC-20 события:', err.message);
    }
  });

  ws.on('close', () => {
    console.warn('🔌 ERC-20 WebSocket закрыт, переподключение через 5с...');
    setTimeout(startErc20Watcher, 5000);
  });

  ws.on('error', (err) => {
    console.error('🚨 Ошибка WebSocket ERC-20 Watcher:', err.message);
  });
}

module.exports = { startErc20Watcher };
