import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';
const root = `${import.meta.dir}/../../skills/axstack/references`;
const path = `${root}/schedule-policy.json`;
const policy = () => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { clauses: [] };
const hash = (s) => new Bun.CryptoHasher('sha256').update(s).digest('hex');
test('every shipped clause has exact-byte provenance and its approved disposition', () => {
  const p = policy();
  const dispositions = {
    'operating-context': ['edited', 'Host operating policy'],
    'durable-continuity': ['edited', 'Durable continuity:'],
    'temporary-directory-and-shell': ['verbatim', 'First command of every pass'],
    'peer-scope': ['verbatim', 'Peer scope (user-decided'],
    'leftover-sweep': ['edited', 'Leftover sweep:'],
    'pass-branches': ['verbatim', 'Pass branches:'],
  };
  const imported = p.clauses.filter((c) => c.status === 'imported');
  expect(imported.map((c) => c.id).sort()).toEqual(Object.keys(dispositions).sort());
  const prompt = readFileSync(`${root}/review-manager-prompt.md`, 'utf8');
  for (const c of imported) {
    const [kind, prefix] = dispositions[c.id];
    const lines = prompt.split('\n').filter((line) => line.startsWith(prefix));
    expect(lines).toHaveLength(1);
    expect(hash(lines[0])).toBe(c.sha256);
    expect(c.status).toBe('imported');
    expect(c.disposition).toMatchObject({ kind, decidedAt: '2026-11-15' });
    expect(c.sourceClauseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(c.sourceExportSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(c.promptFile).toBe('review-manager-prompt.md');
    if (kind === 'verbatim') expect(c.sha256).toBe(c.sourceClauseSha256);
  }
});
test('excluded clauses retain dated dispositions without shipping their text', () => {
  const excluded = policy().clauses.filter((c) => c.status !== 'imported');
  expect(excluded.map((c) => [c.id, c.status]).sort()).toEqual([
    ['alert-command', 'dropped'], ['operational-limits', 'host-only'],
  ]);
  for (const c of excluded) {
    expect(c.sourceClauseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(c.sourceExportSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(c.disposition).toMatchObject({ kind: c.status, decidedAt: '2026-11-15' });
    expect(c.disposition.reason).toMatch(/\S/);
    for (const key of ['sha256', 'promptFile', 'clause', 'text']) expect(c).not.toHaveProperty(key);
  }
});
test('excluded clause hashes are absent from shipped lines', () => {
  const excluded = policy().clauses.filter((c) => ['dropped', 'host-only'].includes(c.status));
  const shipped = ['review-manager-prompt.md', 'pr-triage-nightly.md', 'test-audit-weekly.md', 'schedule-policy.json']
    .flatMap((name) => readFileSync(`${root}/${name}`, 'utf8').split('\n'));
  const hashes = new Set(shipped.map(hash));
  for (const c of excluded) expect(hashes.has(c.sourceClauseSha256)).toBe(false);
});
test('host-specific continuity and operational limits use explicit host bindings', () => {
  const prompt = readFileSync(`${root}/review-manager-prompt.md`, 'utf8');
  expect(prompt).toContain('Durable continuity: {{HOST_CONTINUITY_PATH}}');
  expect(prompt.match(/\{\{HOST_CONTINUITY_PATH\}\}/g)).toHaveLength(1);
  expect(prompt.match(/~\/\.local\/share\/axstack\/runs\/review-manager\/progress\.md/g)).toHaveLength(2);
  expect(prompt).toContain('{{HOST_OPERATIONAL_LIMITS}}');
  checkRule(prompt, (text) => requires(text, /apply/i, /host-declared operational limits/i),
    'For each full pass, apply host-declared operational limits.',
    [[/apply/i, 'Never apply'], [/apply/i, 'Optionally apply']],
    [/apply/i, /host-declared operational limits/i]);
});
for (const file of ['skills/axstack/references/automations.md', 'docs/host-operations.md']) {
  test(`${file} requires host rendering before schedule creation`, () => {
    const text = readFileSync(`${import.meta.dir}/../../${file}`, 'utf8').replace(/`/g, '');
    const concepts = [/render|fill|substitut/i, /packaged prompt/i, /\{\{HOST_\*\}\}/,
      /host binding/i, /before/i, /schedule_task/];
    checkRule(text, (value) => requires(value, ...concepts),
      'Before schedule_task, fill the packaged prompt {{HOST_*}} placeholders from the host binding.',
      [[/before/i, 'after'], [/render|fill|substitut/i, 'Never render']], concepts);
    const forbidden = /never deploy/i;
    const guards = [/unfilled/i, /\{\{HOST_\*\}\}/];
    checkRule(text, (value) => prohibits(value, forbidden, ...guards),
      'When {{HOST_*}} placeholders remain unfilled, never deploy the prompt.',
      [[forbidden, 'always deploy']], guards);
    const submission = file.endsWith('automations.md') ? [/schedule_task/, /uses/i] : [/create/i, /schedule/i];
    checkRule(text, (value) => requires(value, ...submission, /rendered(?: packaged)? prompt/i),
      file.endsWith('automations.md') ? 'schedule_task uses the rendered packaged prompt.'
        : 'Create the schedule with the rendered prompt.',
      [[/rendered/i, 'raw'], [/rendered/i, 'unrendered']], [/rendered(?: packaged)? prompt/i]);
  });
}
test('private legacy resource exclusions cannot return', () => {
  const shipped = ['review-manager-prompt.md', 'schedule-policy.json']
    .map((name) => readFileSync(`${root}/${name}`, 'utf8')).join('\n');
  expect(shipped).not.toMatch(/carried over from|[\w-]+-owned resources|\/(?:root|home)\//i);
});
test('absent authoritative admission and submission policies remain explicit unknowns', () => {
  const p = policy();
  for (const phase of ['admission', 'submission']) {
    expect(p.review?.[phase]).toMatchObject({ status: 'unknown', headAgeThresholdSeconds: null,
      clockSemantics: null, pendingCheckTreatment: null });
  }
  expect(p.review?.dependentHold).toBe('T30');
});
test('the clause policy does not duplicate the helper cadence setting', () => {
  expect(policy()).not.toHaveProperty('reviewManagerEveryMs');
});
