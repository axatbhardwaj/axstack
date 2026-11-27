import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(new URL('../../skills/' + path, import.meta.url), 'utf8').replaceAll('`', '');
const owner = read('axstack-watch/references/workflow-backstops.md');
const watch = read('axstack-watch/references/watch-runtime.md');
const runtime = read('axstack/references/t3-runtime.md');

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

rule('the workflow takes over the writer cadence after verified cutover', runtime,
  [/(?:after|following) verified cutover/i, /owner backstop workflow/i, /5[- ]minute/i, /\bwriter\b/i],
  'Following verified cutover, the owner backstop workflow supplies the 5-minute cadence for a launched writer.',
  [/after|following/i, 'before'], [/5[- ]minute/i, '60-minute']);

rule('the driver routes workflow timers through the schedule digest path', watch,
  [/treat|classify|handle/i, /workflow timer wakes?/i, /schedule wakes?/i, /\bdigest\b/i],
  'For digest purposes, classify each workflow timer wake as a schedule wake.',
  [/schedule wakes?/i, 'native PR wakes']);

rule('the owner checks the run before ending a turn with active timers', owner,
  [/turn end|ending (?:a|each) turn/i, /active (?:timer )?causes?/i, /read|check/i, /t3 workflow show/i],
  'Before ending each turn with an active timer cause, check the recorded run with t3 workflow show.',
  [/read|check/i, 'never check']);

rule('paused runs resume after the cause is resolved', owner,
  [/paus(?:ed|e)/i, /resolv(?:e|ing)/i, /\bcause\b/i, /t3 workflow resume/i],
  'If the workflow paused, use t3 workflow resume after resolving the cause.',
  [/resolv(?:e|ing)/i, 'ignoring']);
