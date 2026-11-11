/**
 * Shell Environment Utility
 *
 * Fetches environment variables from the user's shell configuration files (e.g., .zshenv, .bashrc)
 */

import path from 'path';

export const fetchShellEnv = async (): Promise<Record<string, string> | null> => {
  // Windows handles environment variables differently - skip
  // everything related to windows proxy settings is handled by the system proxy resolver i.e getSystemProxy()
  if (process.platform === 'win32') {
    return {};
  }

  try {
    // shell-env is ESM-only, so we use dynamic import
    const { shellEnv } = await import('shell-env');
    const env = await shellEnv();
    return env;
  } catch (error) {
    return null;
  }
};

/**
 * Keys this module has written into process.env from the shell.
 *
 * This is what makes the read REPEATABLE. The guard used to be `if (!(key in process.env))` alone,
 * which is right for the first load (never clobber what the OS or Electron already set) but makes
 * every later load a no-op: the stale value always wins, so refreshing a rotated token was
 * impossible without restarting the app.
 *
 * On the first load this set is empty, so behaviour is identical to before. On a refresh, only the
 * keys that came from the shell are written again — PATH, HOME and anything the process already
 * owned stay untouched.
 *
 * A key dropped from the shell config is deliberately NOT unset: `fetchShellEnv` returns {} when
 * the shell fails to start, and treating that as "the user deleted every variable" would wipe a
 * working environment on a transient error.
 *
 * A value already present that MATCHES what the shell reports also counts as ours. Launching the
 * app from a shell (Raycast, a terminal, a Dock entry that inherited the session) copies the whole
 * environment into the process, so the token arrives already set and identical to the shell's. On
 * `key in process.env` alone that reads as "the OS owns it", the key never joins this set, and the
 * value stays frozen at its launch-time value forever — the exact bug this file exists to fix.
 * Writing an identical value changes nothing; it only earns the key a place here.
 */
const appliedFromShell = new Set<string>();

/**
 * Initializes process.env with shell environment variables.
 * Should be called early in the app startup, and again whenever the shell config changes.
 *
 * @returns The fetched shell environment variables
 */
export const initializeShellEnv = async (): Promise<Record<string, string>> => {
  const shellEnvVars = await fetchShellEnv();

  if (shellEnvVars === null) {
    return {};
  }

  for (const [key, value] of Object.entries(shellEnvVars)) {
    if (key === 'PATH' && process.env.PATH) {
      process.env.PATH = `${value}${path.delimiter}${process.env.PATH}`;
      appliedFromShell.add(key);
    } else if (!(key in process.env) || appliedFromShell.has(key) || process.env[key] === value) {
      process.env[key] = value;
      appliedFromShell.add(key);
    }
  }
  return shellEnvVars;
};
