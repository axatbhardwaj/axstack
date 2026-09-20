import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

// Structural contract checks only. Fresh model evaluation remains separate.

test('repairs: substantive runs require the explicitly loaded audit skill and holdouts', () => {
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  expect(lifecycle).toMatch(/(?:enabled by default|defaults on)[^.]*substantive run/i);
  expect(lifecycle).toMatch(/load[^\n]*axstack-audit\/SKILL\.md/i);
  expect(lifecycle).toMatch(/regression scenario[^.]*unchanged\s+holdout/i);
});

test('repairs: both advisers cover Align, Spec, and consequential decisions', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const profiles = JSON.parse(read(`profiles/presets/${preset}.json`));
    for (const id of ['axstack-advisor-astra', 'axstack-advisor-fable']) {
      const notes = profiles.roles.find((role) => role.id === id)?.notes ?? '';
      expect(notes).toMatch(/Align/i);
      expect(notes).toMatch(/Spec/i);
      expect(notes).toMatch(/consequential decisions/i);
    }
  }
  const spec = read('skills/axstack-spec/SKILL.md');
  expect(spec).toMatch(/same bounded (?:evidence and question|question and evidence)/i);
});

test('repairs: mutation authority distinguishes driver scope from PR owner scope', () => {
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  expect(lifecycle).toMatch(/driver[\s\S]{0,180}external-tracker\s+mutations/i);
  expect(lifecycle).toMatch(/owner[\s\S]{0,240}PR-scoped[^.]*publication/i);
  expect(lifecycle).toMatch(/within user authority/i);
});

test('repairs: authored publishing accepts the mode-specific scope identity', () => {
  const review = read('skills/axstack-review/SKILL.md');
  const publishing = review.slice(review.indexOf('## Authored mode'), review.indexOf('## Standalone owner')) + review.slice(review.indexOf('## Publishing rule'), review.indexOf('## Report-only scope'));
  expect(publishing).toMatch(/new work[^.]*approved spec\s+identity/i);
  expect(publishing).toMatch(/adopted[^.]*accepted maintenance scope[\s\S]*?snapshot/i);
  expect(publishing).toMatch(/applicable scope identity|proportional scope identity/i);
});

test('repairs: every skill route target resolves in the package', () => {
  const routing = read('skills/axstack/references/routing.md');
  const targets = [...routing.matchAll(/-> `(axstack(?:-[a-z]+)?)`/g)].map((match) => match[1]);
  expect(targets.length).toBeGreaterThan(0);
  for (const target of new Set(targets)) {
    expect(existsSync(`${root}/skills/${target}/SKILL.md`), `missing route target ${target}`).toBe(true);
  }
});

test('repairs: ordinary handoff and resume stay governed by shared lifecycle', () => {
  const lifecycle = read('skills/axstack/references/lifecycle.md');
  expect(lifecycle).toContain('[Orca runtime boundary](orca-runtime.md)');
  expect(lifecycle).toMatch(/explicit acceptance receipt[^.]*before changing ownership/i);
  expect(lifecycle).toMatch(/only an explicit user request to transfer\s+ownership/i);
  expect(lifecycle).toMatch(/keep the current\s+owner[\s\S]*no replacement or ownership transfer launches/i);
});
