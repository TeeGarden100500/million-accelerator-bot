const WebSocket = require('ws');
const { sendTelegramMessage } = require('./utils/telegram');
const { isImportantWallet } = require('./utils/importantWallets');

// Контракты, за которыми следим
const KNOWN_CONTRACTS = {
  UniswapV2: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  UniswapV3: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '1inch': '0x1111111254EEB25477B68fb85Ed929f73A960582',
  Sushiswap: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
};

const ALCHEMY_WSS = process.env.ALCHEMY_WSS;
const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';

function logDebug(msg) {
  if (DEBUG) {
    console.log(msg);
  }
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'unknown';
}

function formatEther(value) {
  const wei = BigInt(value);
  const eth = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 2);
  return frac === '00' ? eth.toString() : `${eth}.${frac}`;
}

const TEN_ETH_WEI = 10n * 10n ** 18n;

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
      if (!tx || !tx.from || !tx.to || !tx.hash || !tx.value) return;

      if (!isImportantWallet(tx.from) && !isImportantWallet(tx.to)) return;

      const valueWei = BigInt(tx.value);
      const transfers = Array.isArray(tx.logs)
        ? tx.logs.filter((l) => l.topics && l.topics[0] ===
            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef').length
        : 0;

      const toLower = tx.to.toLowerCase();
      const isWhitelisted = Object.values(KNOWN_CONTRACTS)
        .map((a) => a.toLowerCase()).includes(toLower);

      if (valueWei < TEN_ETH_WEI && !isWhitelisted && transfers <= 2) return;

      const name =
        Object.entries(KNOWN_CONTRACTS).find(([, addr]) => addr.toLowerCase() === toLower)?.[0] ||
        shortAddr(tx.to);

      const message = `💸 ${formatEther(valueWei)} ETH от ${shortAddr(tx.from)} к ${name}\n🔗 https://etherscan.io/tx/${tx.hash}`;
      logDebug(message);
      await sendTelegramMessage(message);
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
