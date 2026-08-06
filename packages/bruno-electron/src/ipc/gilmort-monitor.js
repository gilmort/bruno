const { ipcMain } = require('electron');

const registerGilmortMonitorIpc = (mainWindow, gilmortMonitor) => {
  ipcMain.handle('renderer:start-gilmort-monitoring', (event, payload) => {
    try {
      gilmortMonitor.start(mainWindow, payload || { collectionUid: null, services: [] });
      return { success: true };
    } catch (error) {
      console.error('Error starting gilmort monitoring:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('renderer:stop-gilmort-monitoring', () => {
    try {
      gilmortMonitor.stop();
      return { success: true };
    } catch (error) {
      console.error('Error stopping gilmort monitoring:', error);
      return { success: false, error: error.message };
    }
  });
};

module.exports = registerGilmortMonitorIpc;
