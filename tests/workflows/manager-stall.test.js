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
  const text = compact('skills/axstack/references/orca-runtime.md');
  expect(text).toMatch(/worker asks[^.]*confirm[^.]*brief[^.]*dispatching owner[^.]*once/i);
  expect(text).toMatch(/confirmation[^.]*never[^.]*trust or permission prompt/i);
});

test('an idle PR coordinator is bounded, not awaited indefinitely', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toMatch(/idle[^.]*coordinator[^.]*nudge[^.]*once/i);
  expect(text).toMatch(/still idle[^.]*worker-stop[^.]*unserved/i);
  expect(text).toMatch(/duplicate[^.]*stalled owner[^.]*notif/i);
});
