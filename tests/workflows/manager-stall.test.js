import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const compact = (path) =>
  readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');

// Source-contract regression checks for the 2026-09-28 lane stall, not live-runtime proof.
test('duplicate pass still runs read-only discovery into its own note', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/duplicate[^.]*read-only discovery[^.]*own (pass )?note/i);
  expect(text).toMatch(/duplicate[^.]*admits nothing/i);
});

test('dispatching owner confirms its own brief once when a worker asks', () => {
  const text = compact('skills/axstack/references/t3-runtime.md');
  expect(text).toMatch(/dispatching owner[^.]*confirm[^.]*worker's own brief question once/i);
  expect(text).toMatch(/Never answer trust or permission prompts/i);
});

test('an idle PR job holds incomplete and a stalled owner notifies once', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/idle final turn[^.]*valid completion receipt[^.]*incomplete/i);
  expect(text).toMatch(/second brief ask follows the five-minute stop rule/i);
  expect(text).toMatch(/duplicate[^.]*stalled owner[^.]*five minutes[^.]*one deduplicated notification/i);
  expect(text).toMatch(/started coordinator[^.]*waiting on its reviewers[^.]*live reviewer task or running wait[^.]*not idle[^.]*never stopped/i);
});

// The bounded stall actions are deliberate exact-text safety contracts.
for (const sentence of [
  'Steer an idle PR job once with `t3_thread_send`.',
  'A second brief ask follows the five-minute stop rule, never an open-ended hold.',
  'If it is still idle without a valid completion receipt five minutes after the steer, stop the owned job with `t3_thread_interrupt` or `task_cancel` as applicable, reconcile the coordinator and every descendant, and record the event unserved and re-admissible.',
  'Uncertain liveness retains the slot only within that five-minute bound; unverified settlement after the stop holds lane admission.',
]) {
  test(`bounded idle PR job safety: ${sentence}`, () => {
    const accepts = (text) => text.replace(/\s+/g, ' ').includes(sentence);
    const text = compact('skills/axstack/references/automations.md');
    expect(accepts(text)).toBe(true);
    expect(accepts(text.replace(sentence, ''))).toBe(false);
    expect(accepts(text.replace(sentence, sentence.replace(/Steer|stop|only/, 'inverted')))).toBe(false);
  });
}

// Recovery policy checks against real source; no tracked-file mutation or live-runtime claim.
const recoveryRules = [
  ['verified wedge', [/wedged owner/i, /non-terminal run/i, /more than 60 minutes/i,
    /verified inactivity/i, /its thread/i, /all its runs/i, /delegated tasks/i,
    /descendant threads/i, /free of `?user_takeover`?/i],
    'A wedged owner is free of user_takeover and has a non-terminal run with verified inactivity for more than 60 minutes across all its runs, its thread, delegated tasks and descendant threads.',
    [/more than 60 minutes/i, 'less than 60 minutes']],
  ['single ordered successor', [/exactly one successor/i, /recovers/i, /wedged owner/i,
    /earliest-started live pass after the wedge/i, /native run start ordering/i],
    'Using native run start ordering, exactly one successor, the earliest-started live pass after the wedge, recovers a wedged owner.',
    [/earliest-started/i, 'latest-started']],
  ['uncertain ordering holds', [/missing or tied ordering evidence/i, /holds/i,
    /admission/i, /recovery/i],
    'Missing or tied ordering evidence holds recovery and admission until selection is verifiable.',
    [/holds/i, 'permits']],
  ['interrupt before cancellation and takeover', [/successor/i,
    /first interrupts[\s\S]*t3_thread_interrupt[\s\S]*stable[\s\S]*clientRequestId/i,
    /then cancels stale delegated tasks[\s\S]*task_cancel/i,
    /reads back terminal state[\s\S]*owner and every descendant[\s\S]*before[\s\S]*takeover[\s\S]*continuity[\s\S]*becoming owner/i],
    'The successor first interrupts the wedged owner run via t3_thread_interrupt with a stable clientRequestId, then cancels stale delegated tasks via task_cancel and reads back terminal state for the owner and every descendant before documenting takeover in continuity and becoming owner.',
    [/before/i, 'after']],
  ['reconcile before admission', [/before any admission/i, /successor/i, /reconciles/i,
    /wedged owner/i, /in-flight jobs/i, /GitHub/i, /evidence/i],
    'The successor reconciles the wedged owner in-flight jobs against evidence and GitHub before any admission.',
    [/before any admission/i, 'after admission']],
  ['publication readback serves event', [/only a verdict/i, /already published and read back/i,
    /counts as served/i],
    'Only a verdict already published and read back counts as served for the recovered event.',
    [/published and read back/i, 'published without readback']],
  ['unserved recovery is eligible', [/otherwise/i, /event/i, /unserved/i,
    /INCOMPLETE/, /re-eligible/i],
    'Otherwise classify the event as INCOMPLETE and unserved, keeping it re-eligible.',
    [/re-eligible/i, 'ineligible']],
  ['failed recovery holds and notifies once', [/failed interrupt/i, /unverified terminal state/i,
    /keeps/i, /existing hold/i, /one deduplicated notification/i],
    'A failed interrupt or unverified terminal state keeps the existing hold and sends one deduplicated notification under the recorded Notification policy.',
    [/keeps/i, 'releases']],
  ['other unknown liveness holds', [/outside[\s\S]*wedged-owner recovery/i,
    /unknown liveness/i, /blocks/i, /admission/i, /shared-record writes/i,
    /takeover/i, /cleanup/i, /recent/i],
    'Outside verified wedged-owner recovery, unknown liveness blocks takeover, cleanup, shared-record writes and admission, including recent activity.',
    [/blocks/i, 'permits']],
];

for (const [name, concepts, rewording, [direction, inversion]] of recoveryRules) {
  test(`wedged manager recovery: ${name}`, () => {
    const text = compact('skills/axstack/references/automations.md');
    const accepts = (source) => requires(source, ...concepts);
    expect(accepts(text)).toBe(true);
    const targets = sentences(text).filter(accepts);
    expect(targets.length).toBeGreaterThan(0);
    const substitute = (replacement) => targets.reduce((source, target) =>
      source.replace(target, replacement(target)), text);
    expect(accepts(substitute(() => ''))).toBe(false);
    for (const concept of concepts) {
      expect(accepts(substitute((target) => target.replace(concept, '')))).toBe(false);
    }
    expect(accepts(substitute((target) => target.replace(direction, inversion)))).toBe(false);
    expect(accepts(substitute(() => rewording))).toBe(true);
    expect(accepts(substitute(() => rewording.replace(direction, inversion)))).toBe(false);
  });
}
