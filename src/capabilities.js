// Host capability checks. `exec` is injected so tests never touch a live
// runtime. Resolve Orca exactly once and reuse it: a failed choice never
// triggers a fallback to another binary.
export const BUN_FLOOR = '1.3.14';

export const PROBE_LIMITATIONS = [
  'A host binary probe cannot prove each agent session\'s Linear MCP access; skill prompts perform a session preflight instead.',
  'A host binary probe cannot prove model availability or quotas; an unavailable or exhausted model pauses affected work until the user decides.',
  'Stored role model, effort, and permission intent does not prove Orca launch parity or a successful agent execution.',
];

const CHECK_LABELS = {
  bun: 'bun >= 1.3.14 runtime',
  git: 'git CLI',
  gh: 'gh CLI',
  'gh-stack': 'gh stack extension',
  'orca-binary': 'resolved Orca CLI',
  'orca-runtime': 'Orca runtime connection',
  'orca-orchestration-guide': 'Orca orchestration guide capability',
  'orca-cli-guide': 'Orca CLI guide capability',
};

// The real commands behind each probe. gh-stack runs the actual
// `gh stack --help`: a "stack" substring in `gh extension list` output is not
// proof the extension command works.
export const PROBE_COMMANDS = {
  git: ['git', ['--version']],
  gh: ['gh', ['--version']],
  'gh-stack': ['gh', ['stack', '--help']],
};

export function resolveOrcaExecutable({ env = Bun.env, platform = process.platform } = {}) {
  if (typeof env.ORCA_CLI_COMMAND === 'string' && env.ORCA_CLI_COMMAND.trim() !== '') {
    return env.ORCA_CLI_COMMAND.trim();
  }
  if (typeof env.ORCA_DEV_REPO_ROOT === 'string' && env.ORCA_DEV_REPO_ROOT.trim() !== '') {
    return 'orca-dev';
  }
  const managed = Boolean(env.ORCA_TERMINAL_HANDLE || env.ORCA_WORKTREE_ID);
  if (platform === 'linux' && !managed) return 'orca-ide';
  return 'orca';
}

function orcaCommand(name, executable) {
  if (name === 'orca-binary') return [executable, ['--version']];
  if (name === 'orca-runtime') return [executable, ['status', '--json']];
  if (name === 'orca-orchestration-guide') {
    return [executable, ['skills', 'get', 'orchestration', '--json']];
  }
  if (name === 'orca-cli-guide') return [executable, ['skills', 'get', 'orca-cli', '--json']];
  return null;
}

function validateOrcaOutput(name, stdout) {
  if (name === 'orca-binary') return { ok: true, stdout };
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { ok: false, stdout: 'invalid JSON response' };
  }
  if (name === 'orca-runtime') {
    const runtime = parsed?.result?.runtime;
    const ready = parsed?.ok === true && runtime?.state === 'ready' &&
      runtime?.reachable === true && runtime?.connectionState === 'connected';
    return { ok: ready, stdout: ready ? 'ready and connected' : 'runtime is not ready and connected' };
  }
  const expected = name === 'orca-cli-guide' ? 'orca-cli' : 'orchestration';
  const ready = parsed?.name === expected && typeof parsed?.markdown === 'string' && parsed.markdown.length > 0;
  return { ok: ready, stdout: ready ? `${expected} guide available` : `${expected} guide unavailable` };
}

// Pure semver-floor comparison over numeric prefix segments ("1.3.14" style;
// trailing build metadata is ignored).
export function meetsFloor(version, floor = BUN_FLOOR) {
  const nums = (s) => String(s).split('.').map((n) => Number.parseInt(n, 10));
  const [v, f] = [nums(version), nums(floor)];
  for (let i = 0; i < Math.max(v.length, f.length); i++) {
    const a = Number.isInteger(v[i]) ? v[i] : 0;
    const b = Number.isInteger(f[i]) ? f[i] : 0;
    if (a !== b) return a > b;
  }
  return true;
}

export async function runRealCheck(name, { orcaExecutable = resolveOrcaExecutable() } = {}) {
  if (name === 'bun') {
    const version = Bun.version;
    return { ok: meetsFloor(version), stdout: `v${version}` };
  }
  const [cmd, args] = orcaCommand(name, orcaExecutable) ?? PROBE_COMMANDS[name];
  try {
    const result = Bun.spawnSync([cmd, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10000,
    });
    if (result.exitCode === 0) {
      const stdout = result.stdout.toString().trim();
      return name.startsWith('orca-') ? validateOrcaOutput(name, stdout) : { ok: true, stdout };
    }
    const detail = (result.stderr.toString().trim() || result.stdout.toString().trim()).slice(0, 120);
    return { ok: false, stdout: detail || `exit ${result.exitCode}` };
  } catch (err) {
    return { ok: false, stdout: err?.code ?? 'not found' };
  }
}

export async function checkCapabilities(exec, resolution = {}) {
  const orcaExecutable = resolveOrcaExecutable(resolution);
  const names = [
    'bun', 'git', 'gh', 'gh-stack', 'orca-binary', 'orca-runtime',
    'orca-orchestration-guide', 'orca-cli-guide',
  ];
  const checks = [];
  for (const name of names) {
    let result;
    try {
      result = await exec(name, { orcaExecutable });
    } catch (err) {
      result = { ok: false, stdout: err?.message ?? 'error' };
    }
    const ok = !!result?.ok;
    const baseLabel = CHECK_LABELS[name] ?? name;
    checks.push({
      name,
      label: !ok && name.startsWith('orca-')
        ? `${baseLabel} via ${orcaExecutable}`
        : baseLabel,
      ok,
      detail: ok
        ? String(result?.stdout ?? '').trim().slice(0, 120) || 'found'
        : String(result?.stdout ?? result?.detail ?? '').trim().slice(0, 120) || 'not found',
    });
  }
  const gaps = checks.filter((c) => !c.ok).map((c) => `missing ${c.label}`);
  return { checks, gaps, limitations: [...PROBE_LIMITATIONS] };
}
