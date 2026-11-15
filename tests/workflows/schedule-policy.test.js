import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
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
  expect(p.clauses.map((c) => c.id).sort()).toEqual(Object.keys(dispositions).sort());
  const prompt = readFileSync(`${root}/review-manager-prompt.md`, 'utf8');
  for (const c of p.clauses) {
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
test('host-specific continuity and operational limits use explicit host bindings', () => {
  const prompt = readFileSync(`${root}/review-manager-prompt.md`, 'utf8');
  expect(prompt).toContain('Durable continuity: {{HOST_CONTINUITY_PATH}}');
  expect(prompt.match(/\{\{HOST_CONTINUITY_PATH\}\}/g)).toHaveLength(3);
  expect(prompt).toMatch(/host-declared operational limits[\s\S]*\{\{HOST_OPERATIONAL_LIMITS\}\}/i);
  expect(prompt).not.toMatch(/at most TWO|~6 GB|Admission order:|No missed-slot replay/);
});
test('dropped alerts and private legacy resource exclusions cannot return', () => {
  const shipped = ['review-manager-prompt.md', 'schedule-policy.json']
    .map((name) => readFileSync(`${root}/${name}`, 'utf8')).join('\n');
  expect(shipped).not.toMatch(/Alert command|hermes\s+send|telegram/i);
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
