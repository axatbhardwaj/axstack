// Disable repository-controlled hooks and fsmonitor before any Git subcommand.
export function gitArgv(...args) {
  return ['git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args];
}

// Inherited Git variables can redirect the repository or inject executable config.
export function gitEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
}
