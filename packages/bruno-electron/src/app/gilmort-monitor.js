// packages/bruno-electron/src/app/gilmort-monitor.js
// computeStatus: combine docker container state with HTTP health-check into a traffic light.
// containerUp: true|false|null (null = no container configured, docker step neutral)
// httpStatus: number|null (null = no response)
const computeStatus = ({ containerUp, httpStatus, expectedStatus }) => {
  const httpOk = httpStatus != null && httpStatus === expectedStatus;

  if (containerUp === null) {
    // No container configured: HTTP is the only signal.
    return httpOk ? 'green' : 'red';
  }

  if (containerUp && httpOk) return 'green';
  if (!containerUp && !httpOk) return 'red';
  return 'yellow'; // exactly one of the two is healthy
};

const axios = require('axios');
const { execFile } = require('child_process');

// Real probes ---------------------------------------------------------------
const httpGet = async (url, timeoutMs = 8000) => {
  const res = await axios.get(url, { timeout: timeoutMs, validateStatus: () => true });
  return res.status;
};

const dockerInspect = (container, timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    execFile('docker', ['inspect', '-f', '{{.State.Running}}', container], { timeout: timeoutMs }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim() === 'true');
    });
  });

class GilmortMonitor {
  constructor() {
    this.timeoutId = null;
    this.isMonitoring = false;
  }

  async checkService(service, deps = { httpGet, dockerInspect }, timeoutMs = 8000) {
    const expectedStatus = service.expectedStatus ?? 200;

    let httpStatus = null;
    try {
      httpStatus = await deps.httpGet(service.healthUrl, timeoutMs);
    } catch (_) {
      httpStatus = null;
    }

    let containerUp = null;
    if (service.container) {
      try {
        containerUp = await deps.dockerInspect(service.container, timeoutMs);
      } catch (_) {
        containerUp = false;
      }
    }

    const status = computeStatus({ containerUp, httpStatus, expectedStatus });
    return { name: service.name, status, containerUp, httpStatus, expectedStatus };
  }

  start(win, { collectionUid, services, pollIntervalMs, healthTimeoutMs }) {
    this.stop();
    this.isMonitoring = true;
    this.collectionUid = collectionUid;
    this.services = services || [];
    this.healthTimeoutMs = Number(healthTimeoutMs) > 0 ? Number(healthTimeoutMs) : 8000;
    const intervalMs = Number(pollIntervalMs) > 0 ? Number(pollIntervalMs) : 5000;
    this.emit(win);
    this.schedule(win, intervalMs);
  }

  schedule(win, intervalMs) {
    if (!this.isMonitoring) return;
    this.timeoutId = setTimeout(async () => {
      await this.emit(win);
      this.schedule(win, intervalMs);
    }, intervalMs);
  }

  async emit(win) {
    try {
      // Serial, not Promise.all: the health endpoints share one nginx and
      // firing all probes at once saturates it, tripping timeouts (yellow).
      const results = [];
      for (const s of this.services) {
        results.push(await this.checkService(s, undefined, this.healthTimeoutMs));
      }
      if (win && !win.isDestroyed()) {
        win.webContents.send('main:gilmort-status', { collectionUid: this.collectionUid, services: results });
      }
    } catch (err) {
      console.error('gilmort monitor emit failed', err);
    }
  }

  stop() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.isMonitoring = false;
  }

  isRunning() {
    return this.isMonitoring;
  }
}

module.exports = { computeStatus, GilmortMonitor };
