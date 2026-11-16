// Disable repository-controlled hooks and fsmonitor before any Git subcommand.
export function gitArgv(...args) {
  return ['git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args];
}

// Scrubs inherited GIT_* only; trusted cwd + --no-env-file block peer .env
// (including non-Git controls such as XDG_CONFIG_HOME or LD_PRELOAD).
export function gitEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
}
