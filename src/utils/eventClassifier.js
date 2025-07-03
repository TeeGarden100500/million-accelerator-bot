const fs = require('fs');
const path = require('path');

const VERBOSE = process.env.DEBUG_LOG_LEVEL === 'verbose';

const FLASH_HISTORY_PATH = path.join(__dirname, '..', '..', 'storage', 'flashHistory.json');
const ADDRESS_LABELS_PATH = path.join(__dirname, '..', '..', 'config', 'address-labels.json');

function loadJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`Failed to read ${path.basename(filePath)}:`, err.message);
  }
  return defaultValue;
}

function saveJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Failed to write ${path.basename(filePath)}:`, err.message);
  }
}

/**
 * Classify transaction event and update flash history.
 * @param {Object} tx - Transaction data
 * @param {string} tx.from
 * @param {string} tx.to
 * @param {string|number} tx.value
 * @param {string} tx.tokenSymbol
 * @param {number} tx.usdValue
 * @param {string|number|Date} tx.timestamp
 * @returns {string[]} Array of tags
 */
function classifyTxEvent(tx) {
  const tags = [];
  if (!tx) return tags;

  const nowTs = new Date(tx.timestamp || Date.now()).getTime();

  const addressLabels = loadJson(ADDRESS_LABELS_PATH, {});
  const label = addressLabels[tx.from?.toLowerCase()];
  if (label && label.type === 'smart') {
    tags.push('SmartMoney');
  }
  if (label && label.type === 'deployer') {
    tags.push('Deployer');
  }

  if (typeof tx.usdValue === 'number' && tx.usdValue > 1_000_000) {
    tags.push('Whale');
  }

  const history = loadJson(FLASH_HISTORY_PATH, {});
  const lastActive = history[tx.from?.toLowerCase()];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  if (!lastActive || nowTs - new Date(lastActive).getTime() > THIRTY_DAYS_MS) {
    tags.push('Flash');
  }
  history[tx.from?.toLowerCase()] = new Date(nowTs).toISOString();
  saveJson(FLASH_HISTORY_PATH, history);

  if (VERBOSE && tags.length) {
    console.log(`[eventClassifier] Tags for ${tx.from} -> ${tags.join(', ')}`);
  }

  return tags;
}

module.exports = { classifyTxEvent };
