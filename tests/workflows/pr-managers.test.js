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
  ['changed PR list is busy',
    [/run.*full pass/i, /when/i, /\bsorted list/i, /differs|different/i, /Quiet gate:/i],
    'When the sorted list is different from Quiet gate:, run the full pass.',
    [[/differs|different/i, 'equal']]],
  ['non-terminal lane thread is busy',
    [/run.*full pass/i, /when/i, /other lane thread/i, /non-terminal/i],
    'When any other lane thread is non-terminal, run the full pass.',
    [[/non-terminal/i, 'terminal']]],
  ['unreadable continuity is busy',
    [/run.*full pass/i, /when/i, /continuity/i, /watermark/i, /missing/i, /malformed/i, /unreadable/i],
    'When continuity or a watermark is missing, malformed or unreadable, run the full pass.',
    [[/unreadable/i, 'readable'], [/missing/i, 'present'], [/malformed/i, 'valid']]],
  ['stale full pass is busy',
    [/run.*full pass/i, /when/i, /Last full pass:/i, /at least 4 hours old/i, /future/i],
    'When Last full pass: is at least 4 hours old or in the future, run the full pass.',
    [[/at least 4 hours old/i, 'less than 4 hours old']]],
  ['incomplete calls are busy',
    [/run.*full pass/i, /when/i, /call fails/i, /pagination/i, /head OIDs/i, /liveness/i, /incomplete/i, /unknown/i],
    'When a call fails or pagination, head OIDs or thread/run liveness is incomplete or unknown, run the full pass.',
    [[/call fails/i, 'call succeeds'], [/incomplete/i, 'complete'], [/unknown/i, 'known']]],
  ['recorded work and non-user holds are busy',
    [/run.*full pass/i, /when/i, /continuity records/i, /\bany\b/i,
      /unserved/i, /capacity-deferred/i, /INCOMPLETE/, /re-eligible/i,
      /or any open hold/i, /resume condition/i, /beyond a user decision|other than only the user/i],
    'When continuity records any unserved, capacity-deferred, INCOMPLETE or re-eligible event, or any open hold with a resume condition other than only the user, run the full pass.',
    [[/run.*full pass/i, 'end quietly'], [/\bany\b/gi, 'every'],
      [/or any open hold/i, 'and any open hold'],
      [/beyond a user decision|other than only the user/i, 'awaiting only the user']]],
  ['user-only holds remain quiet-eligible',
    [/holds awaiting only the user/i, /remain quiet-eligible/i,
      /updatedAt/i, /4 h full pass/i, /reconcil.*replies in flagged threads/i],
    'Holds awaiting only the user remain quiet-eligible because updatedAt changes with a PR decision and the 4 h full pass reconciles replies in flagged threads.',
    [[/only the user/i, 'also the user'], [/quiet-eligible/i, 'busy']]],
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

test('quiet discovery uses authenticated paginated PR and lane inventories', () => {
  const text = compact('skills/axstack/references/review-manager-prompt.md');
  const concepts = [/gh api user/i, /union/i, /two paginated.*gh search prs/i,
    /review-requested:@me/, /involves:@me/, /each with/i, /--limit 1000/,
    /open/i, /non-draft/i, /authored by someone else/i,
    /\bsorted\b/i, /repo#number/i, /headRefOid/i, /updatedAt/i];
  checkRule(text, (source) => requires(source, ...concepts),
    'Use gh api user to resolve self, then union two paginated gh search prs queries (review-requested:@me and involves:@me), each with --limit 1000, for open, non-draft PRs authored by someone else, producing sorted (repo#number, headRefOid, updatedAt) tuples.',
    [[/union/i, 'intersect'], [/each with/i, 'one with'], [/--limit 1000/, '--limit 30'],
      [/paginated/i, 'first-page'], [/authored by someone else/i, 'authored by self'],
      [/\bsorted\b/i, 'unsorted']], concepts);
  const lane = [/inventory/i, /every page/i, /T3/i, /lane/i, /thread/i, /run/i, /liveness/i];
  checkRule(text, (source) => requires(source, ...lane),
    'Inventory every page of T3 lane threads and their run liveness.',
    [[/every page/i, 'one page']], lane);
});

test('quiet search results at either limit are incomplete', () => {
  const cap = [/either query/i, /result count/i, /at or above 1000|1000 or more/i,
    /coverage/i, /\bincomplete\b/i];
  checkRule(compact('skills/axstack/references/review-manager-prompt.md'),
    (source) => requires(source, ...cap),
    'In either query, a result count of 1000 or more makes coverage incomplete.',
    [[/either query/i, 'both queries'], [/at or above 1000|1000 or more/i, 'below 1000'],
      [/\bincomplete\b/i, 'complete']], cap);
});

test('quiet exit is silent and leaves skills, sweep and continuity untouched', () => {
  const text = compact('skills/axstack/references/review-manager-prompt.md');
  const restrictions = [/no text|without text/i,
    /no skill load|without skill loading/i, /no sweep|without a sweep/i,
    /no continuity write|without continuity writes/i];
  const concepts = [/every busy condition is false/i, /end the turn/i, ...restrictions];
  const accepts = (source) => sentences(source).some((sentence) =>
    concepts.every((concept) => concept.test(sentence)) &&
    requires(restrictions.reduce((value, rule) => value.replace(rule, ''), sentence), /^/));
  checkRule(text, accepts,
    'When every busy condition is false, end the turn without text, without skill loading, without a sweep and without continuity writes.',
    [[/every busy condition is false/i, 'any busy condition is true'],
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

test('documented review-manager schedules are hourly', () => {
  for (const path of ['skills/axstack/references/automations.md',
    'skills/axstack/references/lifecycle.md', 'docs/host-operations.md', 'README.md']) {
    const text = compact(path);
    expect(text, path).not.toMatch(/15-minute|every 15 minutes|everyMs:900000/i);
    expect(text, path).toMatch(/hourly|every hour/i);
    expect(text, path).toContain('everyMs:3600000');
  }
});
