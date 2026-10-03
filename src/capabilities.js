// Host capability checks. Injected execution keeps tests off live runtimes.
export const BUN_FLOOR = '1.3.14';
export const T3_FLOOR = '0.0.46-nightly.20261003';

export const PROBE_LIMITATIONS = [
  'T3 orchestration MCP readiness, provider auth, models and effort are verified by driver preflight inside a T3 thread, never from the binary probe.',
  'Stored role intent and a T3 version do not prove effective launch configuration or successful agent execution.',
];

const CHECK_LABELS = {
  bun: 'bun >= 1.3.14 runtime',
  git: 'git CLI',
  gh: 'gh CLI',
  'gh-stack': 'gh stack extension',
  't3-binary': `T3 Code CLI >= ${T3_FLOOR}`,
};

// Run the extension command itself, not a substring in an extension listing.
export const PROBE_COMMANDS = {
  git: ['git', ['--version']],
  gh: ['gh', ['--version']],
  'gh-stack': ['gh', ['stack', '--help']],
  't3-binary': ['t3', ['--version']],
};

function validT3Version(stdout) {
  const match = /^(?:t3\s+)?v?(\d+\.\d+\.\d+)(?:-nightly\.(\d{8})(?:\.\d+)?)?$/.exec(stdout.trim());
  if (!match || !meetsFloor(match[1], T3_FLOOR.split('-')[0])) return false;
  if (!match[2]) return true;
  const date = match[2];
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso
    && date >= T3_FLOOR.split('nightly.')[1];
}

function validateT3Result(result) {
  if (!result?.ok || validT3Version(String(result.stdout ?? ''))) return result;
  return { ok: false, stdout: `requires T3 >= ${T3_FLOOR}; got ${String(result.stdout ?? '').trim() || 'malformed version'}` };
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
      const stdout = result.stdout.toString().trim();
      const checked = { ok: true, stdout };
      return name === 't3-binary' ? validateT3Result(checked) : checked;
    }
    const detail = (result.stderr.toString().trim() || result.stdout.toString().trim()).slice(0, 120);
    return { ok: false, stdout: detail || `exit ${result.exitCode}` };
  } catch (err) {
    return { ok: false, stdout: err?.code ?? 'not found' };
  }
}

export async function checkCapabilities(exec) {
  const names = ['bun', 'git', 'gh', 'gh-stack', 't3-binary'];
  const checks = [];
  for (const name of names) {
    let result;
    try {
      result = await exec(name);
    } catch (err) {
      result = { ok: false, stdout: err?.message ?? 'error' };
    }
    if (name === 't3-binary') result = validateT3Result(result);
    const ok = !!result?.ok;
    const baseLabel = CHECK_LABELS[name] ?? name;
    checks.push({
      name,
      label: baseLabel,
      ok,
      detail: ok
        ? String(result?.stdout ?? '').trim().slice(0, 120) || 'found'
        : String(result?.stdout ?? result?.detail ?? '').trim().slice(0, 120) || 'not found',
    });
  }
  const gaps = checks.filter((c) => !c.ok).map((c) => `missing ${c.label}`);
  return { checks, gaps, limitations: [...PROBE_LIMITATIONS] };
}
