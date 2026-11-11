// packages/bruno-electron/src/plugins/manifest.spec.js
const { validateManifest, readManifests } = require('./manifest');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('validateManifest', () => {
  it('aceita manifest mínimo válido', () => {
    const r = validateManifest({ id: 'hello', name: 'Hello', version: '1.0.0' });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejeita sem id', () => {
    const r = validateManifest({ name: 'x', version: '1.0.0' });
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/id/);
  });

  it('rejeita id com caracteres inválidos (só [a-z0-9-])', () => {
    expect(validateManifest({ id: 'Hello World', name: 'x', version: '1.0.0' }).valid).toBe(false);
  });

  it('rejeita version ausente', () => {
    expect(validateManifest({ id: 'hello', name: 'x' }).valid).toBe(false);
  });
});

describe('readManifests', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('retorna plugin válido com todos os campos', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-test-'));
    const pluginDir = path.join(tmpDir, 'hello');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({
      id: 'hello', name: 'Hello', version: '1.0.0', main: 'index.js', renderer: 'ui.js', contributes: { commands: [] }
    }));
    const result = readManifests(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'hello', name: 'Hello', version: '1.0.0', main: 'index.js', renderer: 'ui.js', contributes: { commands: [] }, dir: pluginDir
    });
  });

  it('retorna entrada com error para manifest inválido (JSON quebrado)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-test-'));
    const pluginDir = path.join(tmpDir, 'broken');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'manifest.json'), '{broken');
    const result = readManifests(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].error).toBeDefined();
    expect(result[0].id).toBe('broken');
  });

  it('retorna entrada com error para manifest sem id', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-test-'));
    const pluginDir = path.join(tmpDir, 'noid');
    fs.mkdirSync(pluginDir);
    fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify({ name: 'X', version: '1.0.0' }));
    const result = readManifests(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].error).toBeDefined();
    expect(result[0].error).toMatch(/id/);
  });

  it('retorna array vazio para dir inexistente', () => {
    const result = readManifests('/tmp/nonexistent-dir-12345');
    expect(result).toEqual([]);
  });

  it('descobre plugin instalado via symlink (workflow de dev)', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-test-'));
    const src = path.join(tmpDir, 'src-hello');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'manifest.json'), JSON.stringify({ id: 'hello', name: 'Hello', version: '1.0.0' }));
    const pluginsDir = path.join(tmpDir, 'plugins');
    fs.mkdirSync(pluginsDir);
    fs.symlinkSync(src, path.join(pluginsDir, 'hello'), 'dir');

    const result = readManifests(pluginsDir);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('hello');
  });

  it('ignora symlink quebrado sem lançar', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bruno-test-'));
    fs.symlinkSync(path.join(tmpDir, 'nao-existe'), path.join(tmpDir, 'quebrado'), 'dir');
    expect(() => readManifests(tmpDir)).not.toThrow();
    expect(readManifests(tmpDir)).toEqual([]);
  });
});
