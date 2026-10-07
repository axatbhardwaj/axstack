import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { publicDocPaths } from './public-docs.js';
import { checkRule, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const packaged = readdirSync(`${root}/skills`, { recursive: true })
  .filter((path) => path.endsWith('.md')).map((path) => `skills/${path}`);
const paths = [...packaged, 'AGENTS.md', ...publicDocPaths(root)];
const actorSurfaces = [
  'skills/axstack-relay/SKILL.md', 'skills/axstack/references/diligence.md',
  'skills/axstack-audit/SKILL.md', 'skills/axstack-review/SKILL.md',
  'skills/axstack/references/candidate-publication.md',
  'skills/axstack/references/run-record.md', 'skills/axstack/references/test-audit-weekly.md',
];

// Adapted from #253: sweep the entire shipped prose boundary, then require
// actor wording at the role/publication/record boundaries. This catches drift
// in a surface omitted by the primary watch predicate tests; no live merge proof.
const contradictions = [
  /(?:human|user) merges? (?:PRs )?(?:by )?default|human merge (?:is|remains|stays) (?:the )?default|default (?:to|is) human merge/i,
  /standalone (?:watch|owners?) (?:never|cannot|must not) merge/i,
  /solo mode requires? (?:the )?(?:user.s chat reply|human approval)/i,
  /(?:never auto-merge|user.merge(?:d)?|human merges?).*(?:release PRs|Axstack (?:skill|merge-authority|merge-rule) text)/i,
  /(?:workers?|reviewers?|monitors?|managers?|nightly triage) (?:may|can|must|shall|always) (?:auto-)?merge/i,
];
const agrees = (text) => !sentences(text).some((unit) =>
  contradictions.slice(0, -1).some((pattern) => pattern.test(unit))
  || requires(unit, contradictions.at(-1)));

test('every packaged and public surface agrees with the owning-watch merge boundary', () => {
  for (const path of paths) {
    const source = read(path);
    expect(agrees(source), path).toBe(true);
    for (const contradiction of [
      'The human merges by default.', 'Standalone owners never merge.',
      "Solo mode requires the user's chat reply before automatic merge.",
      'Never auto-merge release PRs.', 'Never auto-merge Axstack merge-rule text.',
      'Reviewers can merge.',
    ]) expect(agrees(`${source}.\n${contradiction}`), `${path}: injected contradiction`).toBe(false);
  }
  const record = read('skills/axstack/references/run-record.md');
  for (const [field, values] of [
    ['Approval mode:', /solo.*team.*readback receipt/i],
    ['Deploying bases:', /integration.*deploying.*docs\/workflow evidence/i],
  ]) expect(record.split('\n').find((line) => line.startsWith(field))).toMatch(values);
  const concepts = [/recorded owning watch thread/i, /merges/i, /under/i, /watch predicate/i];
  const accepts = (text) => requires(text, ...concepts) && agrees(text);
  for (const path of actorSurfaces) {
    checkRule(compact(read(path)), accepts,
      'Under the watch predicate, the recorded owning watch thread merges.',
      [[/recorded owning watch thread/i, 'any worker'], [/under/i, 'without']], concepts);
  }
});
