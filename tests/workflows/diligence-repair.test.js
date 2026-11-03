import { checkRule, prohibits, requires } from './prose-contract.js';
import { readSkillFile as readFileSync } from './skill-source.js';
import { expect, test } from 'bun:test';


const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('watch and lifecycle preserve the separate PASS gate outside combined eligibility', () => {
  for (const path of ['skills/axstack-watch/SKILL.md', 'skills/axstack/references/lifecycle.md']) {
    checkRule(compact(path).replace(/`/g, ''), (text) => requires(text,
      /(?:all other work requires separate (?:current )?|otherwise separate )diligence/i,
      /diligence PASS/, /exact head and base/i),
    'All other work requires separate diligence PASS at the exact head and base.',
    [[/diligence PASS/, 'diligence UNKNOWN']]);
  }
});

test('review sends diligence findings to the same author within the same round', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/A diligence `FINDINGS` receipt[^.]{0,140}it is not an extra `REQUEST_CHANGES` round\./);
});

test('authored receipt count excludes separate diligence', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  checkRule(review.replace(/`/g, ''), (text) => prohibits(text, /does not count/i,
    /separate diligence/i, /reviewer receipt/i),
  'Separate diligence does not count as a reviewer receipt.',
  [[/does not count/i, 'counts']]);
  expect(review).toMatch(/an authored reviewer receipt count other than one is not the selected mode\./i);
});

test('implement counts a combined or separate failing round once toward step-back', () => {
  const implement = compact('skills/axstack-implement/SKILL.md').replace(/`/g, '');
  checkRule(implement, (text) => requires(text,
    /\bround with reviewer REQUEST_CHANGES\b.*\bdiligence FINDINGS\b/i,
    /Scope: FINDINGS/i, /\bincrements repairs once\b/i,
    /\bcounts once toward\b.*\bround-3 step-back\b/i),
  'A round with reviewer REQUEST_CHANGES and/or diligence FINDINGS (including Scope: FINDINGS) increments repairs once and counts once toward the round-3 step-back.',
  [[/\bcounts once\b/i, 'counts twice'], [/Scope: FINDINGS/i, 'Scope: PASS']]);
  checkRule(implement, (text) => requires(text,
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
