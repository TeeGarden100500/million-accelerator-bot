const DEBUG = process.env.DEBUG_LOG_LEVEL === 'debug';
function logDebug(msg) {
  if (DEBUG) console.log(msg);
}

let timer;

async function performTasks() {
  logDebug('[backgroundWorker] performing background tasks');
  // TODO: implement actual tasks
}

function scheduleNext() {
  timer = setTimeout(async () => {
    try {
      await performTasks();
    } catch (err) {
      console.error('[backgroundWorker] task error:', err.message);
    }
    scheduleNext();
  }, 60000);
}

function startBackgroundWorker() {
  logDebug('[backgroundWorker] started');
  scheduleNext();
}

function stopBackgroundWorker() {
  if (timer) clearTimeout(timer);
  logDebug('[backgroundWorker] stopped');
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
