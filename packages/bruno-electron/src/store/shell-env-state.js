const { initializeShellEnv: _initializeShellEnv } = require('@usebruno/requests');

const TIMEOUT_MS = 60_000;

/** @type {null | Promise<any>} */
let _promise = null;
/**
 * Last snapshot returned by the shell, so a refresh can report WHICH keys changed without ever
 * logging their values — these are tokens.
 * @type {Record<string, string>}
 */
let _lastSnapshot = {};
/** Snapshot possibly out of date (window regained focus since the last read). */
let _stale = false;
/** Guards against two reads at once — each one spawns a login shell. */
let _refreshing = false;
/** When the last successful read happened, so a refresh is not repeated on every click. */
let _lastReadAt = 0;

const _initWithTimeout = () => {
  // @TODO: Temp skip during Playwright tests - otherwise it can hang on macOS CI
  if (process.env.PLAYWRIGHT) {
    return Promise.resolve();
  }

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      _promise = null;
      reject(new Error('Shell environment initialization timed out'));
    }, TIMEOUT_MS);
  });
  return Promise.race([_initializeShellEnv(), timeout])
    .finally(() => clearTimeout(timer))
    .then((vars) => {
      // Guarda só objeto: o valor resolvido é repassado intacto a quem espera, mas o snapshot é
      // usado para diferença de chaves e um não-objeto viraria índices de string ali.
      _lastSnapshot = vars && typeof vars === 'object' ? vars : {};
      _lastReadAt = Date.now();
      return vars;
    });
};

const initializeShellEnv = () => {
  if (!_promise) _promise = _initWithTimeout();
};

const waitForShellEnv = () => {
  if (!_promise) _promise = _initWithTimeout();
  return _promise;
};

/**
 * Marks the snapshot as possibly out of date. Deliberately CHEAP — it only flips a flag, it does not
 * spawn anything. The expensive part is deferred to the moment the environment is actually needed.
 *
 * Called when the window regains focus: that is the only general signal that the user may have
 * changed something outside the app. Watching files cannot be the answer here — a variable can come
 * from a profile, from a password manager, from a sourced file, from `launchctl setenv`. There is no
 * finite list of paths to watch, so the app watches the USER instead.
 */
const markShellEnvStale = () => {
  _stale = true;
};

/**
 * Re-reads the shell environment only if it is both marked stale and older than `minAgeMs`.
 *
 * Fire-and-forget by design: reading the shell means spawning a login shell, which on a profile that
 * decrypts secrets costs SECONDS (measured: 5.6s on the setup this was built for). Putting that on
 * the path of a request would be worse than the problem it solves, so this is meant to be triggered
 * when a request is OPENED, giving it time to land before the request is actually sent.
 *
 * @returns {Promise<string[]>} names of changed variables — empty when it decided not to re-read
 */
const refreshShellEnvIfStale = async (minAgeMs = 60_000) => {
  if (!_stale || _refreshing) return [];
  if (Date.now() - _lastReadAt < minAgeMs) return [];
  _refreshing = true;
  try {
    const changed = await refreshShellEnv();
    _stale = false;
    return changed;
  } finally {
    _refreshing = false;
  }
};

/**
 * Re-reads the shell environment and returns the names of the variables whose value changed.
 *
 * Clearing `_promise` is the whole point: it is memoized, so without this the second read would
 * hand back the first result and nothing would ever update. Values are never returned or logged.
 *
 * @returns {Promise<string[]>} names of changed variables (added or updated)
 */
const refreshShellEnv = async () => {
  const before = _lastSnapshot;
  _promise = null;
  const vars = (await waitForShellEnv()) || {};
  return Object.keys(vars).filter((key) => before[key] !== vars[key]);
};

module.exports = { initializeShellEnv, waitForShellEnv, refreshShellEnv, markShellEnvStale, refreshShellEnvIfStale };
