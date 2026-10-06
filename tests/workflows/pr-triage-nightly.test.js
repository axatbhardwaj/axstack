import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
// Absent guidance means absent policy, not a missing-module/setup failure.
const setup = sentences(read('skills/axstack/references/automations.md')).join('. ');
const prompt = sentences(read('skills/axstack/references/pr-triage-nightly.md')).join('. ');
const directive = (concepts) => (text) => requires(text, ...concepts);
const forbidden = (concepts) => (text) =>
  sentences(text).some((sentence) => !/\b(?:unless|except)\b/i.test(sentence)
    && prohibits(sentence, /\b(?:never|do not)\b/i, ...concepts))
  && !requires(text, ...concepts);

// Each rule protects a triage contract missing from weekly-audit coverage.
// Probes replace actual source in memory; tests never write tracked files.
const rules = [
  ['read-only pass', prompt, directive,
    [/\b(?:read-only|observation-only)\b/i, /\b(?:nightly|triage)\b/i, /\bpass\b/i],
    'Run this nightly triage pass in observation-only mode.',
    [[/\b(?:read-only|observation-only)\b/gi, 'writes and merges']]],
  ['one unbound nightly native schedule', setup, directive,
    [/\b(?:one|single)\b/i, /\bnative\b/i, /\bT3\b/, /schedule_task/,
      /\bunbound\b/i, /\bnightly\b/i, /\b02:00\b/, /\bhost time\b/i,
      /fixed_time/, /bindToCurrentThread:false/],
    'Use a single native T3 schedule_task, unbound, nightly at 02:00 host time, with fixed_time and bindToCurrentThread:false.',
    [[/\bnightly\b/gi, 'weekly'], [/\b02:00\b/g, '03:00'], [/bindToCurrentThread:false/g, 'bindToCurrentThread:true']]],
  ['durable activation fields outside run records', setup, directive,
    [/\b(?:record|save)\b/i, /\bhost timezone\b/i, /\bschedule ID\b/i, /\bprompt\b/i,
      /\brepository set\b/i, /\bdurable\b/i, /\boutside\b/i, /\b(?:any|all) run records\b/i],
    'Save the host timezone, schedule ID, prompt, and repository set in a durable activation record outside all run records.',
    [[/\boutside\b/gi, 'inside']]],
  ['inventory before schedule creation', setup, directive,
    [/\bbefore\b/i, /\bcreat\w*\b/i, /\bschedule\b/i, /\bread\b/i, /\bexisting schedules\b/i, /list_scheduled_tasks/],
    'Before creating a schedule, read existing schedules with list_scheduled_tasks.',
    [[/\bbefore\b/gi, 'after']]],
  ['duplicate schedules forbidden', setup, forbidden,
    [/\bcreat\w*\b/i, /\bduplicate\b/i, /\btriage schedule\b/i],
    'Do not create a duplicate triage schedule.',
    [[/\b(?:never|do not)\b/gi, 'Always']]],
  ['activation survives Close-out', setup, directive,
    [/\b(?:preserve|retain)\b/i, /\bactivation record\b/i, /\bschedule\b/i, /\b(?:through|during) Close-out\b/i],
    'Retain the activation record and schedule during Close-out.',
    [[/\b(?:preserve|retain)\b/gi, 'Delete']]],
  ['recorded repository scope', prompt, directive,
    [/\bread\b/i, /\bdurable activation record\b/i, /\brepository set\b/i],
    'Read the durable activation record for the repository set.',
    [[/\bread\b/gi, 'Ignore']]],
  ['user identity from forge', prompt, directive,
    [/\b(?:resolve|derive)\b/i, /\buser\b/i, /gh api user/, /--jq \.login/],
    'Derive the user with gh api user --jq .login.',
    [[/\b(?:resolve|derive)\b/gi, 'Guess']]],
  ['all own open PRs across the set', prompt, directive,
    [/\bread\b/i, /\ball open PRs\b/i, /\b(?:authored|written) by\b/i, /\buser\b/i,
      /\b(?:every|each)\b/i, /\brepository\b/i, /\brecorded set\b/i, /\b(?:all|every) pages?\b/i],
    'Read all open PRs written by the user in each repository in the recorded set across every page.',
    [[/\ball open PRs\b/gi, 'selected open PRs'], [/\b(?:authored|written) by\b/gi, 'assigned to']]],
  ['forge fields reported per PR in own thread', prompt, directive,
    [/\breport\b/i, /\b(?:each|every) PR\b/i, /\bCI\b/, /\breviews\b/i,
      /\bmergeable\b/i, /\bunresolved threads\b/i, /\bown T3 thread\b/i],
    'Report each PR with CI, reviews, mergeable state, and unresolved threads in your own T3 thread.',
    [[/\bown T3 thread\b/gi, 'driver thread']]],
  ['unavailable forge state stays unknown', prompt, directive,
    [/\b(?:unavailable|failed|incomplete)\b/i, /\bforge\b/i, /\b(?:state|field)\b/i, /\breport\b/i, /UNKNOWN/],
    'For an unavailable forge field, report UNKNOWN.',
    [[/UNKNOWN/g, 'green']]],
  ['stale threshold', prompt, directive,
    [/\b(?:flag|mark|report)\b/i, /\bstale\b/i, /\bPRs?\b/i, /\b(?:no activity|inactivity)\b/i, /\b7 days\b/i],
    'Mark PRs stale after 7 days of inactivity.',
    [[/\b7 days\b/g, '1 day'], [/\b7 days\b/g, '30 days']]],
  ['top three actions', prompt, directive,
    [/\breport\b/i, /\btop (?:three|3)\b/i, /\b(?:act on|action)\b/i],
    'Report the top 3 PRs to act on.',
    [[/\btop (?:three|3)\b/gi, 'bottom three']]],
  ['no readiness declaration', prompt, forbidden,
    [/\bdeclar(?:e|es)\b/i, /\bPR\b/, /\bmerge-ready\b/i],
    'Do not declare a PR merge-ready.',
    [[/\b(?:never|do not) declare\b/gi, 'Declares']]],
];

for (const action of ['merge', 'post comments', 'change labels', 'push', 'send relay messages', 'dispatch work', 'launch threads']) {
  rules.push([`read-only: ${action}`, prompt, forbidden, [new RegExp(`\\b${action}\\b`, 'i')],
    `Do not ${action}.`, [[/\b(?:never|do not)\b/gi, 'Always']]]);
}

// Bind qualifiers to their action; a detached mention cannot satisfy the rule.
const boundaryConcepts = {
  'all own open PRs across the set': [/\b(?:authored|written) by (?:the )?user\b/i],
  'stale threshold': [/\bafter 7 days of inactivity\b/i],
};
const contradictions = {
  'read-only pass': /\b(?:write-enabled|writes and merges)\b/i,
  'all own open PRs across the set': /\b(?:anyone|other authors|all authors)\b/i,
  'one unbound nightly native schedule': /\bbindToCurrentThread\s*:\s*true\b/i,
};
const requiredConcepts = ([name, , , concepts]) => [...concepts, ...(boundaryConcepts[name] ?? [])];
const accepts = (row) => (text) => {
  const [name, , checker] = row;
  const concepts = requiredConcepts(row);
  return checker(concepts)(text) && sentences(text).some((sentence) =>
    !contradictions[name]?.test(sentence) && checker(concepts)(sentence));
};

for (const row of rules) {
  const [name, source, , , rewording, inversions] = row;
  test(`nightly triage ${name}: real-source removal, inversion, rewording`, () => {
    checkRule(source, accepts(row), rewording, inversions, requiredConcepts(row));
  });
}

test('nightly prompt and workflow setup link to the packaged operational guidance', () => {
  expect(read('skills/axstack/references/pr-triage-nightly.md')).toContain('](automations.md#nightly-pr-triage-setup)');
  expect(read('skills/axstack/references/automations.md')).toContain('](pr-triage-nightly.md)');
  expect(read('docs/workflows.md')).toContain('](../skills/axstack/references/pr-triage-nightly.md)');
  expect(read('docs/workflows.md')).toContain('](../skills/axstack/references/automations.md#nightly-pr-triage-setup)');
});

const mutations = [
  ['writes and merges', /\bmerge(?:s|d|ing)?\b/i],
  ['posts comments', /\bpost\w*\b.*\bcomments\b/i],
  ['changes labels', /\bchang\w*\b.*\blabels\b/i],
  ['pushes', /\bpush\w*\b/i],
  ['sends relay messages', /\bsend\w*\b.*\brelay messages\b/i],
  ['dispatches work', /\bdispatch\w*\b.*\bwork\b/i],
  ['launches threads', /\blaunch\w*\b.*\bthreads\b/i],
  ['declares a PR merge-ready', /\bdeclar\w*\b.*\bPR\b.*\bmerge-ready\b/i],
];
for (const [affirmative, concept] of mutations) {
  test(`nightly triage rejects affirmative permission: this pass ${affirmative}`, () => {
    const mutated = `${prompt}. This pass ${affirmative}.`;
    expect(forbidden([concept])(prompt)).toBe(true);
    expect(forbidden([concept])(mutated), affirmative).toBe(false);
  });
}

const qualifierReversals = [
  ['read-only pass', 'Run this nightly triage pass in write-enabled mode instead of read-only mode.'],
  ['no readiness declaration', 'Never declare a PR merge-ready except when CI passes.'],
  ['all own open PRs across the set', 'Read all open PRs authored by anyone, including the user, in every repository in the recorded set, including all pages.'],
  ['stale threshold', 'Flag stale PRs after 1 day of inactivity instead of 7 days.'],
  ['one unbound nightly native schedule', 'Use one native T3 schedule_task, unbound, nightly at 02:00 host time, with fixed_time and bindToCurrentThread:true instead of bindToCurrentThread:false.'],
  ['read-only: send relay messages', 'Never merge, post comments, change labels, push, send relay messages, dispatch work, or launch threads except for relay summaries.'],
];
for (const [name, opposite] of qualifierReversals) {
  test(`nightly triage owning rule rejects qualifier reversal: ${name} -> ${opposite}`, () => {
    const row = rules.find(([ruleName]) => ruleName === name);
    checkRule(row[1], accepts(row), row[4], [[/^.*$/, opposite]]);
  });
}
