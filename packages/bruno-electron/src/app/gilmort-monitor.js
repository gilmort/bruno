// packages/bruno-electron/src/app/gilmort-monitor.js
// computeStatus: combine docker container state with HTTP health-check into a traffic light.
// containerUp: true|false|null (null = no container configured, docker step neutral)
// httpStatus: number|null (null = no response)
const computeStatus = ({ containerUp, httpStatus, expectedStatus }) => {
  const httpOk = httpStatus != null && httpStatus === expectedStatus;

  if (containerUp === null) {
    // No container configured: HTTP is the only signal.
    return httpOk ? 'green' : 'red';
  }

  if (containerUp && httpOk) return 'green';
  if (!containerUp && !httpOk) return 'red';
  return 'yellow'; // exactly one of the two is healthy
};

module.exports = { computeStatus };
