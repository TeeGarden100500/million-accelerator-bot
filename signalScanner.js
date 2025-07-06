const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

let timer;

async function scanSignals() {
  logDebug('[signalScanner] scanning for signals');
  // TODO: implement real signal scanning logic
}

function scheduleNext() {
  timer = setTimeout(async () => {
    try {
      await scanSignals();
    } catch (err) {
      console.error('[signalScanner] scan error:', err.message);
    }
    scheduleNext();
  }, 60000); // run every minute
}

function startSignalScanner() {
  logDebug('[signalScanner] started');
  scheduleNext();
}

function stopSignalScanner() {
  if (timer) clearTimeout(timer);
  logDebug('[signalScanner] stopped');
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
