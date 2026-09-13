// Host capability checks. `exec` is injected (name -> { ok, stdout }) so
// tests never spawn real tools. A binary probe reports availability gaps; it
// cannot prove per-agent Linear MCP access, model quotas, or session MCP.
import { execFileSync } from 'node:child_process';

export const PROBE_LIMITATIONS = [
  'A host binary probe cannot prove each agent session\'s Linear MCP access; skill prompts perform a session preflight instead.',
  'A host binary probe cannot prove model availability or quotas; an unavailable or exhausted model pauses affected work until the user decides.',
];

const CHECK_LABELS = {
  node: 'node >= 22 runtime',
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

export async function runRealCheck(name) {
  if (name === 'node') {
    const major = Number(String(process.versions.node).split('.')[0]);
    return {
      ok: Number.isInteger(major) && major >= 22,
      stdout: `v${process.versions.node}`,
    };
  }
  const [cmd, args] = PROBE_COMMANDS[name];
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return { ok: true, stdout };
  } catch {
    return { ok: false, stdout: 'not found' };
  }
}

export async function checkCapabilities(exec) {
  const names = ['node', 'git', 'gh', 'gh-stack', 'paseo'];
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
