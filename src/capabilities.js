// Host capability checks. `exec` is injected (name -> { ok, stdout }) so
// tests never spawn real tools. A binary probe reports availability gaps; it
// cannot prove per-agent Linear MCP access, model quotas, or session MCP.
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
