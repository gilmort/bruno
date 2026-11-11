// Integração do watcher: chokidar de verdade sobre uma pasta temporária. O `home` é injetado porque
// exercitar isto contra o home real significaria editar o ~/.zshrc do usuário.
const fs = require('fs');
const os = require('os');
const path = require('path');

let mockRefresh;
jest.mock('../../store/shell-env-state', () => ({
  refreshShellEnv: (...args) => mockRefresh(...args)
}));

const watcher = require('../shell-env-watcher');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
// O watcher junta rajadas de save em 400ms e o chokidar ainda espera o arquivo estabilizar.
const ATE_DISPARAR = 1500;

describe('shell-env-watcher', () => {
  let home, win, enviados;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'shellenv-'));
    enviados = [];
    win = { isDestroyed: () => false, webContents: { send: (canal, payload) => enviados.push({ canal, payload }) } };
    mockRefresh = jest.fn(() => Promise.resolve([]));
  });

  afterEach(() => {
    watcher.close();
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('reloads and notifies the window when a profile file changes', async () => {
    const zshrc = path.join(home, '.zshrc');
    fs.writeFileSync(zshrc, 'export TOKEN=v1\n');
    mockRefresh = jest.fn(() => Promise.resolve(['TOKEN']));

    watcher.start(win, { home });
    await esperar(300);
    fs.writeFileSync(zshrc, 'export TOKEN=v2\n');
    await esperar(ATE_DISPARAR);

    expect(mockRefresh).toHaveBeenCalled();
    expect(enviados).toEqual([{ canal: 'main:shell-env-updated', payload: { names: ['TOKEN'] } }]);
  });

  it('picks up a profile file created after startup', async () => {
    mockRefresh = jest.fn(() => Promise.resolve(['NOVA']));

    watcher.start(win, { home }); // .zshenv ainda não existe
    await esperar(300);
    fs.writeFileSync(path.join(home, '.zshenv'), 'export NOVA=1\n');
    await esperar(ATE_DISPARAR);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('stays quiet when nothing actually changed', async () => {
    const zshrc = path.join(home, '.zshrc');
    fs.writeFileSync(zshrc, '# comentário\n');
    mockRefresh = jest.fn(() => Promise.resolve([])); // nenhuma variável mudou

    watcher.start(win, { home });
    await esperar(300);
    fs.writeFileSync(zshrc, '# outro comentário\n');
    await esperar(ATE_DISPARAR);

    expect(mockRefresh).toHaveBeenCalled();
    // Um save que não mexeu em variável nenhuma não pode virar aviso na tela.
    expect(enviados).toEqual([]);
  });

  it('does not bring the app down when the reload fails', async () => {
    const zshrc = path.join(home, '.zshrc');
    fs.writeFileSync(zshrc, 'export A=1\n');
    mockRefresh = jest.fn(() => Promise.reject(new Error('shell died')));

    watcher.start(win, { home });
    await esperar(300);
    fs.writeFileSync(zshrc, 'export A=2\n');
    await esperar(ATE_DISPARAR);

    expect(mockRefresh).toHaveBeenCalled();
    expect(enviados).toEqual([]);
  });

  it('ignores files that are not shell profiles', async () => {
    watcher.start(win, { home });
    await esperar(300);
    fs.writeFileSync(path.join(home, 'qualquer.txt'), 'nada a ver\n');
    await esperar(ATE_DISPARAR);

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
