import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
const root = `${import.meta.dir}/../../skills/axstack/references`;
const path = `${root}/schedule-policy.json`;
const policy = () => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { clauses: [] };
const hash = (s) => new Bun.CryptoHasher('sha256').update(s).digest('hex');
test('every imported clause has exact-byte provenance and source-export identity', () => {
  const p = policy();
  const imported = p.clauses.filter((c) => c.status === 'imported');
  expect(imported).toHaveLength(3);
  const prompt = readFileSync(`${root}/review-manager-prompt.md`, 'utf8');
  const clauses = prompt.split('\n').filter((line) => /^(First command of every pass|Peer scope \(user-decided|Pass branches:)/.test(line));
  expect(clauses.map(hash).sort()).toEqual(imported.map((c) => c.sha256).sort());
  for (const c of imported) {
    expect(c.sourceExportSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(c.promptFile).toBe('review-manager-prompt.md');
  }
  expect(p.clauses.filter((c) => c.status === 'user-hold')).toHaveLength(5);
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
