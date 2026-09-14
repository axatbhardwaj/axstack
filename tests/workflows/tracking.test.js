import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Fixture and prose structure only; evaluated behavior and live runtime proof
// remain separate evidence classes.
test('tracking scenarios retain thirteen explicit decision boundaries', () => {
  const data = JSON.parse(read('tests/workflows/tracking-scenarios.json'));
  expect(data.version).toBe(1);
  expect(data.cases).toHaveLength(13);
  expect(new Set(data.cases.map(({ id }) => id)).size).toBe(13);
  for (const scenario of data.cases) {
    expect(scenario.input.before).toBeTruthy();
    expect(scenario.input.event).toBeTruthy();
    expect(scenario.expected.after).toBeTruthy();
    expect(scenario.expected.actions.length).toBeGreaterThan(0);
    expect(scenario.expected.forbidden.length).toBeGreaterThan(0);
  }
});

test('execution binds one authoritative Orca Task and Dispatch', () => {
  const implement = compact('skills/axstack-implement/SKILL.md');
  const runtime = compact('skills/axstack/references/orca-runtime.md');
  expect(implement).toMatch(/driver-owned Orca Run[^.]*authoritative[^.]*Task\/Dispatch/i);
  expect(runtime).toMatch(/exactly one Dispatch[^.]*write[^.]*candidate/i);
  expect(runtime).toMatch(/input_accepted[^.]*only[^.]*terminal/i);
  expect(runtime).toMatch(/turn_started[^.]*inspection/i);
  expect(runtime).toMatch(/trust[^.]*prompt[^.]*never answer|never answer[^.]*trust/i);
});

test('delivery and recovery preserve runtime identity and ownership', () => {
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  const runtime = compact('skills/axstack/references/orca-runtime.md');
  expect(lifecycle).toMatch(/whole delivery[^.]*acknowledgment/i);
  expect(lifecycle).toMatch(/Task[^.]*Dispatch[^.]*sender/i);
  expect(runtime).toMatch(/older Dispatch[^.]*never completes[^.]*newer Dispatch/i);
  expect(runtime).toMatch(/consumer_fenced[^.]*stop consuming/i);
  expect(runtime).toMatch(/user_takeover[^.]*retention/i);
  expect(runtime).toMatch(/same author[^.]*session[^.]*evidence/i);
  expect(lifecycle).toMatch(/tracking[^.]*no[^.]*merge[^.]*release[^.]*model-substitution[^.]*scope/i);
});

test('native watch policy is preserved behind an explicit capability hold', () => {
  const watch = compact('skills/axstack-watch/references/watch-runtime.md');
  expect(watch).toMatch(/provider selection[^.]*model[^.]*effort[^.]*permission[^.]*unsupported/i);
  expect(watch).toMatch(/schedule parser[^.]*cannot preserve[^.]*bounded expiry/i);
  expect(watch).toMatch(/watch activation[^.]*complete Orca migration claim[^.]*held/i);
  expect(watch).toMatch(/Create no schedule/i);
  expect(watch).toMatch(/no custom scheduler[^.]*polling loop/i);
  expect(watch).toMatch(/five-minute\/hourly[^.]*cadences/i);
  expect(watch).toMatch(/quiet healthy behavior/i);
  expect(watch).toMatch(/24-hour/i);
});
