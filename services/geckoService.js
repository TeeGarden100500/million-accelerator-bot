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

    const tokens = response.data.map(token => ({
      id: token.id,
      symbol: token.symbol,
      name: token.name,
      price: token.current_price,
      marketCap: token.market_cap,
      volume: token.total_volume
    }));

    return tokens;
  } catch (error) {
    console.error('Ошибка при получении токенов с CoinGecko:', error.message);
    return [];
  }
}

module.exports = { fetchTokenList };
