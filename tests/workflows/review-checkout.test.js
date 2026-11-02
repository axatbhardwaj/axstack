import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const publication = () => read('skills/axstack/references/candidate-publication.md');
const pins = [
  'Reviewers must use async `delegate_task` with native `isolation:"worktree"`.',
  'Delegated reviewers inspect their own native detached checkout; tracked candidate files remain read-only and outputs go to their private evidence folder.',
  'After each delegated completion, compare the driver HEAD and `git status --porcelain` with their pre-dispatch values; any change holds advancement.',
  'Before removing a reviewer checkout, read back its report and supporting evidence, then use exact `git worktree remove <recorded-native-worktree-path>` without force.',
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
  'skills/axstack/references/automations.md',
  'skills/axstack/references/candidate-publication.md',
  'skills/axstack-review/references/review-candidate.md',
]) test(`reviewers use native isolation and verify the candidate and base in ${path}`, () => {
  const text = sentences(read(path).replace(/`/g, '').replace(/\|\n/g, '|.\n')).join('. ');
  checkRule(text, (source) => requires(source, /reviewers/i, /native/i, /isolation:"worktree"/i),
    'Reviewers must use native isolation:"worktree".',
    [[/native/i, 'driver-made'], [/isolation:"worktree"/i, 'isolation:"shared"']], [/native/i]);
  checkRule(text, (source) => requires(source, /reviewers/i, /check out/i, /verif/i, /exact candidate SHA/i, /pinned base/i, /inside/i),
    'Reviewers must check out and verify the exact candidate SHA and pinned base inside their native worktree.',
    [[/verif\w*/i, 'assume'], [/inside/i, 'outside']], [/exact candidate SHA/i, /pinned base/i]);
});

// Discover every shipped skill file and top-level guide: an added surface is covered too.
const shipped = [
  ...readdirSync(`${import.meta.dir}/../../skills`, { recursive: true }).map((path) => `skills/${path}`),
  ...readdirSync(`${import.meta.dir}/../../docs`).filter((path) => path.endsWith('.md')).map((path) => `docs/${path}`),
].filter((path) => statSync(`${import.meta.dir}/../../${path}`).isFile());
const driverMadeReviewerCheckout = (text) => text.replace(/`/g, '').replace(/\|\n/g, '|\n\n')
  .split(/\n\s*\n/).some((paragraph) => sentences(paragraph).some((clause) => {
    if (!requires(clause, /(?:driver[ -](?:made|created)|driver (?:must |shall )?(?:makes?|creates?)|(?:made|created) by the driver)/i,
      /checkouts?/i)) return false;
    if (/reviewers?|review checkout|bounded PR jobs/i.test(clause)) return true;
    // These roles keep driver-made checkouts; a nearby reviewer sentence does not change that.
    if (/release checks|investigators?|UI verifier/i.test(clause)) return false;
    return /reviewers?|review checkout|bounded PR jobs/i.test(paragraph);
  }));
test('all shipped reviewer guidance rejects driver-made checkouts', () => {
  const offenders = shipped.filter((path) => driverMadeReviewerCheckout(read(path)));
  expect(offenders).toEqual([]);
  for (const wording of [
    'Each reviewer uses a separate driver-made disposable detached checkout.',
    'Reviewers must use a detached checkout created by the driver.',
    'Bounded PR jobs use driver-made detached checkouts.',
    'The driver must create the review checkout with git worktree add --detach.',
    'Reviewers must use async delegate_task and the driver makes a disposable detached checkout of candidate SHA and pinned base.',
  ]) expect(driverMadeReviewerCheckout(wording)).toBe(true);
  expect(driverMadeReviewerCheckout('Investigators receive driver-made detached checkouts.')).toBe(false);
  expect(driverMadeReviewerCheckout('Reviewers use native isolation. Release checks retain driver-made detached checkouts.')).toBe(false);
  for (const path of shipped) {
    expect(driverMadeReviewerCheckout(`${read(path)}\n\nEach reviewer uses a driver-made detached checkout.`), path).toBe(true);
  }
});

for (const path of [
  'skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/candidate-publication.md',
  'skills/axstack-review/references/review-candidate.md',
  'skills/axstack-review/references/codebase-mode.md',
]) test(`reviewer isolation proof in ${path}`, () => {
  const text = sentences(read(path).replace(/`/g, '').replace(/\|\n/g, '|.\n')).join('. ');
  checkRule(text, (source) => requires(source, /reviewers?/i, /cd|change directory/i, /own worktree/i,
    /verify|confirm/i, /path/i, /differs|distinct/i, /driver/i),
    "Each reviewer shall change directory into its own worktree and confirm its real path is distinct from the driver's.",
    [[/differs|distinct/i, 'equals'], [/own worktree/i, 'driver worktree']], [/path/i, /driver/i]);
});

test('reviewer dispatch supplies the driver path for the isolation proof', () => {
  const text = sentences(read('skills/axstack/references/t3-runtime.md').replace(/`/g, '').replace(/\|\n/g, '|.\n')).join('. ');
  checkRule(text, (source) => requires(source, /before reviewer dispatch/i, /driver/i, /resolved/i, /worktree path/i, /brief/i),
    'Before reviewer dispatch, the driver shall place its resolved worktree path in the brief.',
    [[/reviewer/i, 'author'], [/resolved/i, 'guessed']], [/worktree path/i]);
});
