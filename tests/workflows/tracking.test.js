import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Fixture-shape checks validate evaluation inputs, not agent behavior.
test('tracking scenarios: thirteen before and after decisions have explicit boundaries', () => {
  const data = JSON.parse(read('tests/workflows/tracking-scenarios.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'missed-completion-notification',
    'reviewed-task-awaiting-advancement',
    'duplicate-event',
    'uncertain-heartbeat-create',
    'cli-listing-not-proof-of-absence',
    'restart-reconcile-existing-heartbeat',
    'stall-detection',
    'pause-stops-heartbeat',
    'completion-stops-heartbeat',
    'deadline-expiry-no-extension',
    'missing-timer-capability-gap',
    'idle-is-not-complete',
    'no-duplicate-writer',
  ]);
  for (const scenario of data.cases) {
    expect(scenario.input.before).toBeTruthy();
    expect(scenario.input.event).toBeTruthy();
    expect(scenario.expected.after).toBeTruthy();
    expect(scenario.expected.actions.length).toBeGreaterThan(0);
    expect(scenario.expected.forbidden.length).toBeGreaterThan(0);
  }
});

// These are prompt-policy structure checks only. Keyword presence does not
// prove that an agent will execute the tracking behavior.
test('tracking structure: implementation creates one native execution heartbeat', () => {
  const implement = compact('skills/axstack-implement/SKILL.md');
  expect(implement).toMatch(/one driver-owned[^.]*native Paseo heartbeat[^.]*active execution run/i);
  expect(implement).toMatch(/execution start[^.]*create_heartbeat|create_heartbeat[^.]*execution start/i);
  expect(implement).toContain('*/10 * * * *');
  expect(implement).toMatch(/10 minutes|ten minutes/i);
  expect(implement).toMatch(/handshake\s*=[^.]*first observed tick receipt[^.]*timestamp[^.]*lastRunAt/i);
  expect(implement).toMatch(/handshake:\s*pending[^.]*creation[^.]*fill[^.]*first tick[^.]*reconcil/i);
  expect(implement).toMatch(/compute[^.]*expiresIn[^.]*resume[^.]*recorded absolute deadline/i);
});

test('tracking structure: lifecycle reconciles events and heartbeat uncertainty', () => {
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  expect(lifecycle).toMatch(/every tick[^.]*every completion notification|every completion notification[^.]*every tick/i);
  for (const state of ['owners', 'authors', 'pending reviews', 'candidate revisions', 'acceptance evidence']) {
    expect(lifecycle).toContain(state);
  }
  expect(lifecycle).toMatch(/reconcile[^.]*existing heartbeat[^.]*before[^.]*creat/i);
  expect(lifecycle).toMatch(/ambiguous[^.]*creat[^.]*block[^.]*duplicate/i);
  expect(lifecycle).toMatch(/healthy unchanged ticks?[^.]*no user-facing update/i);
  expect(lifecycle).toMatch(/duplicate events?[^.]*deduplicat|deduplicat[^.]*duplicate events?/i);
});

test('tracking structure: native readback separates timer evidence classes', () => {
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  expect(lifecycle).toMatch(/native tool receipts?[^.]*readback|readback[^.]*native tool receipts?/i);
  expect(lifecycle).toMatch(/native schedule-list readback[^.]*daemon[^.]*schedule\/list[^.]*MCP[^.]*list_schedules[^.]*only if[^.]*heartbeats/i);
  expect(lifecycle).toMatch(/no accessible listing[^.]*shows? heartbeats[^.]*readback[^.]*unavailable/i);
  expect(lifecycle).toMatch(/keep[^.]*create_heartbeat[^.]*receipt[^.]*observed ticks[^.]*only liveness evidence/i);
  expect(lifecycle).toMatch(/never[^.]*conclude[^.]*absence/i);
  expect(lifecycle).toMatch(/schedule inspect\/ls[^.]*excludes? heartbeats/i);
  expect(lifecycle).toMatch(/empty CLI listing[^.]*not[^.]*evidence[^.]*heartbeat[^.]*absent/i);
  expect(lifecycle).toMatch(/existence[^.]*tick[^.]*delivery[^.]*advancement/i);
  expect(lifecycle).toMatch(/lastRunAt[^.]*timer fired[^.]*not[^.]*prompt[^.]*delivered[^.]*work[^.]*advanced/i);
  expect(lifecycle).toMatch(/advancement evidence[^.]*run-record transition[^.]*SHAs[^.]*receipts/i);
});

test('tracking structure: timer receipt and stop boundaries are durable', () => {
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  const record = compact('skills/axstack/references/run-record.md');
  expect(record).toMatch(/Pending:[^.]*timer[^.]*actual ID[^.]*handshake[^.]*deadline/i);
  expect(lifecycle).toMatch(/stop[^.]*heartbeat[^.]*pause[^.]*completion[^.]*24-hour|stop[^.]*heartbeat[^.]*pause[^.]*completion[^.]*deadline/i);
  expect(lifecycle).toMatch(/resume[^.]*authority[^.]*remaining deadline/i);
  expect(lifecycle).toMatch(/missing[^.]*timer capability[^.]*tracking gap/i);
  expect(lifecycle).toMatch(/PR watch[^.]*separate[^.]*responsibilit/i);
  expect(lifecycle).toMatch(/tracking[^.]*no[^.]*merge[^.]*release[^.]*scope/i);
  expect(record).toMatch(/driver[^.]*records?[^.]*paused[^.]*user request[^.]*hold/i);
});
