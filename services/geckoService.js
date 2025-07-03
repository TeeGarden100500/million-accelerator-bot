const axios = require('axios');

async function fetchTokenList() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 100,
        page: 1,
        sparkline: false
      }
    });

    const tokens = response.data
      .filter(token =>
        token.price_change_percentage_24h > 20 &&
        token.total_volume > 500000
      )
      .map(token => ({
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        price: token.current_price,
        marketCap: token.market_cap,
        volume: token.total_volume,
        change24h: token.price_change_percentage_24h
      }));

    return tokens;
  } catch (error) {
    console.error('Ошибка при получении токенов с CoinGecko:', error.message);
    return [];
  }
}

/**
 * Get current token price in USD by contract address or symbol.
 * @param {Object} opts
 * @param {string} [opts.address] - ERC-20 contract address
 * @param {string} [opts.symbol] - Token symbol or CoinGecko id
 * @returns {Promise<number>} Price in USD or 0 on failure
 */
async function getTokenPrice({ address, symbol }) {
  try {
    let url;
    let params;

    if (address) {
      url = 'https://api.coingecko.com/api/v3/simple/token_price/ethereum';
      params = { contract_addresses: address, vs_currencies: 'usd' };
    } else if (symbol) {
      url = 'https://api.coingecko.com/api/v3/simple/price';
      params = { ids: symbol.toLowerCase(), vs_currencies: 'usd' };
    } else {
      return 0;
    }

    const response = await axios.get(url, { params });

    if (address) {
      const data = response.data[address.toLowerCase()];
      return data?.usd ?? 0;
    }

    const data = response.data[symbol.toLowerCase()];
    return data?.usd ?? 0;
  } catch (error) {
    console.error('Ошибка при получении цены токена с CoinGecko:', error.message);
    return 0;
  }
}

module.exports = { fetchTokenList, getTokenPrice };
