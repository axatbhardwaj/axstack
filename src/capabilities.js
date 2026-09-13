// Host capability checks. `exec` is injected (name -> { ok, stdout }) so
// tests never spawn real tools. A binary probe reports availability gaps; it
// cannot prove per-agent Linear MCP access, model quotas, or session MCP.
export const BUN_FLOOR = '1.3.14';

export const PROBE_LIMITATIONS = [
  'A host binary probe cannot prove each agent session\'s Linear MCP access; skill prompts perform a session preflight instead.',
  'A host binary probe cannot prove model availability or quotas; an unavailable or exhausted model pauses affected work until the user decides.',
];

const CHECK_LABELS = {
  bun: 'bun >= 1.3.14 runtime',
  git: 'git CLI',
  gh: 'gh CLI',
  'gh-stack': 'gh stack extension',
  paseo: 'paseo CLI',
};

// The real commands behind each probe. gh-stack runs the actual
// `gh stack --help`: a "stack" substring in `gh extension list` output is not
// proof the extension command works.
export const PROBE_COMMANDS = {
  git: ['git', ['--version']],
  gh: ['gh', ['--version']],
  'gh-stack': ['gh', ['stack', '--help']],
  paseo: ['paseo', ['--version']],
};

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

export async function runRealCheck(name) {
  if (name === 'bun') {
    const version = Bun.version;
    return { ok: meetsFloor(version), stdout: `v${version}` };
  }
  const [cmd, args] = PROBE_COMMANDS[name];
  try {
    const result = Bun.spawnSync([cmd, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10000,
    });
    if (result.exitCode === 0) {
      return { ok: true, stdout: result.stdout.toString().trim() };
    }
    const detail = (result.stderr.toString().trim() || result.stdout.toString().trim()).slice(0, 120);
    return { ok: false, stdout: detail || `exit ${result.exitCode}` };
  } catch (err) {
    return { ok: false, stdout: err?.code ?? 'not found' };
  }
}

export async function checkCapabilities(exec) {
  const names = ['bun', 'git', 'gh', 'gh-stack', 'paseo'];
  const checks = [];
  for (const name of names) {
    let result;
    try {
      result = await exec(name);
    } catch (err) {
      result = { ok: false, stdout: err?.message ?? 'error' };
    }
    const ok = !!result?.ok;
    checks.push({
      name,
      label: CHECK_LABELS[name] ?? name,
      ok,
      detail: ok
        ? String(result?.stdout ?? '').trim().slice(0, 120) || 'found'
        : String(result?.stdout ?? result?.detail ?? '').trim().slice(0, 120) || 'not found',
    });
  }
  const gaps = checks.filter((c) => !c.ok).map((c) => `missing ${c.label}`);
  return { checks, gaps, limitations: [...PROBE_LIMITATIONS] };
}
