// packages/bruno-app/src/utils/gilmort/config.js
export const normalizeService = (s) => ({
  name: s.name,
  healthUrl: s.healthUrl,
  container: s.container ?? '',
  expectedStatus: s.expectedStatus ?? 200
});

export const parseGilmortConfig = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid Gilmort config: expected an object with a "services" array');
  }
  if (!Array.isArray(raw.services)) {
    throw new Error('Invalid Gilmort config: "services" must be an array');
  }
  raw.services.forEach((s, i) => {
    if (!s || typeof s !== 'object' || !s.name || !s.healthUrl) {
      throw new Error(`Invalid service at index ${i}: "name" and "healthUrl" are required`);
    }
  });
  return { services: raw.services.map(normalizeService) };
};
