import { killGroup, runCommand } from './command-capture.js';
import { gitArgv } from './git-argv.js';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';

const installs = {
  bun: ['install', '--frozen-lockfile'], npm: ['ci'],
  pnpm: ['install', '--frozen-lockfile'], yarn: ['install', '--immutable'],
};
/** @type {[string, string[]][]} */
const groups = [['env.build', ['build']], ['testing.test', ['test']], ['testing.lint-typecheck', ['lint', 'typecheck']]];
// No shell interpolation, and the wrapper preserves the command's allowlisted env.
const networkWrapper = `const ip = Bun.spawnSync([process.argv[1], 'link', 'set', 'lo', 'up'], { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
if (ip.exitCode !== 0) process.exit(ip.exitCode || 1);
const command = Bun.spawn(process.argv.slice(2), { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
process.exit(await command.exited);`;

export async function executeDeclared(repo, revision, paths, criteria, manager, pkg, limits) {
  const pending = groups.filter(([id]) => criteria.find((item) => item.id === id).reason === 'not run');
  const commands = [];
  const result = { commands, network: 'not isolated', descendants: 'not contained' };
  if (!pending.length) return result;
  mkdirSync(paths.evidence, { recursive: true, mode: 0o700 });
  let scratch;
  const state = { active: null, signal: null };
  const interrupt = (signal) => { state.signal = signal; if (state.active) killGroup(state.active); };
  const sigint = () => interrupt('SIGINT');
  const sigterm = () => interrupt('SIGTERM');
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);
  try {
    const home = realpathSync(process.env.HOME || '/root');
    let temp = realpathSync(process.env.TMPDIR || '/tmp');
    if (temp === home || temp.startsWith(`${home}/`)) temp = realpathSync('/tmp');
    if (temp === home || temp.startsWith(`${home}/`)) throw new Error('no scratch directory outside HOME; set TMPDIR to an owned temp directory');
    scratch = mkdtempSync(`${temp}/axstack-readiness-`);
    chmodSync(scratch, 0o700);
    if (lstatSync(scratch).uid !== process.getuid()) throw new Error('scratch directory is not owned');
    result.scratch = scratch;
    const env = { PATH: process.env.PATH || '/usr/bin:/bin', LANG: process.env.LANG || 'C.UTF-8', CI: '1', HOME: scratch, TMPDIR: scratch };
    const cwd = `${scratch}/repo`;
    const unshare = Bun.which('unshare');
    const ip = Bun.which('ip');
    const pidFlags = ['--pid', '--fork', '--kill-child'];
    const contained = (argv) => [unshare, '-r', ...pidFlags, ...argv];
    const isolated = (argv) => [unshare, '-rn', ...(result.descendants === 'contained' ? pidFlags : []), process.execPath, '-e', networkWrapper, ip, ...argv];
    const run = async (kind, argv, directory = scratch, spawnArgv) => {
      if (state.signal) throw new Error(`interrupted by ${state.signal}`);
      const step = await runCommand(commands, paths, kind, argv, directory, env, limits, state, spawnArgv ?? (result.descendants === 'contained' ? contained(argv) : argv));
      if (state.signal) throw new Error(`interrupted by ${state.signal}; see ${step.logPath}`);
      return step;
    };
    if (unshare) {
      const probe = await run('descendant-probe', contained(['/bin/true']));
      if (probe.exitCode === 0 && !probe.timedOut && !probe.error) result.descendants = 'contained';
    }
    if (unshare && ip) {
      const argv = isolated(['/bin/true']);
      const probe = await run('network-probe', argv, scratch, argv);
      if (probe.exitCode === 0 && !probe.timedOut && !probe.error) result.network = 'isolated';
    }
    const clone = await run('clone', gitArgv('-C', scratch, 'clone', '--no-hardlinks', '--no-checkout', '--', realpathSync(repo), cwd), scratch);
    if (clone.exitCode !== 0 || clone.timedOut) throw new Error(`clone failed; see ${clone.logPath}`);
    const checkout = await run('checkout', gitArgv('-C', cwd, 'checkout', '--detach', revision), scratch);
    if (checkout.exitCode !== 0 || checkout.timedOut) throw new Error(`checkout failed; see ${checkout.logPath}`);
    const install = await run('install', [manager.name, ...installs[manager.name]], cwd);
    if (install.exitCode !== 0 || install.timedOut) {
      for (const [id] of pending) Object.assign(criteria.find((item) => item.id === id), { reason: 'install failed', evidence: [install.logPath] });
      return result;
    }
    for (const [id, names] of pending) {
      const steps = [];
      for (const name of names.filter((name) => typeof pkg.scripts?.[name] === 'string' && pkg.scripts[name].trim())) {
        const argv = [manager.name, ...(manager.name === 'pnpm' ? ['--config.enable-pre-post-scripts=false'] : []), 'run', name];
        steps.push(await run('script', argv, cwd, result.network === 'isolated' ? isolated(argv) : undefined));
      }
      const passed = steps.every((step) => step.exitCode === 0 && !step.timedOut && !step.error);
      Object.assign(criteria.find((item) => item.id === id), { status: passed ? 'pass' : 'fail', reason: steps.some((step) => step.timedOut) ? 'timeout' : passed ? '' : 'command failed', evidence: steps.map((step) => step.logPath) });
    }
  } catch (error) {
    result.error = error.message;
    for (const [id] of pending) Object.assign(criteria.find((item) => item.id === id), { status: 'unknown', reason: 'execution unavailable', evidence: [error.message] });
  } finally {
    process.off('SIGINT', sigint);
    process.off('SIGTERM', sigterm);
    if (scratch) {
      try { rmSync(scratch, { recursive: true }); }
      catch (error) { result.error = `scratch removal failed: ${scratch}: ${error.message}`; }
    }
  }
  return result;
}
