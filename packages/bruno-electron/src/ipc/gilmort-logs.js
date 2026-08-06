const { ipcMain } = require('electron');
const { spawn } = require('child_process');

class GilmortLogsManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> { procs: ChildProcess[], webContents }
    this.setupIpcHandlers();
  }

  setupIpcHandlers() {
    ipcMain.handle('gilmort-logs:start', (event, options = {}) => {
      try {
        const containers = options.containers || [];
        const sessionId = `gilmort_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const procs = [];

        containers.forEach((container) => {
          const proc = spawn('docker', ['logs', '-f', '--tail', '200', container]);
          const forward = (buf) => {
            if (!event.sender || event.sender.isDestroyed()) return;
            buf
              .toString()
              .split('\n')
              .filter((l) => l.length)
              .forEach((line) => event.sender.send(`gilmort-logs:data:${sessionId}`, { service: container, line }));
          };
          proc.stdout.on('data', forward);
          proc.stderr.on('data', forward);
          proc.on('error', (err) => {
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send(`gilmort-logs:data:${sessionId}`, { service: container, line: `[error] ${err.message}` });
            }
          });
          procs.push(proc);
        });

        this.sessions.set(sessionId, { procs, webContents: event.sender });
        return sessionId;
      } catch (error) {
        console.error('Failed to start gilmort logs:', error);
        return null;
      }
    });

    ipcMain.on('gilmort-logs:stop', (event, sessionId) => {
      this.kill(sessionId);
    });
  }

  kill(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.procs.forEach((p) => {
      try { p.kill(); } catch (_) {}
    });
    this.sessions.delete(sessionId);
  }

  cleanup(webContents) {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.webContents === webContents) this.kill(sessionId);
    }
  }

  killAll() {
    for (const sessionId of this.sessions.keys()) this.kill(sessionId);
  }
}

module.exports = GilmortLogsManager;
