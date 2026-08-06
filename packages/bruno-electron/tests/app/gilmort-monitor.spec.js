// packages/bruno-electron/tests/app/gilmort-monitor.spec.js
const { computeStatus } = require('../../src/app/gilmort-monitor');

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
