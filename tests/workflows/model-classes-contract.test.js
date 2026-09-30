import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('run snapshot records class resolution and reuses it on resume', () => {
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/for each role[^.]*class[^.]*exact ID[^.]*source[^.]*time/i);
  expect(routing).toMatch(/resume[^.]*reuse[^.]*snapshot[^.]*never re-resolve/i);
  expect(routing).toMatch(/provider\/model class/i);
});

test('Claude alias resolves through first assistant transcript turn', () => {
  const runtime = compact('skills/axstack/references/orca-runtime.md');
  expect(runtime).toMatch(/first launch[^.]*Claude class[^.]*alias/i);
  expect(runtime).toMatch(/\.claude\/projects\/<worktree-path-slug>\/\*\.jsonl/);
  expect(runtime).toMatch(/first assistant turn[^.]*message\.model/i);
  expect(runtime).toMatch(/later launch[^.]*recorded exact ID/i);
  expect(runtime).toMatch(/alias, unresolved/i);
  expect(runtime).toMatch(/unknown[^.]*hold/i);
  expect(runtime).toMatch(/worker.s own session transcript/i);
  expect(runtime).toMatch(/worktree path[^.]*non-alphanumeric[^.]*-/i);
  expect(runtime).toMatch(/session ID|newest file after launch/i);
  expect(runtime).toMatch(/record[^.]*unknown[^.]*hold/i);
});

test('only explicit pre-turn Codex model rejection permits recorded within-class retry', () => {
  for (const path of [
    'skills/axstack/references/contracts.md',
    'skills/axstack/references/routing.md',
    'skills/axstack/references/orca-runtime.md',
    'skills/axstack-review/SKILL.md',
  ]) {
    const text = compact(path);
    expect(text, path).toMatch(/explicit model rejection[^.]*before[^.]*first turn/i);
    expect(text, path).toMatch(/--retry-of/);
    expect(text, path).toMatch(/same class[^.]*provider[^.]*effort/i);
    expect(text, path).toMatch(/Claude rejection[^.]*hold/i);
    expect(text, path).toMatch(/timeout[^.]*quota[^.]*auth[^.]*hold/i);
  }
  for (const path of ['docs/installation.md', 'docs/workflows.md']) {
    expect(compact(path), path).toMatch(/timeout[^.]*quota[^.]*auth[^.]*hold/i);
  }
  const contracts = compact('skills/axstack/references/contracts.md');
  expect(contracts).toContain('pause affected work, record the gap, and ask the user');
  expect(contracts).toContain("Every substitution requires the user's decision: configured alternatives and native fallback prose are not defaults.");
  expect(contracts).toMatch(/except[^.]*within-class|within-class[^.]*exception/i);
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/timeout[^.]*quota[^.]*hold/i);
  expect(routing).toMatch(/tried ID[^.]*error[^.]*fallback ID/i);
});
