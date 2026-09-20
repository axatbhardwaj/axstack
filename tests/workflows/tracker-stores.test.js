import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('tracker stores: GitHub Issues is a first-class spec and capability store', () => {
  const spec = compact('skills/axstack-spec/SKILL.md');
  const tickets = compact('skills/axstack-tickets/SKILL.md');
  const routing = compact('skills/axstack/references/routing.md');
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  const workflows = compact('docs/workflows.md');

  expect(spec).toMatch(/Linear[^.]*default[^.]*GitHub Issues[^.]*repository Markdown/i);
  expect(spec).toMatch(/GitHub mode[^.]*target repository[^.]*issues enabled[^.]*read and write access/i);
  expect(spec).toMatch(/GitHub issue URL[^.]*SHA-256 body digest/i);

  expect(tickets).toMatch(/Markdown, GitHub Issues, or Linear store/i);
  expect(tickets).toMatch(/GitHub mode[^.]*authenticated `gh`[^.]*target repository[^.]*issue access/i);
  expect(tickets).toMatch(/Linear and GitHub Issues[^.]*user-visible capabilities/i);
  expect(tickets).toMatch(/driver performs every mutation[^.]*selected external tracker/i);
  expect(tickets).toMatch(/GitHub capability issue[^.]*remains open[^.]*close[^.]*required PRs merge[^.]*acceptance checks pass/i);

  expect(routing).toMatch(/Markdown, GitHub Issues, or Linear store/i);
  expect(lifecycle).toMatch(/close selected external-tracker tickets/i);
  expect(workflows).toMatch(/Linear is the default[^.]*GitHub Issues[^.]*repository Markdown/i);
});

test('tracker stores: checker roles cover the selected external tracker', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const roles = JSON.parse(read(`profiles/presets/${preset}.json`)).roles;
    const checker = roles.find(({ id }) => id === 'axstack-checker');
    expect(checker.name).toBe('Axstack tracker checker');
    expect(checker.notes).toMatch(/selected external tracker/i);
    expect(checker.notes).toMatch(/Never mutates/i);
  }
});
