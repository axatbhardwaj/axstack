import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, loadedReferences, requires, sentences } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// These are source-contract checks. The separately frozen model evaluation is
// the behavioral evidence; passing these checks alone proves no runtime result.
test('review manager exposes one short finite-session native prompt', () => {
  const reviewPath = 'skills/axstack/references/review-manager-prompt.md';
  expect(existsSync(`${root}/skills/axstack/references/watch-manager-prompt.md`)).toBe(false);
  for (const path of [reviewPath]) {
    expect(existsSync(`${root}/${path}`), `${path} exists`).toBe(true);
    expect(read(path), `${path} discovers the contract relatively`).toContain('../axstack/references/automations.md');
  }
  expect(compact(reviewPath)).toMatch(/axstack-review/i);
  const reviewSkill = compact('skills/axstack-review/SKILL.md');
  expect(reviewSkill).toMatch(/fresh review-manager session[\s\S]{0,220}follow only[^.]*discovery[^.]*admission/i);
  expect(reviewSkill).toMatch(/Do not review a PR[^.]*materialize `axstack-owner`[^.]*check out a PR branch/i);
});

// The packaged prompt is the gate's production boundary; mutations below
// protect its semantics without claiming live model or scheduler compliance.
const quietRules = [
  ['gate precedes skill loading',
    [/quiet check/i, /before/i, /invoking.*axstack-review/i, /reading any.*skills\/\*\*/i],
    'Before invoking axstack-review or reading any skills/** file, perform the quiet check.',
    [[/before/i, 'after']]],
];
for (const [name, concepts, rewording, inversions] of quietRules) {
  test(`review-manager quiet gate: ${name}`, () => {
    checkRule(compact('skills/axstack/references/review-manager-prompt.md'),
      (text) => requires(text, ...concepts), rewording,
      [...inversions, [/^/, 'Do not ']], concepts);
  });
}

test('quiet check precedes all skill and reference loads', () => {
  const text = read('skills/axstack/references/review-manager-prompt.md');
  const target = /skills\/|axstack-review\b|(?:automations|t3-runtime)\.md\b/i;
  const load = /\b(?:load(?:s|ed|ing)?|read(?:s|ing)?|follow(?:s|ing)?|enter(?:s|ing)?|invok(?:e|es|ing)|consult(?:s|ed|ing)?|open(?:s|ed|ing)?|inspect(?:s|ed|ing)?|stud(?:y|ies|ied|ying)|review(?:s|ed|ing)?)\b/i;
  const accepts = (source) => {
    const check = source.search(/\b(?:run|perform) (?:the|a) quiet check/i);
    const prefix = source.slice(0, check);
    const namedReferences = prefix.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2');
    return check >= 0 &&
      !loadedReferences(prefix).some((reference) => target.test(reference)) &&
      !requires(namedReferences, load, target);
  };
  expect(accepts(text)).toBe(true);
  expect(accepts(text.replace(/quiet check/gi, ''))).toBe(false);
  expect(accepts(`Enter through installed axstack-review. ${text}`)).toBe(false);
  const directive = text.match(/\b(?:run|perform) (?:the|a) quiet check[^.]*\./i)[0];
  expect(accepts(text.replace(directive, '') + directive)).toBe(false);
  expect(accepts(text.replace(/Run the quiet check/i, 'Perform a quiet check'))).toBe(true);
  const movedEntry = 'Enter through installed `axstack-review`, which loads `../axstack/references/automations.md` relatively.';
  for (const probe of [
    'Follow [Provider bindings](t3-runtime.md#preflight-and-binding) for provider binding.',
    'Read [T3 runtime](t3-runtime.md) and invoke `axstack-review`.',
    movedEntry,
    'Read:\n\n- [Runtime](t3-runtime.md)',
    'Consult skills/axstack-review/SKILL.md first.',
    'Open `t3-runtime.md` for the binding rules.',
  ]) expect(accepts(`${probe}\n\n${text}`), probe).toBe(false);
  for (const verb of ['Load', 'Read', 'Follow', 'Enter', 'Invoke', 'Consult', 'Open', 'Inspect', 'Study', 'Review']) {
    for (const path of ['skills/axstack-review/SKILL.md', 'axstack-review', 'automations.md', 't3-runtime.md']) {
      expect(accepts(`${verb} \`${path}\`.\n\n${text}`), `${verb} ${path}`).toBe(false);
      expect(accepts(`${verb} [reference](${path}).\n\n${text}`), `${verb} linked ${path}`).toBe(false);
    }
  }
  expect(accepts(`Never read skills/axstack-review/SKILL.md before the gate.\n\n${text}`)).toBe(true);
});

test('automations routes the quiet check to its packaged owner', () => {
  const text = read('skills/axstack/references/automations.md');
  const concepts = [/follow/i, /quiet check/i, /packaged review-manager prompt/i];
  checkRule(sentences(text).join('. '), (source) => requires(source, ...concepts),
    'Follow the packaged review-manager prompt for its quiet check.',
    [[/follow/i, 'ignore']], concepts);
  expect(loadedReferences(text)).toContain('review-manager-prompt.md');
});

test('quiet exit is silent and leaves skills, sweep and continuity untouched', () => {
  const text = compact('skills/axstack/references/review-manager-prompt.md');
  const restrictions = [/no text|without text/i,
    /no skill load|without skill loading/i, /no sweep|without a sweep/i,
    /no (?:other )?continuity write|without continuity writes/i];
  const concepts = [/no term fails or is unknown/i, /end the turn/i, ...restrictions];
  const accepts = (source) => sentences(source).some((sentence) =>
    concepts.every((concept) => concept.test(sentence)) &&
    requires([...restrictions, /no term fails or is unknown/i].reduce((value, rule) => value.replace(rule, ''), sentence), /^/));
  checkRule(text, accepts,
    'When no term fails or is unknown, end the turn without text, without skill loading, without a sweep and without continuity writes.',
    [[/no term fails or is unknown/i, 'any term fails'],
      ...restrictions.map((rule) => [rule, 'perform the action'])], concepts);
});

test('full passes record quiet watermarks in durable continuity', () => {
  for (const path of ['review-manager-prompt.md', 'automations.md']) {
    const text = compact(`skills/axstack/references/${path}`);
    const concepts = [/full pass (?:records?|saves?)/i, /Watermarks/i,
      /Quiet gate:/i, /\bsorted list/i, /Last full pass:/i, /UTC/i,
      /only as owner-of-record/i, /reads? back the save/i];
    checkRule(text, (source) => requires(source, ...concepts),
      'The full pass records Watermarks: Quiet gate: as the sorted list and Last full pass: as UTC only as owner-of-record, then reads back the save.',
      [[/records?|saves?/i, 'ignores'], [/\bsorted\b/i, 'unsorted'],
        [/only as owner-of-record/i, 'as any pass'], [/reads? back the save/i, 'ignores the save']], concepts);
  }
  const template = read('skills/axstack/references/run-record.md')
    .split('## Review-manager continuity template')[1].split('## Compact template')[0];
  expect(template).toMatch(/## Watermarks[\s\S]*Quiet gate:[^\n]*\bsorted\b[^\n]*headRefOid[^\n]*updatedAt/i);
  expect(template).toMatch(/## Watermarks[\s\S]*Last full pass:[^\n]*UTC/i);
});

test('documented review-manager schedules run every 30 minutes', () => {
  for (const path of ['skills/axstack/references/automations.md',
    'skills/axstack/references/lifecycle.md', 'docs/host-operations.md', 'README.md']) {
    const text = compact(path);
    expect(text, path).not.toMatch(/15-minute|every 15 minutes|everyMs:900000/i);
    expect(text, path).toMatch(/30-minute|every 30 minutes/i);
    expect(text, path).toContain('everyMs:1800000');
  }
});

const decisions = [
  ['collect complete native active set', [/save/i, /t3_thread_list/i, /includeSubagents:true/i, /statuses:/i, /preparing\/queued\/starting\/running\/waiting/i],
    'Save t3_thread_list with includeSubagents:true and statuses: preparing/queued/starting/running/waiting.',
    [[/preparing\/queued\/starting\/running\/waiting/i, 'running']]],
  ['full pass records verified outsiders', [/full passes/i, /record proven/i, /Non-lane roots/i, /omitted idle parents/i],
    'For omitted idle parents, full passes record proven Non-lane roots.', [[/record proven/i, 'invent']]],
  ['full pass resolves heads', [/resolve heads|obtain head OIDs/i, /gh pr view/i, /--json headRefOid/i, /in the full pass|during full reconciliation/i],
    'During full reconciliation, obtain head OIDs using gh pr view --repo REPO NUMBER --json headRefOid.',
    [[/resolve heads|obtain head OIDs/i, 'skip resolving heads']]],
  ['fail or unknown requires full', [/any fail or unknown|any (?:fact|term) fails? or is unknown/i, /runs? the full pass|execute the full pass/i],
    'If any fact fails or is unknown, execute the full pass.', [[/runs? the full pass|execute the full pass/i, 'permits quiet exit']]],
  ['unknown discovery requires reconciliation', [/unknown discovery|discovery (?:is|remains) unknown/i, /means full reconciliation|requires full reconciliation/i],
    'When discovery is unknown, it requires full reconciliation.', [[/full reconciliation/i, 'quiet exit']]],
  ['unknown owner or prior forbids admission', [/unknown ownership or prior identity|ownership or prior identity (?:is|remains) unknown/i, /forbids competing admission|competing admission is forbidden/i],
    'If ownership or prior identity is unknown, competing admission is forbidden.', [[/forbids competing admission|competing admission is forbidden/i, 'permits competing admission']]],
  ['helper is first decision', [/after collection/i, /first decision step/i, /installed helper/i, /bun[^`]*schedule-drift\.js> quiet-facts --input/i],
    'After collection, use the installed helper as the first decision step: `bun --no-env-file <resolved-schedule-drift.js> quiet-facts --input FILE`.', [[/first decision step/i, 'optional later step']]],
  ['prior read precedes replacement', [/t3_thread_read/i, /prior pass/i, /once/i, /before replacing prior identity/i],
    'Before replacing prior identity, read the prior pass once using t3_thread_read.', [[/before replacing/i, 'after replacing']]],
];
test('quiet lane identity excludes shared-project membership', () => {
  const concepts = [/lane scope/i, /recorded pass\/job identities/i, /descendants/i];
  const exclusion = /not the shared project/i;
  checkRule(compact('skills/axstack/references/review-manager-prompt.md'),
    source => sentences(source).some(s => exclusion.test(s) && requires(s.replace(exclusion, ''), ...concepts)),
    'Lane scope follows recorded pass/job identities and descendants, not the shared project.',
    [[exclusion, 'the entire shared project']], [...concepts, exclusion]);
});
for (const [name, concepts, rewording, inversions] of decisions) {
  test(`quiet decision: ${name}`, () => {
    checkRule(compact('skills/axstack/references/review-manager-prompt.md'),
      source => requires(source.replace(/--no-env-file/g, ''), ...concepts), rewording, inversions, concepts);
  });
}
test('quiet facts grant nothing and guarded/user-only state alone never forces reconciliation', () => {
  const source = compact('skills/axstack/references/review-manager-prompt.md');
  const facts = /grant nothing|grant no authority/i;
  checkRule(source, text => sentences(text).some(s => facts.test(s) && requires(s.replace(facts, ''), /facts/i)),
    'These facts grant no authority.', [[facts, 'grant admission authority']], [/facts/i, facts]);
  const rule = /never (?:force|require) a full pass or failure report/i;
  const concepts = [/guarded prior passes/i, /user-only holds/i, /by themselves|alone/i];
  checkRule(source, text => sentences(text).some(s => rule.test(s) && requires(s.replace(rule, ''), ...concepts)),
    'Alone, user-only holds and guarded prior passes never require a full pass or failure report.',
    [[rule, 'always force full reconciliation']], [...concepts, rule]);
});

for (const [name, concepts, rewording, inversions] of [
  ['user decision updates PR timestamp', [/user decision/i, /changes updatedAt/i],
    'On the PR, a user decision changes updatedAt.', [[/changes updatedAt/i, 'preserves updatedAt']]],
  ['four-hour reconciliation covers flagged replies', [/4 h full pass/i, /reconciles replies/i, /flagged threads/i],
    'Replies in flagged threads are covered when the 4 h full pass reconciles replies.', [[/reconciles replies/i, 'ignores replies']]],
]) test(`quiet rationale: ${name}`, () => {
  checkRule(compact('skills/axstack/references/review-manager-prompt.md'), text => requires(text, ...concepts), rewording, inversions, concepts);
});
test('quiet collection retains both executable gh search commands and their exact safety flags', () => {
  const valid = source => {
    const commands = source.match(/gh search prs[^`\n]+/g) ?? [];
    return commands.length === 2 && commands.some(c => /--review-requested[= ]@me/.test(c)) && commands.some(c => /--involves[= ]@me/.test(c)) &&
      commands.every(c => /--limit 1000/.test(c) && /--state open/.test(c) && /--draft=false/.test(c) &&
        ['number', 'repository', 'updatedAt', 'isDraft', 'author'].every(field => c.match(/--json ([\w,]+)/)?.[1].split(',').includes(field)));
  };
  const source = read('skills/axstack/references/review-manager-prompt.md');
  expect(valid(source)).toBe(true);
  expect(valid(source.replace(/--limit 1000/g, ''))).toBe(false);
  expect(valid(source.replace(/--limit 1000/g, '--limit 30'))).toBe(false);
  expect(valid(source.replace(/gh search prs/g, 'gh search prs --sort updated'))).toBe(true);
});

test('the one prior read precedes the actual helper invocation and full workflow', () => {
  const source = read('skills/axstack/references/review-manager-prompt.md');
  const accepts = text => {
    const prior = text.indexOf('t3_thread_read'), helper = text.indexOf('bun --no-env-file <resolved-schedule-drift.js> quiet-facts');
    return prior >= 0 && helper > prior && helper < text.indexOf('## Full pass');
  };
  expect(accepts(source)).toBe(true);
  expect(accepts(source.replace(/t3_thread_read/g, ''))).toBe(false);
  const directive = source.split('\n').find(line => line.includes('t3_thread_read'));
  expect(accepts(source.replace(directive, '') + '\n' + directive)).toBe(false);
  expect(accepts(source.replace('Read the recorded prior pass once with', 'Consult the prior pass once through'))).toBe(true);
});
