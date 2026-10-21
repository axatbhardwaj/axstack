import { checkRule, requires } from './prose-contract.js';
import { readSkillFile as readFileSync } from './skill-source.js';
import { expect, test } from 'bun:test';


const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('watch and lifecycle require diligence PASS at the exact head', () => {
  const watch = compact('skills/axstack-watch/SKILL.md').split('## 5. State readiness precisely')[1]?.split('## 6.')[0];
  expect(watch).toMatch(/A current diligence `PASS` at the exact head is required before any merge-ready statement\./);
  expect(compact('skills/axstack/references/lifecycle.md')).toMatch(/Merge-ready requires every mode-required authored reviewer receipt to `APPROVE` at the current head and base[^.]*current diligence `PASS` at that exact head; CI\/tests alone are insufficient\./);
});

test('review keeps diligence independent and requires its PASS for merge-ready', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/In authored PR review rounds, dispatch `axstack-diligence` independently alongside the configured reviewer\(s\) on the same exact revision and base\./);
  expect(review).toMatch(/A diligence `FINDINGS` receipt[^.]{0,140}it is not an extra `REQUEST_CHANGES` round\./);
  expect(review).toMatch(/\*\*Authored diligence:\*\* a current `PASS` is required with reviewer approval for merge-ready;/);
});

test('authored receipt counts exclude the separate diligence receipt', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/The diligence receipt is separate and does not count as a reviewer receipt\./);
  expect(review).toMatch(/an authored reviewer receipt count (?:other than|that differs from) its mode-required count is incomplete\./i);
  expect(review).toMatch(/Authored mode requires exactly its mode-required count of current eligible configured reviewer receipts and a separate current diligence receipt;/);
});

test('implement counts one failing round toward step-back and preserves the PASS gate', () => {
  const implement = compact('skills/axstack-implement/SKILL.md');
  expect(implement).toMatch(/Merge-ready also requires a current diligence `PASS` at that head; diligence `FINDINGS` return to the same author within the review round\./);
  checkRule(implement.replace(/`/g, ''), (text) => requires(text,
    /\bround with reviewer REQUEST_CHANGES\b.*\bdiligence FINDINGS\b/i,
    /\bincrements repairs once\b/i, /\bcounts once toward\b.*\bround-3 step-back\b/i),
  'A round with reviewer REQUEST_CHANGES and/or diligence FINDINGS increments repairs once and counts once toward the round-3 step-back.',
  [[/\bcounts once\b/i, 'counts twice']]);
  checkRule(implement.replace(/`/g, ''), (text) => requires(text,
    /\bany counted failing review round\b/i, /\bleaves rounds at (?:3 or more|least 3)\b/i, /\bwhile step-back: unused\b/i, /\bdriver\b.*\bsteps back\b/i, /\bexactly one extra repair round\b/i),
  'On any counted failing review round that leaves rounds at least 3 while step-back: unused, the driver steps back to assess exactly one extra repair round.',
  [[/\bsteps back\b/i, 'holds without stepping back']]);
});

test('diligence rejects stale receipts and binds PR evidence to head and base', () => {
  const rule = compact('skills/axstack/references/diligence.md');
  expect(rule).toMatch(/A stale or missing receipt is not a pass\./);
  expect(rule).toMatch(/Bind the result to the exact head and base\./);
});

test('release check has its own linked paragraph', () => {
  const rule = read('skills/axstack/references/candidate-publication.md');
  expect(rule).toMatch(/For a release PR, dispatch `axstack-diligence` under\n\[Diligence\]\(diligence\.md\) to check the release PR body\nagainst the merged PRs before publication\./);
});

test('publication returns diligence FINDINGS to the same author before publishing', () => {
  expect(compact('skills/axstack/references/candidate-publication.md')).toMatch(/Resolve `FINDINGS` with the same author before publishing\./);
});

test('diligence FINDINGS are report-only and stay in the owning phase', () => {
  expect(compact('skills/axstack/references/diligence.md')).toMatch(/`FINDINGS` identifies a medium or high mismatch for the driver to resolve at the owning phase; it does not edit the artifact or create another review round by itself\./);
});

// Peer no-diligence and first/follow-up receipts: peer-review.test.js (B4).
