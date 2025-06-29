const fs = require('fs');
const path = require('path');

let importantWallets = [];

try {
  // config directory is located one level above src
  const filePath = path.resolve(__dirname, '../../config/important-wallets.json');
  const data = fs.readFileSync(filePath, 'utf-8');
  importantWallets = JSON.parse(data).map(addr => addr.toLowerCase());
} catch (err) {
  console.error('[\u26A0\uFE0F] \u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C important-wallets.json:', err.message);
}

function isImportantWallet(address) {
  if (!address) return false;
  return importantWallets.includes(address.toLowerCase());
}

module.exports = { isImportantWallet };
