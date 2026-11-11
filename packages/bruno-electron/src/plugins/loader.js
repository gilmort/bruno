// packages/bruno-electron/src/plugins/loader.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readManifests } = require('./manifest');
const { nsChannel } = require('./namespace');
const { registerPluginSettingsKeys } = require('@usebruno/lang');

class PluginLoader {
  constructor({ pluginsDir, ipcMain, getMainWindow }) {
    this.pluginsDir = pluginsDir;
    this.ipcMain = ipcMain;
    this.getMainWindow = getMainWindow;
    this.plugins = new Map(); // id -> { manifest, status, error, instance, channels:Set, disabled }
  }

  scan() {
    const manifests = readManifests(this.pluginsDir);
    for (const m of manifests) {
      // chaves de settings declaradas pelo plugin → o parser .bru as preserva
      if (m.contributes && Array.isArray(m.contributes.settingsKeys)) {
        try { registerPluginSettingsKeys(m.contributes.settingsKeys); } catch (_) {}
      }
      const prev = this.plugins.get(m.id);
      if (prev && prev.status === 'loaded') continue; // não mexe em ativos
      this.plugins.set(m.id, {
        manifest: m,
        status: m.error ? 'errored' : (prev && prev.disabled ? 'disabled' : 'inactive'),
        error: m.error || null,
        instance: null,
        channels: new Set(),
        listeners: [], // { channel, listener } registrados via ipc.on
        disabled: prev ? !!prev.disabled : false
      });
    }
  }

  list() {
    return [...this.plugins.values()].map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      contributes: p.manifest.contributes || {},
      status: p.status,
      error: p.error
    }));
  }

  _hostApi(p) {
    const id = p.manifest.id;
    const dataFile = path.join(p.manifest.dir, 'data.json');
    return {
      ipc: {
        handle: (ch, fn) => {
          const full = nsChannel(id, ch);
          this.ipcMain.handle(full, (event, ...args) => fn(...args));
          p.channels.add(full);
        },
        on: (ch, fn) => {
          const full = nsChannel(id, ch);
          const listener = (event, ...args) => fn(...args);
          this.ipcMain.on(full, listener);
          p.listeners.push({ channel: full, listener });
        },
        send: (ch, ...args) => {
          const win = this.getMainWindow();
          if (win) win.webContents.send(nsChannel(id, ch), ...args);
        }
      },
      getMainWindow: this.getMainWindow,
      paths: { pluginDir: p.manifest.dir, brunoHome: path.join(os.homedir(), '.bruno') },
      data: {
        load: () => { try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch (_) { return {}; } },
        save: (obj) => fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2))
      },
      log: (...a) => console.log(`[plugin:${id}]`, ...a)
    };
  }

  // registra os canais __data_* de todo plugin, para o renderer usar window.bruno.data
  _registerDataChannels(p) {
    const api = this._hostApi(p);
    api.ipc.handle('__data_load', () => api.data.load());
    api.ipc.handle('__data_save', (obj) => {
      api.data.save(obj); return true;
    });
  }

  activateMain(id) {
    const p = this.plugins.get(id);
    if (!p || p.status === 'loaded' || p.disabled) return;
    try {
      this._registerDataChannels(p);
      if (p.manifest.main) {
        const mainPath = path.join(p.manifest.dir, p.manifest.main);
        const mod = require(mainPath);
        p.instance = mod;
        if (typeof mod.activate === 'function') mod.activate(this._hostApi(p));
      }
      p.status = 'loaded';
      p.error = null;
    } catch (e) {
      p.status = 'errored';
      p.error = e.message;
      this.deactivate(id); // limpa qualquer canal parcial
      p.status = 'errored';
    }
  }

  deactivate(id) {
    const p = this.plugins.get(id);
    if (!p) return;
    for (const ch of p.channels) this.ipcMain.removeHandler(ch);
    p.channels.clear();
    for (const { channel, listener } of p.listeners) this.ipcMain.removeListener(channel, listener);
    p.listeners.length = 0;
    try { if (p.instance && typeof p.instance.deactivate === 'function') p.instance.deactivate(); } catch (_) {}
    if (p.manifest.main) {
      try {
        const mainPath = path.join(p.manifest.dir, p.manifest.main);
        delete require.cache[require.resolve(mainPath)];
      } catch (_) {} // main pode não existir (require original já falhou); nada a limpar
    }
    p.instance = null;
    if (p.status === 'loaded') p.status = 'inactive';
  }

  reload(id) {
    this.deactivate(id);
    const fresh = readManifests(this.pluginsDir).find((m) => m.id === id);
    if (fresh) {
      const p = this.plugins.get(id);
      p.manifest = fresh;
      p.status = fresh.error ? 'errored' : 'inactive';
      p.error = fresh.error || null;
    }
    this.activateMain(id);
  }

  setEnabled(id, enabled) {
    const p = this.plugins.get(id);
    if (!p) return;
    p.disabled = !enabled;
    if (!enabled) {
      this.deactivate(id); p.status = 'disabled';
    } else if (p.status === 'disabled') p.status = 'inactive';
  }
}

module.exports = { PluginLoader };
