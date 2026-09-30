import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('watch and lifecycle require diligence PASS at the exact head', () => {
  const watch = compact('skills/axstack-watch/SKILL.md').split('## 5. State readiness precisely')[1]?.split('## 6.')[0];
  expect(watch).toMatch(/A current diligence `PASS` at the exact head is required before any merge-ready statement\./);
  expect(compact('skills/axstack/references/lifecycle.md')).toMatch(/Merge-ready requires applicable review receipt\(s\) and current diligence `PASS` at the exact head; CI\/tests alone are insufficient\./);
});

test('review keeps diligence independent and requires its PASS for merge-ready', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/In peer and authored PR review rounds, dispatch `axstack-diligence` independently alongside the configured reviewer\(s\) on the same exact revision and base\./);
  expect(review).toMatch(/A diligence `FINDINGS` receipt[^.]{0,140}it is not an extra `REQUEST_CHANGES` round\./);
  expect(review).toMatch(/\*\*Diligence:\*\* a current `PASS` is required with reviewer approval for merge-ready;/);
});

test('authored receipt counts exclude the separate diligence receipt', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/The diligence receipt is separate and does not count as a reviewer receipt\./);
  expect(review).toMatch(/an authored reviewer receipt count other than one is not the selected mode\./);
  expect(review).toMatch(/Authored mode requires its one current eligible configured reviewer receipt and a separate current diligence receipt;/);
});

test('implement holds on the third finding round and preserves the PASS gate', () => {
  const implement = compact('skills/axstack-implement/SKILL.md');
  expect(implement).toMatch(/Merge-ready also requires a current diligence `PASS` at that head; diligence `FINDINGS` return to the same author within the review round\./);
  expect(implement).toMatch(/A round with reviewer `REQUEST_CHANGES` and\/or diligence `FINDINGS` increments `repairs` once and counts once toward the third-round hold\./);
  expect(implement).toMatch(/the third review round with `REQUEST_CHANGES` and\/or diligence `FINDINGS` on one PR records `held`/);
});

test('diligence rejects stale receipts and binds PR evidence to head and base', () => {
  const rule = compact('skills/axstack/references/diligence.md');
  expect(rule).toMatch(/A stale or missing receipt is not a pass\./);
  expect(rule).toMatch(/Bind the result to the exact head and base\./);
});

test('release check has its own linked paragraph', () => {
  const rule = read('skills/axstack/references/candidate-publication.md');
  expect(rule).toMatch(/Before the final version-bump PR's merge card, dispatch `axstack-diligence`[\s\S]*compare its bump with the merged PRs/);
});

test('publication returns diligence FINDINGS to the same author before publishing', () => {
  expect(compact('skills/axstack/references/candidate-publication.md')).toMatch(/Resolve `FINDINGS` with the same author before publishing\./);
});

test('diligence FINDINGS are report-only and stay in the owning phase', () => {
  expect(compact('skills/axstack/references/diligence.md')).toMatch(/`FINDINGS` identifies a mismatch for the driver to resolve at the owning phase; it does not edit the artifact or create another review round by itself\./);
});

test('peer publishing also requires its separate current diligence receipt', () => {
  expect(compact('skills/axstack-review/SKILL.md')).toMatch(/- Peer mode requires both current reviews, a separate current diligence receipt, and no unresolved material finding[^.]{0,100}\./);
});
