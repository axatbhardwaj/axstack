// Disable repository-controlled hooks and fsmonitor before any Git subcommand.
export function gitArgv(...args) {
  return ['git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args];
}
