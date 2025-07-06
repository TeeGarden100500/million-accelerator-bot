const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

const { sendHeartbeat } = require('./utils/moduleMonitor');
const MODULE_NAME = 'backgroundWorker.js';

const INTERVAL_MS = 60 * 1000; // 1 minute
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let running = false;

async function performTasks() {
  logDebug('[backgroundWorker] performing background tasks');
  // TODO: implement actual tasks
}

async function runLoop() {
  while (running) {
    logDebug('[backgroundWorker] iteration start');
    try {
      await performTasks();
      logDebug('[backgroundWorker] iteration complete');
    } catch (err) {
      console.error('[backgroundWorker] task error:', err.message);
    }
    sendHeartbeat(MODULE_NAME);
    if (!running) break;
    await delay(INTERVAL_MS);
  }
  logDebug('[backgroundWorker] loop stopped');
}

function startBackgroundWorker() {
  if (running) return;
  running = true;
  logDebug('[backgroundWorker] started');
  sendHeartbeat(MODULE_NAME);
  runLoop();
}

function stopBackgroundWorker() {
  running = false;
  logDebug('[backgroundWorker] stopping...');
}

process.on('uncaughtException', err => {
  console.error('[backgroundWorker] uncaught exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', err => {
  console.error('[backgroundWorker] unhandled rejection:', err);
  process.exit(1);
});

if (require.main === module) {
  startBackgroundWorker();
  process.on('SIGINT', () => {
    stopBackgroundWorker();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopBackgroundWorker();
    process.exit(0);
  });
}

module.exports = { startBackgroundWorker, stopBackgroundWorker };
