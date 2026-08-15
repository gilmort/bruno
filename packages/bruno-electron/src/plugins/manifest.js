// packages/bruno-electron/src/plugins/manifest.js
const fs = require('fs');
const path = require('path');

const ID_RE = /^[a-z0-9-]+$/;

function validateManifest(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['manifest não é objeto'] };
  if (!obj.id || typeof obj.id !== 'string') errors.push('id ausente');
  else if (!ID_RE.test(obj.id)) errors.push('id deve casar [a-z0-9-]');
  if (!obj.name || typeof obj.name !== 'string') errors.push('name ausente');
  if (!obj.version || typeof obj.version !== 'string') errors.push('version ausente');
  return { valid: errors.length === 0, errors };
}

function readManifests(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => {
      if (d.isDirectory()) return true;
      // plugins instalados em dev são symlinks (~/.bruno/plugins/<id> -> fonte);
      // readdir não segue o link, então statSync (que segue) decide, guardando symlink quebrado.
      if (d.isSymbolicLink()) {
        try { return fs.statSync(path.join(dir, d.name)).isDirectory(); } catch (_) { return false; }
      }
      return false;
    });
  } catch (_) {
    return []; // dir não existe ainda
  }
  return entries.map((d) => {
    const pluginDir = path.join(dir, d.name);
    const manifestPath = path.join(pluginDir, 'manifest.json');
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const { valid, errors } = validateManifest(raw);
      if (!valid) return { dir: pluginDir, id: raw.id || d.name, error: errors.join('; ') };
      return {
        id: raw.id,
        name: raw.name,
        version: raw.version,
        main: raw.main || null,
        renderer: raw.renderer || null,
        contributes: raw.contributes || {},
        dir: pluginDir
      };
    } catch (e) {
      return { dir: pluginDir, id: d.name, error: `manifest inválido: ${e.message}` };
    }
  });
}

module.exports = { validateManifest, readManifests };
