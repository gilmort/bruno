const os = require('os');
const path = require('path');
const chokidar = require('chokidar');
const { refreshShellEnv } = require('../store/shell-env-state');

/**
 * Shell config files that can export variables into the environment Bruno inherits.
 *
 * Both zsh and bash are listed because the watcher cannot know which shell will be spawned:
 * `shell-env` asks the user's login shell, which may differ from the one that launched the app.
 * Watching a file that does not exist is fine and intentional — chokidar emits `add` if it is
 * created later, so a profile written after startup still triggers a reload.
 */
const PROFILE_FILES = [
  '.zshenv',
  '.zshrc',
  '.zprofile',
  '.zlogin',
  '.bash_profile',
  '.bashrc',
  '.profile'
];

/**
 * Editors save in several steps (write, truncate, rename), and a single save can fire more than one
 * event. Each reload spawns a login shell, so without coalescing one save could spawn a handful of
 * shells. 400ms is long enough to swallow a save burst and short enough to feel immediate.
 */
const DEBOUNCE_MS = 400;

class ShellEnvWatcher {
  constructor() {
    this.watcher = null;
    this.timer = null;
  }

  /**
   * @param win     BrowserWindow to notify
   * @param options `{ home }` overrides the directory holding the profile files. Only the tests
   *                pass it: watching the real home would mean editing the user's own ~/.zshrc to
   *                exercise this.
   */
  start(win, options = {}) {
    // `fetchShellEnv` returns {} on Windows (shell config files are not how the environment is set
    // there), so a watcher would only ever fire reloads that change nothing.
    if (process.platform === 'win32' || this.watcher) {
      return;
    }

    const home = options.home || os.homedir();

    // Watches the DIRECTORY (depth 0) and filters by filename, rather than handing chokidar the
    // list of profile paths. Same shape as dotenv-watcher, and for the same reason: a path that
    // does not exist yet is not reliably picked up when it is created later, so someone who writes
    // a ~/.zshenv after the app started would get no reload until the next restart. Measured — the
    // "profile created after startup" test fails with the explicit-path form.
    this.watcher = chokidar.watch(home, {
      // The startup load already read the environment; firing again for every existing file would
      // spawn a shell per profile for no new information.
      ignoreInitial: true,
      persistent: true,
      ignorePermissionErrors: true,
      disableGlobbing: true,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 100 }
    });

    const schedule = (pathname) => {
      if (!PROFILE_FILES.includes(path.basename(pathname))) {
        return;
      }
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.reload(win), DEBOUNCE_MS);
    };

    this.watcher.on('add', schedule);
    this.watcher.on('change', schedule);
    this.watcher.on('error', (err) => {
      console.error('Shell env watcher error:', err);
    });
  }

  async reload(win) {
    try {
      const changed = await refreshShellEnv();
      if (!changed.length) {
        return;
      }
      // Names only. These variables hold tokens; their values must never reach a log or the UI.
      console.log(`Shell environment reloaded: ${changed.length} variable(s) updated`);
      if (win && !win.isDestroyed()) {
        win.webContents.send('main:shell-env-updated', { names: changed });
      }
    } catch (err) {
      console.warn('Shell env reload failed:', err.message);
    }
  }

  close() {
    clearTimeout(this.timer);
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

module.exports = new ShellEnvWatcher();
