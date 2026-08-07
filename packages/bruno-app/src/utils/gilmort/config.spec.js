// packages/bruno-app/src/utils/gilmort/config.spec.js
import { parseGilmortConfig, DEFAULTS } from './config';

describe('parseGilmortConfig', () => {
  it('accepts a valid config, applies service + top-level defaults', () => {
    const raw = { services: [{ name: 'SPA', healthUrl: 'http://x/health/spa' }] };
    expect(parseGilmortConfig(raw)).toEqual({
      composePath: '',
      healthTimeoutMs: DEFAULTS.healthTimeoutMs,
      pollIntervalMs: DEFAULTS.pollIntervalMs,
      services: [{ name: 'SPA', healthUrl: 'http://x/health/spa', container: '', expectedStatus: 200 }]
    });
  });

  it('keeps provided container and expectedStatus', () => {
    const raw = { services: [{ name: 'ACL', healthUrl: 'http://x/health/acl', container: 'acl', expectedStatus: 502 }] };
    expect(parseGilmortConfig(raw).services[0]).toEqual({
      name: 'ACL', healthUrl: 'http://x/health/acl', container: 'acl', expectedStatus: 502
    });
  });

  it('keeps provided composePath and timeouts', () => {
    const raw = { composePath: '/qa', healthTimeoutMs: 12000, pollIntervalMs: 10000, services: [] };
    const parsed = parseGilmortConfig(raw);
    expect(parsed.composePath).toBe('/qa');
    expect(parsed.healthTimeoutMs).toBe(12000);
    expect(parsed.pollIntervalMs).toBe(10000);
  });

  it('accepts a bare services array (back-compat)', () => {
    const parsed = parseGilmortConfig([{ name: 'BC', healthUrl: 'http://x/health/bc' }]);
    expect(parsed.services).toHaveLength(1);
    expect(parsed.composePath).toBe('');
  });

  it('throws when services is not an array', () => {
    expect(() => parseGilmortConfig({ services: 'nope' })).toThrow();
  });

  it('throws when a service is missing name or healthUrl', () => {
    expect(() => parseGilmortConfig({ services: [{ name: 'SPA' }] })).toThrow();
    expect(() => parseGilmortConfig({ services: [{ healthUrl: 'http://x' }] })).toThrow();
  });

  it('throws on null root', () => {
    expect(() => parseGilmortConfig(null)).toThrow();
  });
});
