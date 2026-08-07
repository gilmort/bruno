const { ipcMain } = require('electron');
const { execFile } = require('child_process');

// Runs a command, capturing stdout/stderr. Resolves { success, output }.
const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: 120000, ...opts }, (err, stdout, stderr) => {
      const output = `${stdout || ''}${stderr || ''}`.trim();
      if (err) return resolve({ success: false, error: err.message, output });
      resolve({ success: true, output });
    });
  });

const registerGilmortControlIpc = () => {
  // make up / make down in the qa-compose directory.
  // action: 'up' | 'down' | 'restart'. cwd is the composePath from config.
  ipcMain.handle('renderer:gilmort-compose', async (event, { action, cwd } = {}) => {
    if (!cwd) return { success: false, error: 'composePath não configurado nas Gilmort Configs' };
    if (!['up', 'down', 'restart'].includes(action)) {
      return { success: false, error: `ação inválida: ${action}` };
    }
    if (action === 'restart') {
      const down = await run('make', ['down'], { cwd });
      if (!down.success) return down;
      return run('make', ['up'], { cwd });
    }
    return run('make', [action], { cwd });
  });

  // Per-container control via docker. action: 'start' | 'stop' | 'restart'.
  ipcMain.handle('renderer:gilmort-container', async (event, { action, container } = {}) => {
    if (!container) return { success: false, error: 'container vazio' };
    if (!['start', 'stop', 'restart'].includes(action)) {
      return { success: false, error: `ação inválida: ${action}` };
    }
    return run('docker', [action, container]);
  });
};

module.exports = registerGilmortControlIpc;
