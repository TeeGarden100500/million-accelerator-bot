const WebSocket = require('ws');
const { sendTelegramMessage } = require('../telegram');
const { saveToHistory } = require('../src/utils/historyLogger');
const tokens = require('../database/tokens.json');
const { isImportantWallet } = require('../src/utils/importantWallets');
const settings = require('../config/settings');
const { getTokenPrice } = require('../services/geckoService');

const ALCHEMY_WSS = process.env.ALCHEMY_WSS;
const LOG_LEVEL = process.env.DEBUG_LOG_LEVEL || 'info';
const DEBUG = LOG_LEVEL === 'debug' || LOG_LEVEL === 'verbose';
const VERBOSE = LOG_LEVEL === 'verbose';

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

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
          isImportantWallet(from) || isImportantWallet(to);
        if (!involved) continue;

        const value = BigInt(log.data);

        const tokenAddress = log.address;
        const symbol = getTokenSymbol(tokenAddress);
        const amount = Number(value) / 1e18;

        const price = await getTokenPrice({ address: tokenAddress, symbol });
        const usdAmount = amount * price;

        if (usdAmount < settings.MIN_TX_USD) {
          if (VERBOSE) {
            console.log(
              `[FILTER] ${symbol} transfer below $${settings.MIN_TX_USD}: $${usdAmount.toFixed(2)}`
            );
          }
          continue;
        }

        const message = `🚀 ERC-20 Transfer >$${settings.MIN_TX_USD}: ${symbol} from: ${shortAddr(from)} to: ${shortAddr(to)}, value: ${amount}`;
        logDebug(message);
        await sendTelegramMessage(message);
        saveToHistory({
          timestamp: new Date().toISOString(),
          hash: tx.hash,
          from,
          to,
          tokenSymbol: symbol,
          amount: amount.toString(),
          usdValue: usdAmount,
        });
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
