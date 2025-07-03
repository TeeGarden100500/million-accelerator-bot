const fs = require('fs');
const path = require('path');

const HISTORY_PATH = path.join(__dirname, '..', '..', 'storage', 'history.json');
const MAX_ENTRIES = 100;

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      const data = fs.readFileSync(HISTORY_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read history file:', err.message);
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Failed to write history file:', err.message);
  }
}

function saveToHistory(entry) {
  const history = loadHistory();
  history.push(entry);
  if (history.length > MAX_ENTRIES) {
    history.splice(0, history.length - MAX_ENTRIES);
  }
  saveHistory(history);
}

module.exports = { saveToHistory };
