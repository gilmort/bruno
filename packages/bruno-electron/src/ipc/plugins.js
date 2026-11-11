const path = require('path');
const os = require('os');
const { ipcMain } = require('electron');
const { cloneGitRepository } = require('../utils/git');

function registerPluginsIpc(mainWindow, loader) {
  const emitUpdated = () => {
    if (mainWindow) mainWindow.webContents.send('main:plugins-updated', loader.list());
  };

  ipcMain.handle('renderer:get-plugins', () => loader.list());

  ipcMain.handle('renderer:activate-plugin', (event, id) => {
    loader.activateMain(id);
    emitUpdated();
  });

  ipcMain.handle('renderer:reload-plugin', (event, id) => {
    // Reload direcionado (main re-require + evento p/ o renderer re-injetar só este
    // plugin). NÃO usa webContents.reload() — isso recarregava o app inteiro e
    // deixava o Bruno sem as coleções ("Loading...").
    loader.reload(id);
    if (mainWindow) mainWindow.webContents.send('main:plugin-reloaded', { id, plugins: loader.list() });
  });

  ipcMain.handle('renderer:set-plugin-enabled', (event, { id, enabled }) => {
    loader.setEnabled(id, enabled);
    if (mainWindow) mainWindow.webContents.send('main:plugin-toggled', { id, enabled, plugins: loader.list() });
  });

  ipcMain.handle('renderer:install-plugin-from-git', async (event, { url }) => {
    const pluginsDir = path.join(os.homedir(), '.bruno', 'plugins');
    const name = (url.split('/').pop() || 'plugin').replace(/\.git$/, '');
    await cloneGitRepository(mainWindow, { url, path: path.join(pluginsDir, name), processUid: `plugin-${name}` });
    loader.scan();
    emitUpdated();
    return name;
  });
}

module.exports = registerPluginsIpc;
