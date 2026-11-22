// Disable repository-controlled hooks and fsmonitor before any Git subcommand.
export function gitArgv(...args) {
  return ['git', '--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args];
}

const hookReads = {
  root: ['rev-parse', '--show-toplevel'],
  config: ['config', '--null', '--get', 'core.hooksPath'],
  hooks: ['rev-parse', '--git-path', 'hooks'],
};

/** @param {keyof typeof hookReads} read */
export function gitHookReadArgv(repo, read) {
  if (!Object.hasOwn(hookReads, read)) throw Error(`Unsupported Git hook lookup: ${read}`);
  // These commands execute no hooks and must see the effective hooks configuration.
  return ['git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', repo, ...hookReads[read]];
}

// Scrubs inherited GIT_* only; trusted cwd + --no-env-file block peer .env
// (including non-Git controls such as XDG_CONFIG_HOME or LD_PRELOAD).
export function gitEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !key.startsWith('GIT_')));
}
