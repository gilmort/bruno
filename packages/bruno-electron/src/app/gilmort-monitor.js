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
const httpGet = async (url) => {
  const res = await axios.get(url, { timeout: 3000, validateStatus: () => true });
  return res.status;
};

const dockerInspect = (container) =>
  new Promise((resolve, reject) => {
    execFile('docker', ['inspect', '-f', '{{.State.Running}}', container], { timeout: 3000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim() === 'true');
    });
  });

class GilmortMonitor {
  constructor() {
    this.timeoutId = null;
    this.isMonitoring = false;
  }

  async checkService(service, deps = { httpGet, dockerInspect }) {
    const expectedStatus = service.expectedStatus ?? 200;

    let httpStatus = null;
    try {
      httpStatus = await deps.httpGet(service.healthUrl);
    } catch (_) {
      httpStatus = null;
    }

    let containerUp = null;
    if (service.container) {
      try {
        containerUp = await deps.dockerInspect(service.container);
      } catch (_) {
        containerUp = false;
      }
    }

    const status = computeStatus({ containerUp, httpStatus, expectedStatus });
    return { name: service.name, status, containerUp, httpStatus, expectedStatus };
  }

  start(win, { collectionUid, services }, intervalMs = 5000) {
    this.stop();
    this.isMonitoring = true;
    this.collectionUid = collectionUid;
    this.services = services || [];
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
      const results = await Promise.all(this.services.map((s) => this.checkService(s)));
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
