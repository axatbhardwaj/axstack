import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

// Structural policy checks over declared scenarios and shipped instructions.
// They do not prove provider behavior, runtime execution, or live delivery.

test('native inventory routes mechanics to version-matched Orca guides', () => {
  const runtime = read('skills/axstack/references/orca-runtime.md');
  expect(runtime).toMatch(/orchestration[^.]*Run[^.]*Task[^.]*Dispatch/i);
  expect(runtime).toMatch(/orca-cli[^.]*worktree[^.]*automation/i);
  expect(runtime).toMatch(/orca-linear[^.]*issue/i);
  expect(runtime).toMatch(/guide discovery[^.]*not[^.]*runtime support/i);
});

test('Linear document operations fail closed without native support', () => {
  const spec = read('skills/axstack-spec/SKILL.md');
  const tickets = read('skills/axstack-tickets/SKILL.md');
  for (const text of [spec, tickets]) {
    expect(text).toMatch(/orca-linear/);
    expect(text).toMatch(/document[^.]*guide[^.]*help/i);
    expect(text).toMatch(/hold[^.]*operation|operation[^.]*hold/i);
    expect(text).toMatch(/no[^.]*fallback|never[^.]*fallback/i);
    expect(text).toMatch(/no[^.]*store[^.]*switch|never[^.]*switch[^.]*store/i);
  }
});

test('reviewers use isolated children and preserve private evidence before cleanup', () => {
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  const review = read('skills/axstack-review/SKILL.md');
  const automations = read('skills/axstack/references/automations.md');
  for (const text of [lifecycle, review, automations]) {
    expect(text).toMatch(/separate[^.]*child\s+worktree|one[^.]*child\s+worktree[^.]*reviewer/i);
    expect(text).toMatch(/evidence[^.]*inside[^.]*worktree|worktree[^.]*evidence/i);
    expect(text).toMatch(/preserv[^.]*(?:evidence|it)[^.]*before[^.]*remov/i);
  }
  expect(automations).not.toMatch(/finished worker'?s untracked artefacts are not/i);
});

test('Telegram is limited to serious risk, recovered blockers, and explicit sends', () => {
  const relay = read('skills/axstack-relay/SKILL.md');
  const implement = read('skills/axstack-implement/SKILL.md');
  const watch = read('skills/axstack-watch/SKILL.md');
  const text = [relay, implement, watch].join('\n');
  expect(text).toMatch(/serious risk/i);
  expect(text).toMatch(/bounded safe recovery/i);
  expect(text).toMatch(/user intervention/i);
  for (const routine of ['questions', 'spec approvals', 'progress', 'CI pending', 'merge-ready', 'merged', 'completion']) {
    expect(text, routine).toMatch(new RegExp(`${routine}[^.]*Orca|Orca[^.]*${routine}`, 'i'));
  }
});

test('private evidence never defaults to public Orca artifacts', () => {
  const runtime = read('skills/axstack/references/orca-runtime.md');
  expect(runtime).toMatch(/artifacts?[^.]*public[^.]*link/i);
  expect(runtime).toMatch(/never[^.]*private evidence|not[^.]*private evidence/i);
  expect(runtime).toMatch(/explicit[^.]*publication authority/i);
});

test('scenario fixture covers the accepted native workflow decisions', () => {
  const data = JSON.parse(read('tests/workflows/orca-native-scenarios.json'));
  expect(data.note).toMatch(/not.*runtime.*evidence/i);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'linear-document-gap',
    'isolated-review-evidence',
    'escalation-only-relay',
    'private-evidence-no-publish',
  ]);
});
