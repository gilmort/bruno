// packages/bruno-electron/src/plugins/protocol.spec.js
const { isInsidePluginDir } = require('./protocol');

describe('isInsidePluginDir', () => {
  it('permite arquivo normal dentro do plugin', () => {
    expect(isInsidePluginDir('/x/plugins', 'foo', 'renderer.js')).toBe(true);
  });
  it('bloqueia bypass para diretório irmão com prefixo igual', () => {
    expect(isInsidePluginDir('/x/plugins', 'foo', '../foo-evil/secret.js')).toBe(false);
  });
  it('bloqueia escape acima da raiz de plugins', () => {
    expect(isInsidePluginDir('/x/plugins', 'foo', '../../etc/passwd')).toBe(false);
  });
});
