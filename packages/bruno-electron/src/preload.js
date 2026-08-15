const { ipcRenderer, contextBridge, webUtils, shell } = require('electron');

contextBridge.exposeInMainWorld('isPlaywright', process.env.PLAYWRIGHT === 'true');

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, handler) => {
    // Deliberately strip event as it includes `sender`
    const subscription = (event, ...args) => {
      // Ensure args is always an array to prevent undefined errors
      const safeArgs = args && args.length ? args : [];
      handler(...safeArgs);
    };
    ipcRenderer.on(channel, subscription);

    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  getFilePath(file) {
    const path = webUtils.getPathForFile(file);
    return path;
  },
  openExternal: (url) => shell.openExternal(url)
});

// window.bruno (registro de plugins) é montado no MAIN WORLD pelo app
// (ver bruno-app .../utils/plugins/bootstrap.js), pois componentes React
// não atravessam o contextBridge. Só IPC (dados) passa por aqui.
