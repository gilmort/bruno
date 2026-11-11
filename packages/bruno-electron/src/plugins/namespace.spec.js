// packages/bruno-electron/src/plugins/namespace.spec.js
const { nsChannel, parseNs } = require('./namespace');

describe('namespace', () => {
  it('monta canal namespaced', () => {
    expect(nsChannel('sample-plugin', 'start')).toBe('plugin:sample-plugin:start');
  });
  it('faz round-trip', () => {
    expect(parseNs('plugin:sample-plugin:start')).toEqual({ id: 'sample-plugin', ch: 'start' });
  });
  it('preserva ch com dois-pontos', () => {
    expect(parseNs('plugin:x:a:b')).toEqual({ id: 'x', ch: 'a:b' });
  });
  it('retorna null para canal não-plugin', () => {
    expect(parseNs('renderer:ready')).toBeNull();
  });
});
