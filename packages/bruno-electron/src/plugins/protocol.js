const path = require('path');
const { protocol, net } = require('electron');
const { pathToFileURL } = require('url');

const SCHEME = 'bruno-plugin';

function registerPluginSchemePrivileged() {
  protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
  ]);
}

function isInsidePluginDir(pluginsDir, id, relPath) {
  const root = path.normalize(path.join(pluginsDir, id));
  const target = path.normalize(path.join(pluginsDir, id, relPath));
  return target === root || target.startsWith(root + path.sep);
}

function registerPluginProtocol(pluginsDir) {
  // bruno-plugin://<id>/<file>  ->  <pluginsDir>/<id>/<file>
  protocol.handle(SCHEME, (request) => {
    const url = new URL(request.url);
    const id = url.hostname;
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!isInsidePluginDir(pluginsDir, id, rel)) {
      return new Response('forbidden', { status: 403 }); // path traversal guard
    }
    const target = path.normalize(path.join(pluginsDir, id, rel));
    return net.fetch(pathToFileURL(target).toString());
  });
}

module.exports = { SCHEME, registerPluginSchemePrivileged, registerPluginProtocol, isInsidePluginDir };
