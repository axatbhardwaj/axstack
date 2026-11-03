import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const publication = () => read('skills/axstack/references/candidate-publication.md');
const pins = [
  'Authored reviewers must use async `delegate_task` with native `isolation:"worktree"`.',
  'Delegated reviewers must `cd` into their separate detached checkout; tracked candidate files remain read-only and outputs go to their private evidence folder.',
  'After each delegated completion, compare the driver HEAD and `git status --porcelain` with their pre-dispatch values; any change holds advancement.',
  'Before removing an authored reviewer checkout, read back its report and supporting evidence, then use exact `git worktree remove <recorded-native-worktree-path>` without force.',
];
for (const pin of pins) test(`review checkout safety: ${pin}`, () => {
  expect(normalize(publication())).toContain(pin);
  expect(normalize(publication()).split(pin).length).toBe(2);
});
test('review isolation AC2 scenario binds each required safety rule', () => {
  const scenario = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json')).cases.find(({ id }) => id === 'delegated-reviewer-isolation');
  expect(scenario.contracts).toEqual(pins);
  for (const pin of pins) {
    expect(normalize(publication())).toContain(pin);
    expect(normalize(publication()).split(pin).length).toBe(2);
  }
  expect(scenario.expected.action).toContain('Hold');
});
test('later reviews use a fresh checkout', () => {
  const concepts = [/later review/i, /fresh/i, /checkout/i];
  expect(requires(publication(), ...concepts)).toBe(true);
  const holdout = 'A fresh checkout is required for each later review.';
  expect(requires(holdout, ...concepts)).toBe(true);
  expect(requires(`Do not ${holdout}`, ...concepts)).toBe(false);
  const clauses = sentences(publication());
  const matching = clauses.filter((clause) => requires(clause, ...concepts));
  expect(requires(clauses.filter((clause) => !matching.includes(clause)).join('. '), ...concepts)).toBe(false);
  expect(requires(clauses.map((clause) => matching.includes(clause) ? `Do not ${clause}` : clause).join('. '), ...concepts)).toBe(false);
});

for (const path of [
  'skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/candidate-publication.md',
  'skills/axstack-review/references/review-candidate.md',
]) test(`reviewers use native isolation and verify the candidate and base in ${path}`, () => {
  const text = sentences(read(path).replace(/`/g, '').replace(/\|\n/g, '|.\n')).join('. ');
  checkRule(text, (source) => requires(source, /authored reviewers/i, /native/i, /isolation:"worktree"/i),
    'Authored reviewers must use native isolation:"worktree".',
    [[/native/i, 'driver-made'], [/isolation:"worktree"/i, 'isolation:"shared"']], [/native/i]);
  checkRule(text, (source) => requires(source, /authored reviewers/i, /check out/i, /verif/i, /exact candidate SHA/i, /pinned base/i, /inside/i),
    'Authored reviewers must check out and verify the exact candidate SHA and pinned base inside their native worktree.',
    [[/verif\w*/i, 'assume'], [/inside/i, 'outside']], [/exact candidate SHA/i, /pinned base/i]);
});

// Discover every shipped skill file and top-level guide: an added surface is covered too.
const shipped = [
  'README.md',
  ...readdirSync(`${import.meta.dir}/../../skills`, { recursive: true }).map((path) => `skills/${path}`),
  ...readdirSync(`${import.meta.dir}/../../docs`).filter((path) => path.endsWith('.md')).map((path) => `docs/${path}`),
].filter((path) => statSync(`${import.meta.dir}/../../${path}`).isFile());
// Keep role labels attached to mechanisms across punctuation in a table row.
const scopedText = (text) => text.replace(/`/g, '').split('\n').map((line) =>
  line.startsWith('|') ? line.replace(/[.;] /g, ', ') + '.\n' : line).join('\n');
const checkoutViolations = (text, mode = 'mixed') => scopedText(text)
  .split(/\n\s*\n/).flatMap((paragraph) => sentences(paragraph).filter((clause) => {
    const reviewer = /reviewers?|review checkout/i.test(clause);
    const authored = /authored|candidate reviewers/i.test(clause);
    const unscoped = /(?:all|every) (?:other )?reviewers?/i.test(clause);
    if (reviewer && requires(clause, /isolation:"worktree"/i)) {
      return !authored || /peer|all reviewers|every reviewer/i.test(clause);
    }
    const manual = requires(clause, /(?:driver[ -](?:made|created)|driver (?:must |shall )?(?:makes?|creates?)|(?:made|created) by the driver|detached checkout.*(?:made|created|prepared)|worktree add --detach)/i,
      /checkouts?|worktree add --detach/i);
    if (!manual) return false;
    if (authored || unscoped || (mode === 'mixed' && /each reviewer/i.test(clause))) return true;
    return reviewer && mode === 'mixed' && !/peer|codebase|release checks|investigators?|UI verifier/i.test(clause);
  }));
const reviewMode = (path) => /automations\.md$/.test(path) ? 'peer' : /codebase-mode\.md$/.test(path) ? 'codebase' : 'mixed';
test('shipped checkout rules keep native isolation authored-only', () => {
  expect(shipped.filter((path) => checkoutViolations(read(path), reviewMode(path)).length)).toEqual([]);
  expect(shipped).toContain('README.md');
  for (const wording of [
    'Authored reviewers use a driver-made detached checkout.',
    'Each authored reviewer works in a separate detached checkout made for the reviewer.',
    'Review-manager PR-job reviewers and all other reviewers use driver-made detached checkouts.',
    'Peer reviewers must use native isolation:"worktree".',
    'Every reviewer must use native isolation:"worktree".',
    'Reviewers (peer/authored) must use native isolation:"worktree".',
  ]) expect(checkoutViolations(wording).length, wording).toBeGreaterThan(0);
  expect(checkoutViolations('Peer reviewers use separate driver-made detached checkouts.')).toEqual([]);
  for (const path of shipped) {
    expect(checkoutViolations(`${read(path)}\n\nAuthored reviewers use a driver-made detached checkout.`, reviewMode(path)).length, path).toBeGreaterThan(0);
  }
});
for (const path of ['skills/axstack/references/t3-runtime.md', 'skills/axstack-review/references/review-candidate.md']) {
  test(`peer checkout rule stays separate from authored native isolation in ${path}`, () => {
    const text = scopedText(read(path));
    checkRule(text, (source) => requires(source, /peer reviewers/i, /driver[ -]made|driver makes/i, /detached checkout/i),
      'Peer reviewers must use driver-made detached checkouts.',
      [[/peer reviewers/i, 'authored reviewers'], [/driver[ -]made|driver makes/i, 'native']], [/detached checkout/i]);
    expect(checkoutViolations(read(path))).toEqual([]);
  });
}
test('review templates distinguish authored worktrees from peer checkouts', () => {
  for (const path of ['candidate-brief.md', 'review-receipt.md']) {
    expect(read(`skills/axstack-review/references/${path}`)).toMatch(/Workspace:.*authored: native worktree.*peer: detached checkout/i);
  }
  expect(read('skills/axstack-review/references/candidate-brief.md')).toMatch(/^Driver worktree: <authored: resolved absolute path.*peer: n\/a>/m);
});

for (const path of [
  'skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/candidate-publication.md',
  'skills/axstack-review/references/review-candidate.md',
]) test(`reviewer isolation proof in ${path}`, () => {
  const text = sentences(read(path).replace(/`/g, '').replace(/\|\n/g, '|.\n')).join('. ');
  checkRule(text, (source) => requires(source, /authored reviewers?/i, /cd|change directory/i, /own worktree/i,
    /verify|confirm/i, /path/i, /differs|distinct/i, /driver/i),
    "Each authored reviewer shall change directory into its own worktree and confirm its real path is distinct from the driver's.",
    [[/differs|distinct/i, 'equals'], [/own worktree/i, 'driver worktree']], [/path/i, /driver/i]);
});

test('reviewer dispatch supplies the driver path for the isolation proof', () => {
  const text = sentences(read('skills/axstack/references/t3-runtime.md').replace(/`/g, '').replace(/\|\n/g, '|.\n')).join('. ');
  checkRule(text, (source) => requires(source, /before authored reviewer dispatch/i, /driver/i, /resolved/i, /worktree path/i, /brief/i),
    'Before authored reviewer dispatch, the driver shall place its resolved worktree path in the brief.',
    [[/reviewer/i, 'author'], [/resolved/i, 'guessed']], [/worktree path/i]);
});
