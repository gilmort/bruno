// packages/bruno-app/src/utils/gilmort/config.spec.js
import { parseGilmortConfig } from './config';

describe('parseGilmortConfig', () => {
  it('accepts a valid config and applies defaults', () => {
    const raw = { services: [{ name: 'SPA', healthUrl: 'http://x/health/spa' }] };
    expect(parseGilmortConfig(raw)).toEqual({
      services: [{ name: 'SPA', healthUrl: 'http://x/health/spa', container: '', expectedStatus: 200 }]
    });
  });

  it('keeps provided container and expectedStatus', () => {
    const raw = { services: [{ name: 'ACL', healthUrl: 'http://x/health/acl', container: 'acl', expectedStatus: 502 }] };
    expect(parseGilmortConfig(raw).services[0]).toEqual({
      name: 'ACL', healthUrl: 'http://x/health/acl', container: 'acl', expectedStatus: 502
    });
  });

  it('throws when services is not an array', () => {
    expect(() => parseGilmortConfig({ services: 'nope' })).toThrow();
  });

  it('throws when a service is missing name or healthUrl', () => {
    expect(() => parseGilmortConfig({ services: [{ name: 'SPA' }] })).toThrow();
    expect(() => parseGilmortConfig({ services: [{ healthUrl: 'http://x' }] })).toThrow();
  });

  it('throws on non-object root', () => {
    expect(() => parseGilmortConfig(null)).toThrow();
    expect(() => parseGilmortConfig([])).toThrow();
  });
});
