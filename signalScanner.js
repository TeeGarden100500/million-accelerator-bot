const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const { sendHeartbeat } = require('./utils/moduleMonitor');
const MODULE_NAME = 'signalScanner.js';

const INTERVAL_MS = 60 * 1000; // 1 minute
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let running = false;

async function scanSignals() {
  logDebug('[signalScanner] scanning for signals');
  // TODO: implement real signal scanning logic
}

async function runLoop() {
  while (running) {
    logDebug('[signalScanner] iteration start');
    try {
      await scanSignals();
      logDebug('[signalScanner] iteration complete');
    } catch (err) {
      console.error('[signalScanner] scan error:', err.message);
    }
    sendHeartbeat(MODULE_NAME);
    if (!running) break;
    await delay(INTERVAL_MS);
  }
  logDebug('[signalScanner] loop stopped');
}

function startSignalScanner() {
  if (running) return;
  running = true;
  logDebug('[signalScanner] started');
  sendHeartbeat(MODULE_NAME);
  runLoop();
}

function stopSignalScanner() {
  running = false;
  logDebug('[signalScanner] stopping...');
}

process.on('uncaughtException', err => {
  console.error('[signalScanner] uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', err => {
  console.error('[signalScanner] unhandled rejection:', err);
  process.exit(1);
});

if (require.main === module) {
  startSignalScanner();
  process.on('SIGINT', () => {
    stopSignalScanner();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopSignalScanner();
    process.exit(0);
  });
}

module.exports = { startSignalScanner, stopSignalScanner };
