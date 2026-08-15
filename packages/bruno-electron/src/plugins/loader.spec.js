// packages/bruno-electron/src/plugins/loader.spec.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PluginLoader } = require('./loader');

function fakeIpc() {
  const handlers = {};
  const listeners = {};
  return {
    handlers,
    listeners,
    handle: (ch, fn) => { handlers[ch] = fn; },
    removeHandler: (ch) => { delete handlers[ch]; },
    on: (ch, fn) => { listeners[ch] = fn; },
    removeListener: (ch, fn) => { if (listeners[ch] === fn) delete listeners[ch]; }
  };
}

function writePlugin(dir, id, mainSrc) {
  const p = path.join(dir, id);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, 'manifest.json'), JSON.stringify({ id, name: id, version: '1.0.0', main: 'main.js' }));
  fs.writeFileSync(path.join(p, 'main.js'), mainSrc);
  return p;
}

describe('PluginLoader', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brplug-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('scan lista o plugin como inactive', () => {
    writePlugin(dir, 'hello', 'module.exports = { activate() {} }');
    const l = new PluginLoader({ pluginsDir: dir, ipcMain: fakeIpc(), getMainWindow: () => null });
    l.scan();
    const list = l.list();
    expect(list.find((x) => x.id === 'hello').status).toBe('inactive');
  });

  it('activateMain chama activate e registra canal namespaced', () => {
    writePlugin(dir, 'hello',
      'module.exports = { activate(host) { host.ipc.handle(\'ping\', () => \'pong\'); } }');
    const ipc = fakeIpc();
    const l = new PluginLoader({ pluginsDir: dir, ipcMain: ipc, getMainWindow: () => null });
    l.scan();
    l.activateMain('hello');
    expect(l.list().find((x) => x.id === 'hello').status).toBe('loaded');
    expect(typeof ipc.handlers['plugin:hello:ping']).toBe('function');
  });

  it('deactivate remove os handlers do plugin', () => {
    writePlugin(dir, 'hello',
      'module.exports = { activate(host) { host.ipc.handle(\'ping\', () => \'pong\'); } }');
    const ipc = fakeIpc();
    const l = new PluginLoader({ pluginsDir: dir, ipcMain: ipc, getMainWindow: () => null });
    l.scan(); l.activateMain('hello'); l.deactivate('hello');
    expect(ipc.handlers['plugin:hello:ping']).toBeUndefined();
  });

  it('plugin que estoura em activate vira errored, não derruba', () => {
    writePlugin(dir, 'bad', 'module.exports = { activate() { throw new Error(\'boom\'); } }');
    const l = new PluginLoader({ pluginsDir: dir, ipcMain: fakeIpc(), getMainWindow: () => null });
    l.scan();
    expect(() => l.activateMain('bad')).not.toThrow();
    expect(l.list().find((x) => x.id === 'bad').status).toBe('errored');
  });

  it('plugin com main inexistente vira errored, não derruba (require.resolve não escapa do deactivate)', () => {
    const p = path.join(dir, 'x');
    fs.mkdirSync(p, { recursive: true });
    fs.writeFileSync(path.join(p, 'manifest.json'), JSON.stringify({ id: 'x', name: 'x', version: '1.0.0', main: 'nope.js' }));
    // note: nope.js não é criado
    const l = new PluginLoader({ pluginsDir: dir, ipcMain: fakeIpc(), getMainWindow: () => null });
    l.scan();
    expect(() => l.activateMain('x')).not.toThrow();
    expect(l.list().find((i) => i.id === 'x').status).toBe('errored');
  });

  it('deactivate remove listeners registrados via ipc.on', () => {
    writePlugin(dir, 'hello',
      'module.exports = { activate(host) { host.ipc.on(\'evt\', () => {}); } }');
    const ipc = fakeIpc();
    const l = new PluginLoader({ pluginsDir: dir, ipcMain: ipc, getMainWindow: () => null });
    l.scan(); l.activateMain('hello');
    expect(typeof ipc.listeners['plugin:hello:evt']).toBe('function');
    l.deactivate('hello');
    expect(ipc.listeners['plugin:hello:evt']).toBeUndefined();
  });
});
