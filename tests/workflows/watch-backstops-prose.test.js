import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(new URL('../../skills/' + path, import.meta.url), 'utf8').replaceAll('`', '');
const owner = read('axstack-watch/references/workflow-backstops.md');
const watch = read('axstack-watch/references/watch-runtime.md');
const runtime = read('axstack/references/t3-runtime.md');
const autopilot = read('axstack/references/autopilot.md');

function rule(name, text, concepts, rewording, ...inversions) {
  test(`owner backstop instructions: ${name}`, () => {
    checkRule(text, (value) => requires(value, ...concepts), rewording, inversions, concepts);
  });
}

rule('the owner publishes all three terminal states', owner,
  [/publish|record|write/i, /owner|watch/i, /\bparked\b/i, /\buser-stopped\b/i, /\bcomplete\b/i],
  'The owner records parked, user-stopped or complete when the corresponding stop condition is met.',
  [/publish|records?/i, 'must not record'], [/user-stopped/i, 'active']);

rule('the watch and autopilot use the hourly interval', owner,
  [/\bwatch\b/i, /autopilot/i, /60[- ]minutes?|hourly/i, /recur|repeat|run/i],
  'Watch and autopilot timers run hourly.',
  [/60[- ]minutes?|hourly/i, '5 minutes']);

rule('writers, follow-ups and recovery use the five-minute interval', owner,
  [/\bwriter\b/i, /follow-ups?/i, /recovery/i, /5[- ]minutes?/i, /recur|repeat|run/i],
  'Writer timers cover launched writers and follow-ups, and run alongside recovery every 5 minutes.',
  [/5[- ]minutes?/i, '60 minutes']);

test('owner backstop instructions: wakes cannot clear holds', () => {
  const prohibition = /never clears?|cannot clear|must not clear/i;
  const concepts = [/wakes?/i, /holds?/i];
  checkRule(owner, (value) => prohibits(value, prohibition, ...concepts),
    'An owner wake cannot clear an existing hold.',
    [[prohibition, 'clears']], concepts);
});

const localOptIn = /local (?:MIG-5 )?opt[- ]in|locally opted[- ]in/i;
const defaultTimer = /by default|as the (?:standard|default) (?:timer|backstop)/i;
const start = /(?:start|run|use)s? (?:the )?(?:axstack-watch-backstops@1|owner backstop workflow)/i;
for (const [entry, text] of Object.entries({ owner, watch, runtime, autopilot })) {
  rule(`${entry} defaults to the workflow on locally opted-in hosts`, text,
    [localOptIn, defaultTimer, start],
    'On locally opted-in hosts, run the owner backstop workflow as the standard timer.',
    [start, 'start native timers'], [localOptIn, 'absent opt-in'], [defaultTimer, 'as a last resort']);
}

const useNative = /(?:use|retain|restore|return to|re-enable) (?:the )?native timers?/i;
rule('iobook and hosts without opt-in use native timers', owner,
  [useNative, /iobook/i, /without (?:a )?(?:local )?opt[- ]in|lacking (?:a )?(?:local )?opt[- ]in/i],
  'For iobook and hosts lacking a local opt-in, retain native timers.',
  [useNative, 'start the workflow'], [/without|lacking/i, 'with']);

rule('rollback and workflow recovery failure use native timers', owner,
  [useNative, /roll[- ]?back/i, /workflow recovery fails|failed workflow recovery/i],
  'After failed workflow recovery or during rollback, return to native timers.',
  [useNative, 'leave native timers disabled'], [/workflow recovery fails|failed workflow recovery/i, 'successful workflow recovery']);

rule('the driver routes workflow timers through the schedule digest path', watch,
  [/treat|classify|handle/i, /workflow timer wakes?/i, /schedule wakes?/i, /\bdigest\b/i],
  'For digest purposes, classify each workflow timer wake as a schedule wake.',
  [/schedule wakes?/i, 'native PR wakes']);

const activeCause = /active (?:timer )?causes?\b|causes? (?:is|remains) (?:still )?active\b/i;

rule('the owner checks the run before ending a turn with active timers', owner,
  [/turn ends?|ending (?:a|each) turn/i, activeCause, /read|check/i, /t3 workflow show/i],
  'Whenever an owner turn ends while a timer cause is still active, check the recorded run with t3 workflow show <runId> --json.',
  [/\bread\b|\bcheck\b/i, 'never check'], [/\bactive\b/i, 'inactive']);

test('owner backstop instructions: paused runs resume after the cause is resolved', () => {
  const concepts = [/paus(?:ed|e)/i, /\b(?:resolv(?:e|ing)|resolved)\b/i, /\bcause\b/i,
    /t3 workflow resume/i, /read back|verify/i, /\bstate\b/i];
  const before = /\bresolve (?:the )?(?:recorded )?cause\b.*\bt3 workflow resume\b/i;
  const after = /\bt3 workflow resume\b.*\bafter resolving (?:the )?(?:recorded )?cause\b/i;
  const withoutResolution = /\bwithout (?:first )?resolving\b/i;
  const accepts = (text) => sentences(text).some((sentence) => requires(sentence, ...concepts) &&
    !withoutResolution.test(sentence) && (before.test(sentence) || after.test(sentence)));
  checkRule(owner, accepts,
    'For a paused run, use t3 workflow resume only after resolving the cause and verify the state.',
    [[/\b(?:only )?(?:after )?resolv(?:e|ing)\b/i, 'without resolving']], concepts);
});

rule('a terminal run with an active cause re-arms from the last slot', owner,
  [/terminal (?:workflow )?run|run is terminal/i, activeCause, /reconcile/i, /(?:last|prior|previous) slot/i,
    /re[- ]?arm|restart/i, /(?:fresh|new) (?:run )?key/i, /next due times|next deadlines/i],
  'When a workflow run is terminal and a timer cause remains active, reconcile the previous slot and restart using a new key and the next deadlines.',
  [/\bactive\b/i, 'inactive'], [/\b(?:fresh|new)\b/i, 'previous']);

rule('failed recovery records a hold and rolls back to the native timer', owner,
  [/recovery fails?|failed recovery|recovery is unsuccessful/i, /\bhold\b/i, /\brollback\b/i,
    /restore|re[- ]?enable/i, /native timers?/i],
  'When recovery is unsuccessful, record a hold and use rollback to re-enable the native timer.',
  [/\b(?:fails?|is unsuccessful)\b/i, 'succeeds'], [/restore|re[- ]?enable/i, 'leave disabled']);

rule('the owner counts repeated briefs for the same run and slot as one delivery', owner,
  [/treat|count|acknowledge/i, /(?:same|matching) run and slot IDs/i, /(?:one|single) delivery/i],
  'Count briefs with matching run and slot IDs as a single delivery.',
  [/\b(?:one|a single)\b/i, 'a separate']);
