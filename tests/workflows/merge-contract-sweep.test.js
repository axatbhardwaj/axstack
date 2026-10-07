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
  /(?:workers?|reviewers?|monitors?|managers?|nightly triage) (?:may|can|must|shall|always) (?:auto-)?merge/i,
];
// Match the subject and its merge restriction independently within a sentence.
// Human npm approval is a separate action, including in the old AGENTS rule
// that assigned release merge and npm approval to the human in one sentence.
const manualMerge = /\b(?:human|user) merges?\b|\bmerged by (?:the )?(?:human|user)\b|\b(?:human|user)[ -]merged\b|\bby (?:the )?(?:human|user)\b.*\bmerged\b/i;
const agrees = (text) => !sentences(text).some((unit) => {
  const newlyEligible = (/\brelease\b/i.test(unit) && /\bPRs?\b/i.test(unit))
    || [/\bAxstack\b/i, /\b(?:skill|merge-authority|merge-rule)\b/i, /\btext\b/i]
      .every((concept) => concept.test(unit));
  return contradictions.slice(0, -1).some((pattern) => pattern.test(unit))
    || requires(unit, contradictions.at(-1))
    || (newlyEligible && (/never auto-merge/i.test(unit) || requires(unit, manualMerge)));
});

test('every packaged and public surface agrees with the owning-watch merge boundary', () => {
  for (const path of paths) {
    const source = read(path);
    expect(agrees(source), path).toBe(true);
    for (const rewording of [
      'Release PRs are eligible under the watch predicate.',
      'Under the watch predicate, release PRs are eligible.',
      'Axstack skill and merge-rule text are eligible under the watch predicate.',
      'The human approves the npm stage after the release PR merges.',
      'After release PR merge, human npm stage approval remains required.',
    ]) expect(agrees(`${source}.\n${rewording}`), `${path}: correct policy`).toBe(true);
    for (const contradiction of [
      'The human merges by default.', 'Standalone owners never merge.',
      "Solo mode requires the user's chat reply before automatic merge.",
      'Never auto-merge release PRs.', 'Never auto-merge Axstack merge-rule text.',
      'The human merges the release PR.',
      'Release PRs are merged by the user on the forge.',
      'Release PRs are user-merged.',
      'Promotion, release, deploying-base, and peer PRs are merged by the user on the forge.',
      'The human merges the release PR and approves the npm stage; agents never run npm stage approve.',
      'The release PR is merged by the human.',
      'By the user on the forge, release PRs are merged.',
      'User-merged are release PRs.',
      'Release PRs must never auto-merge.',
      'Promotion, deploying-base, peer and release PRs are user-merged.',
      'Axstack merge-authority text is user-merged.',
      'PRs changing Axstack skill text are merged by the user.',
      'The user merges PRs changing Axstack merge-rule text.',
      'Axstack merge-rule text must never auto-merge.',
      'Text governing Axstack merge-rule policy is user-merged.',
      'Reviewers can merge.',
    ]) expect(agrees(`${source}.\n${contradiction}`), `${path}: injected ${contradiction}`).toBe(false);
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
