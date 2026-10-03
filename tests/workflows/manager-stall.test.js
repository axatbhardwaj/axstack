import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

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
  expect(text).toMatch(/second ask holds/i);
  expect(text).toMatch(/duplicate[^.]*stalled owner[^.]*five minutes[^.]*one deduplicated notification/i);
  expect(text).toMatch(/started coordinator[^.]*waiting on its reviewers[^.]*live reviewer task or running wait[^.]*not idle[^.]*never stopped/i);
});

// The bounded stall actions are deliberate exact-text safety contracts.
for (const sentence of [
  'Steer an idle PR job once with `t3_thread_send`.',
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
