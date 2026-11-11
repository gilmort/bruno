// packages/bruno-electron/src/plugins/namespace.js
function nsChannel(id, ch) {
  return `plugin:${id}:${ch}`;
}

function parseNs(channel) {
  const m = /^plugin:([a-z0-9-]+):(.+)$/.exec(channel);
  return m ? { id: m[1], ch: m[2] } : null;
}

module.exports = { nsChannel, parseNs };
