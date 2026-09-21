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

test('native managers and standalone watch boundaries remain explicit', () => {
  const watch = compact('skills/axstack-watch/references/watch-runtime.md');
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  const workflows = compact('docs/workflows.md');
  expect(watch).toMatch(/separate native watch manager/i);
  expect(watch).toMatch(/at most five bounded actionable-event jobs/i);
  expect(watch).toMatch(/waiting PRs[^.]*without reserving slots/i);
  expect(watch).toMatch(/same-session reuse[^.]*busy scheduled tick[^.]*session loss/i);
  expect(watch).toMatch(/precheck[^.]*watchdog[^.]*custom scheduler/i);
  expect(lifecycle).toMatch(/review and watch managers[^.]*dedicated workspaces/i);
  expect(lifecycle).toMatch(/at most five executing PR jobs/i);
  expect(workflows).toMatch(/exactly two reusable native manager chats/i);
  expect(workflows).toMatch(/waiting PRs[^.]*consume no slot/i);

  const watchSkill = compact('skills/axstack-watch/SKILL.md');
  const readme = compact('README.md');
  for (const text of [watchSkill, readme]) {
    expect(text).toMatch(/reusable|native watch manager/i);
    expect(text).toMatch(/waiting PRs[^.]*slots/i);
  }
});
