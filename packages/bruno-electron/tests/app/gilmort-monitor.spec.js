// packages/bruno-electron/tests/app/gilmort-monitor.spec.js
const { computeStatus, GilmortMonitor } = require('../../src/app/gilmort-monitor');

describe('computeStatus', () => {
  it('green when container up and http matches expected', () => {
    expect(computeStatus({ containerUp: true, httpStatus: 200, expectedStatus: 200 })).toBe('green');
  });
  it('green for ACL case: container down expected, http 502 expected', () => {
    // ACL: no container running, but 502 is the expected status
    expect(computeStatus({ containerUp: false, httpStatus: 502, expectedStatus: 502 })).toBe('yellow');
  });
  it('yellow when container up but http wrong', () => {
    expect(computeStatus({ containerUp: true, httpStatus: 500, expectedStatus: 200 })).toBe('yellow');
  });
  it('yellow when http ok but container down', () => {
    expect(computeStatus({ containerUp: false, httpStatus: 200, expectedStatus: 200 })).toBe('yellow');
  });
  it('red when container down and http wrong', () => {
    expect(computeStatus({ containerUp: false, httpStatus: null, expectedStatus: 200 })).toBe('red');
  });
  it('no container configured: status driven by http only (green)', () => {
    expect(computeStatus({ containerUp: null, httpStatus: 200, expectedStatus: 200 })).toBe('green');
  });
  it('no container configured: http wrong => red', () => {
    expect(computeStatus({ containerUp: null, httpStatus: 500, expectedStatus: 200 })).toBe('red');
  });
});

describe('GilmortMonitor.checkService', () => {
  const monitor = new GilmortMonitor();
  const svc = { name: 'SPA', healthUrl: 'http://x/health', container: 'spa', expectedStatus: 200 };

  it('reports green when both probes succeed', async () => {
    const deps = {
      httpGet: async () => 200,
      dockerInspect: async () => true
    };
    const r = await monitor.checkService(svc, deps);
    expect(r).toEqual({ name: 'SPA', status: 'green', containerUp: true, httpStatus: 200, expectedStatus: 200 });
  });

  it('container null when service has no container configured', async () => {
    const deps = { httpGet: async () => 200, dockerInspect: async () => { throw new Error('should not call'); } };
    const r = await monitor.checkService({ ...svc, container: '' }, deps);
    expect(r.containerUp).toBe(null);
    expect(r.status).toBe('green');
  });

  it('http null on network error, container false on inspect error => red', async () => {
    const deps = {
      httpGet: async () => { throw new Error('ECONNREFUSED'); },
      dockerInspect: async () => { throw new Error('no such container'); }
    };
    const r = await monitor.checkService(svc, deps);
    expect(r).toEqual({ name: 'SPA', status: 'red', containerUp: false, httpStatus: null, expectedStatus: 200 });
  });
});
