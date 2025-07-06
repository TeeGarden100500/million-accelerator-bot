const fs = require('fs');
const path = require('path');

const RECOVERY_LOG = path.join(__dirname, '..', 'logs', 'moduleRecovery.log');

function logRecovery(message) {
  fs.mkdirSync(path.dirname(RECOVERY_LOG), { recursive: true });
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(RECOVERY_LOG, line);
}

function sendHeartbeat(moduleName) {
  if (process.send) {
    process.send({
      type: 'heartbeat',
      module: moduleName,
      memory: process.memoryUsage().rss,
    });
  }
}

module.exports = { logRecovery, sendHeartbeat };
