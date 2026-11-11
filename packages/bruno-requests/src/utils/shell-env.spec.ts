import path from 'path';
import { initializeShellEnv } from './shell-env';

let mockShellEnvResult: Record<string, string> = {};

jest.mock('shell-env', () => ({
  shellEnv: () => Promise.resolve(mockShellEnvResult)
}));

const originalPlatform = process.platform;

// initializeShellEnv no-ops on win32, so the unix-branch tests below are
// skipped on Windows hosts instead of faking the platform.
const itIf = (condition: boolean) => (condition ? it : it.skip);
const isWindows = process.platform === 'win32';

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
});

describe('initializeShellEnv', () => {
  itIf(!isWindows)('should add shell env vars that are not in process.env', async () => {
    delete process.env.TEST_SHELL_VAR;
    mockShellEnvResult = { TEST_SHELL_VAR: 'from_shell_config' };

    await initializeShellEnv();

    expect(process.env.TEST_SHELL_VAR).toBe('from_shell_config');
    delete process.env.TEST_SHELL_VAR;
  });

  itIf(!isWindows)('should not overwrite existing process.env values', async () => {
    process.env.http_proxy = 'updated_value';
    mockShellEnvResult = { http_proxy: 'config_file_value' };

    await initializeShellEnv();

    expect(process.env.http_proxy).toBe('updated_value');
    delete process.env.http_proxy;
  });

  itIf(!isWindows)('should prepend shell PATH to existing process.env.PATH', async () => {
    const shellNodeBin = path.join('fixtures', 'shell-env', 'node-bin');
    const systemBin = path.join('fixtures', 'shell-env', 'system-bin');
    const otherBin = path.join('fixtures', 'shell-env', 'other-bin');
    process.env.PATH = [systemBin, otherBin].join(path.delimiter);
    mockShellEnvResult = { PATH: shellNodeBin };

    await initializeShellEnv();

    expect(process.env.PATH).toBe(
      [shellNodeBin, systemBin, otherBin].join(path.delimiter)
    );
    delete process.env.PATH;
  });

  itIf(!isWindows)('should set PATH from shell when not in process.env', async () => {
    const shellBin = path.join('fixtures', 'shell-env', 'shell-bin');
    delete process.env.PATH;
    mockShellEnvResult = { PATH: shellBin };

    await initializeShellEnv();

    expect(process.env.PATH).toBe(shellBin);
    delete process.env.PATH;
  });

  itIf(!isWindows)('should preserve multiple existing env vars while adding new ones', async () => {
    process.env.EXISTING_VAR = 'existing';
    delete process.env.NEW_VAR;
    mockShellEnvResult = { EXISTING_VAR: 'overwritten', NEW_VAR: 'new_value' };

    await initializeShellEnv();

    expect(process.env.EXISTING_VAR).toBe('existing');
    expect(process.env.NEW_VAR).toBe('new_value');
    delete process.env.EXISTING_VAR;
    delete process.env.NEW_VAR;
  });

  itIf(!isWindows)('should return the shell env vars (not the merged result)', async () => {
    mockShellEnvResult = { SOME_VAR: 'value' };

    const result = await initializeShellEnv();

    expect(result).toEqual({ SOME_VAR: 'value' });
    delete process.env.SOME_VAR;
  });

  // O caso real que motivou tudo isto: o app foi aberto A PARTIR de um shell (Raycast, terminal,
  // Dock herdando a sessão), então o token já chegou herdado em process.env com o MESMO valor que
  // o shell tinha naquele instante. `!(key in process.env)` lê isso como "o SO definiu", a chave
  // nunca entra em `appliedFromShell`, e nenhuma recarga futura a toca — o token rotacionado
  // continua velho até reiniciar o app, que é exatamente o sintoma relatado.
  test('should update a var inherited from the shell at launch', async () => {
    process.env.INHERITED_TOKEN = 'token_v1';
    mockShellEnvResult = { INHERITED_TOKEN: 'token_v1' };
    await initializeShellEnv();

    mockShellEnvResult = { INHERITED_TOKEN: 'token_v2' };
    await initializeShellEnv();

    expect(process.env.INHERITED_TOKEN).toBe('token_v2');
    delete process.env.INHERITED_TOKEN;
  });

  // --- RECARGA: o motivo de `appliedFromShell` existir -------------------------------------
  // Antes, a guarda era só `if (!(key in process.env))`. Ela protege o que o SO/Electron definiram,
  // mas também fazia toda leitura seguinte virar no-op: o valor velho vencia para sempre, e trocar
  // um token rotacionado exigia fechar e reabrir o app.
  test('should update a var it set itself when the shell value changes', async () => {
    delete process.env.ROTATING_TOKEN;
    mockShellEnvResult = { ROTATING_TOKEN: 'token_v1' };
    await initializeShellEnv();
    expect(process.env.ROTATING_TOKEN).toBe('token_v1');

    mockShellEnvResult = { ROTATING_TOKEN: 'token_v2' };
    await initializeShellEnv();

    expect(process.env.ROTATING_TOKEN).toBe('token_v2');
    delete process.env.ROTATING_TOKEN;
  });

  // A recarga não pode virar uma porta dos fundos para pisar no ambiente do processo: o que o SO
  // definiu continua vencendo, na primeira leitura e em todas as outras.
  test('should still never overwrite a var the process already owned, on reload', async () => {
    process.env.OS_OWNED = 'from_os';
    mockShellEnvResult = { OS_OWNED: 'from_shell_v1' };
    await initializeShellEnv();
    mockShellEnvResult = { OS_OWNED: 'from_shell_v2' };
    await initializeShellEnv();

    expect(process.env.OS_OWNED).toBe('from_os');
    delete process.env.OS_OWNED;
  });

  // `fetchShellEnv` devolve {} quando o shell não sobe. Tratar isso como "o usuário apagou tudo"
  // limparia um ambiente que estava funcionando por causa de uma falha passageira.
  test('should keep a previously applied var when the shell returns nothing', async () => {
    delete process.env.KEEP_ME;
    mockShellEnvResult = { KEEP_ME: 'value' };
    await initializeShellEnv();

    mockShellEnvResult = {};
    await initializeShellEnv();

    expect(process.env.KEEP_ME).toBe('value');
    delete process.env.KEEP_ME;
  });

  test('should return empty object on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mockShellEnvResult = { SHOULD_NOT_APPEAR: 'value' };

    const result = await initializeShellEnv();

    expect(result).toEqual({});
    expect(process.env.SHOULD_NOT_APPEAR).toBeUndefined();
  });
});
