const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const { sendTelegramMessage } = require('./telegram');
const { logRecovery } = require('./utils/moduleMonitor');

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes
const LOG_FILE = path.join(__dirname, 'logs', 'uptime.log');
const RESTARTS_FILE = path.join(__dirname, 'logs', 'restarts.json');

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function log(message) {
  ensureDir(LOG_FILE);
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

function loadRestarts() {
  try {
    if (fs.existsSync(RESTARTS_FILE)) {
      return JSON.parse(fs.readFileSync(RESTARTS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to load restarts:', err.message);
  }
  return [];
}

function saveRestarts(data) {
  ensureDir(RESTARTS_FILE);
  try {
    fs.writeFileSync(RESTARTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save restarts:', err.message);
  }
}

const workers = [
  { name: 'backgroundWorker.js', script: path.join(__dirname, 'backgroundWorker.js') },
  { name: 'signalScanner.js', script: path.join(__dirname, 'signalScanner.js') },
  { name: 'reportScheduler.js', script: path.join(__dirname, 'reportScheduler.js') },
  { name: 'riskAlerts.js', script: path.join(__dirname, 'src', 'strategies', 'riskAlerts.js') },
  { name: 'tokenScanner.js', script: path.join(__dirname, 'src', 'services', 'tokenScanner.js') },
];

workers.forEach(w => {
  w.process = null;
  w.attempts = 0;
  w.lastHeartbeat = Date.now();
});

const restartHistory = loadRestarts();

function spawnWorker(worker) {
  if (!fs.existsSync(worker.script)) {
    log(`${worker.name} not found at ${worker.script}`);
    return;
  }
  try {
    if (worker.process && isRunning(worker.process)) {
      return;
    }
    worker.process = fork(worker.script);
    worker.attempts = 0;
    worker.lastHeartbeat = Date.now();
    worker.process.on('message', msg => {
      if (msg && msg.type === 'heartbeat') {
        worker.lastHeartbeat = Date.now();
      }
    });
    worker.process.on('exit', (code, signal) => {
      logRecovery(`${worker.name} exited with code ${code} signal ${signal}`);
    });
    log(`${worker.name} started (pid ${worker.process.pid})`);
  } catch (err) {
    log(`${worker.name} failed to start: ${err.message}`);
    logRecovery(`${worker.name} failed to start: ${err.message}`);
  }
}

function recordRestart(worker, success) {
  const entry = {
    module: worker.name,
    time: new Date().toISOString(),
    success,
    attempts: worker.attempts,
  };
  restartHistory.push(entry);
  saveRestarts(restartHistory);
}

function restartWorker(worker, reason = 'unresponsive') {
  worker.attempts += 1;
  log(`Restarting ${worker.name}, attempt ${worker.attempts}`);
  logRecovery(`${worker.name} restarting: ${reason}`);
  const header = `❗ Модуль ${worker.name} перестал отвечать.\n🔄 Попытка перезапуска...`;
  if (worker.process) {
    try { worker.process.kill(); } catch (_) {}
  }
  spawnWorker(worker);
  const success = !!(worker.process && worker.process.pid);
  recordRestart(worker, success);
  const status = success ? '✅ Перезапуск успешен.' : '❌ Перезапуск неудачен.';
  sendTelegramMessage(`${header}\n${status}`).catch(() => {});
  if (!success && worker.attempts < 3) {
    setTimeout(() => restartWorker(worker, reason), 10000);
  }
}

function isRunning(proc) {
  return proc && proc.connected && proc.exitCode == null;
}

function checkWorkers() {
  workers.forEach(worker => {
    const now = Date.now();
    if (!isRunning(worker.process)) {
      restartWorker(worker, 'stopped');
    } else if (now - worker.lastHeartbeat > CHECK_INTERVAL) {
      restartWorker(worker, 'no heartbeat');
    } else {
      log(`${worker.name} running (pid ${worker.process.pid})`);
    }
  });
}

function start() {
  log('Smart Deployment Manager started');
  workers.forEach(spawnWorker);
  setInterval(checkWorkers, CHECK_INTERVAL);
  checkWorkers();
}

module.exports = { start };
