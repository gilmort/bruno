// packages/bruno-app/src/utils/gilmort/config.js
export const normalizeService = (s) => ({
  name: s.name,
  healthUrl: s.healthUrl,
  container: s.container ?? '',
  expectedStatus: s.expectedStatus ?? 200
});

// Global config (shared across all collections), persisted in localStorage.
// Bump the suffix to invalidate a stale cached config and re-seed defaults.
const STORAGE_KEY = 'gilmort.config.v4';
const CHANGE_EVENT = 'gilmort:config-changed';

export const DEFAULT_SERVICES = [
  { name: 'SPA', healthUrl: 'http://localhost:3030/health/spa', container: 'qacompose-spa-nginx-1', expectedStatus: 200 },
  { name: 'BFF', healthUrl: 'http://localhost:3030/health/bff', container: 'qacompose-bff-1', expectedStatus: 200 },
  { name: 'BC', healthUrl: 'http://localhost:3030/health/bc', container: 'qacompose-bc-1', expectedStatus: 200 },
  { name: 'ACL', healthUrl: 'http://localhost:3030/health/acl', container: 'qacompose-acl-1', expectedStatus: 502 }
];

export const DEFAULTS = {
  composePath: '/Users/gilmarlj/projects/planner/qa-compose',
  healthTimeoutMs: 8000,
  pollIntervalMs: 5000
};

const defaultConfig = () => ({
  composePath: DEFAULTS.composePath,
  healthTimeoutMs: DEFAULTS.healthTimeoutMs,
  pollIntervalMs: DEFAULTS.pollIntervalMs,
  services: DEFAULT_SERVICES.map(normalizeService)
});

// Accepts either the new object shape or a bare services array (back-compat),
// applies defaults, and validates services. Throws on invalid services.
export const parseGilmortConfig = (raw) => {
  const obj = Array.isArray(raw) ? { services: raw } : raw;
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid Gilmort config: expected an object');
  }
  if (!Array.isArray(obj.services)) {
    throw new Error('Invalid Gilmort config: "services" must be an array');
  }
  obj.services.forEach((s, i) => {
    if (!s || typeof s !== 'object' || !s.name || !s.healthUrl) {
      throw new Error(`Invalid service at index ${i}: "name" and "healthUrl" are required`);
    }
  });
  return {
    composePath: typeof obj.composePath === 'string' ? obj.composePath : DEFAULTS.composePath,
    healthTimeoutMs: Number(obj.healthTimeoutMs) > 0 ? Number(obj.healthTimeoutMs) : DEFAULTS.healthTimeoutMs,
    pollIntervalMs: Number(obj.pollIntervalMs) > 0 ? Number(obj.pollIntervalMs) : DEFAULTS.pollIntervalMs,
    services: obj.services.map(normalizeService)
  };
};

export const loadGilmortConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    return parseGilmortConfig(JSON.parse(raw));
  } catch (_) {
    return defaultConfig();
  }
};

export const saveGilmortConfig = (config) => {
  const clean = parseGilmortConfig(config);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
};

export const onGilmortConfigChange = (handler) => {
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
};

// Back-compat helpers still used by callers that only need the services list.
export const loadGilmortServices = () => loadGilmortConfig().services;
