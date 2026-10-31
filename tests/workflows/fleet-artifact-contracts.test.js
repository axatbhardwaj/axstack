import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../../skills`;
const contract = () => readFileSync(`${root}/axstack/references/local-artifacts.md`, 'utf8');
const rules = [
  { name: 'explicit scope keeps engineering and remote boundaries',
    tests: [/explicitly bound.*non-repository/i, /null repository identity alone (?:never authorizes|cannot authorize)/i,
      /engineering authors and code reviewers.*(?:still require|must retain).*repository.*native.*worktree isolation/i,
      /remote artifacts.*remain outside/i],
    phrase: 'never authorizes', inverted: 'authorizes', equivalent: 'cannot authorize' },
  { name: 'source independence and final-byte publication proof',
    tests: [/research branches keep independent first passes/i, /diligence reopens answer-changing claims/i,
      /before public publication (?:require|must have) Playwright layout\/interaction evidence/i,
      /independent source\/fact and design review of those same bytes/i,
      /changed bytes invalidate.*reviews and renders/i],
    phrase: 'require Playwright', inverted: 'skip Playwright', equivalent: 'must have Playwright' },
  { name: 'real ownership remains a driver obligation',
    tests: [/helper checks lexical paths and overlaps/i, /driver (?:must independently verify|shall independently check) real paths/i,
      /no symlink escapes, ownership and exclusive writers/i, /unknown ownership holds/i],
    phrase: 'must independently\nverify', inverted: 'may skip verification of', equivalent: 'shall independently check' },
];
function satisfies(source, predicates) {
  return source.split(/\n\s*\n/).some((p) => predicates.every((r) => r.test(p.replace(/\s+/g, ' '))));
}
for (const rule of rules) test(`artifact semantic contract: ${rule.name}`, () => {
  const source = contract();
  expect(satisfies(source, rule.tests)).toBe(true);
  const paragraphs = source.split(/\n\s*\n/);
  const index = paragraphs.findIndex((p) => satisfies(p, rule.tests));
  expect(index).toBeGreaterThanOrEqual(0);
  const original = paragraphs[index];
  paragraphs[index] = '';
  expect(satisfies(paragraphs.join('\n\n'), rule.tests)).toBe(false);
  paragraphs[index] = original.replace(rule.phrase, rule.inverted);
  expect(satisfies(paragraphs.join('\n\n'), rule.tests)).toBe(false);
  paragraphs[index] = original.replace(rule.phrase, rule.equivalent);
  expect(satisfies(paragraphs.join('\n\n'), rule.tests)).toBe(true);
});

test('dispatch/schema/lifecycle/role/review and all article callers join the same artifact boundary', () => {
  for (const file of ['axstack/references/fleet-dispatch.md', 'axstack/references/fleet-route-schema.md',
    'axstack/references/t3-runtime.md', 'axstack/references/lifecycle.md', 'axstack/references/role-roster.md',
    'axstack/references/diligence.md', 'axstack/references/ui-verification.md',
    'axstack-review/SKILL.md', 'axstack-research/SKILL.md', 'axstack-explain/SKILL.md',
    'axstack-publish/SKILL.md', 'axstack-explain/references/visual-qa.md']) {
    const source = readFileSync(`${root}/${file}`, 'utf8');
    const targets = [...source.matchAll(/\]\(([^)]*local-artifacts\.md)(?:#[^)]*)?\)/g)].map((m) => m[1]);
    expect(targets.length, file).toBeGreaterThan(0);
    for (const target of targets) {
      const path = `${root}/${file.slice(0, file.lastIndexOf('/'))}/${target}`;
      expect(readFileSync(path, 'utf8'), file).toBe(contract());
    }
  }
});

// Replaces the universal Git-checkout sentence pin: engineering remains isolated,
// while article snapshots preserve the same delegated verifier and private outputs.
test('visual QA distinguishes Git candidates from explicit article snapshots', () => {
  const source = readFileSync(`${root}/axstack-explain/references/visual-qa.md`, 'utf8');
  const predicates = [/browser and visual checks (?:use|require) delegated `axstack-ui-verifier`/i,
    /engineering candidates (?:require|must retain) its own detached checkout/i,
    /explicit non-repository articles.*local shared delegate.*owned exact-byte snapshot/i,
    /outputs stay in its private evidence folder/i,
    /Playwright checks and source\/design review.*exact final SHA-256 before public publication/i];
  expect(satisfies(source, predicates)).toBe(true);
  const paragraphs = source.split(/\n\s*\n/);
  const index = paragraphs.findIndex((p) => satisfies(p, predicates));
  const original = paragraphs[index];
  paragraphs[index] = '';
  expect(satisfies(paragraphs.join('\n\n'), predicates)).toBe(false);
  paragraphs[index] = original.replace('require its own detached checkout', 'may use the driver checkout');
  expect(satisfies(paragraphs.join('\n\n'), predicates)).toBe(false);
  paragraphs[index] = original.replace('require its own detached checkout', 'must retain its own detached checkout');
  expect(satisfies(paragraphs.join('\n\n'), predicates)).toBe(true);
});
