import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Scenario assertions validate raw inputs and expected policy decisions. They
// do not execute a model and are not model-behavior evidence.
test('review modes: six raw scenario contracts cover the amendment', () => {
  const data = JSON.parse(read('tests/workflows/review-modes-scenarios.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'sol-authored-own',
    'opus-authored-own',
    'peer',
    'unknown-author',
    'unavailable-cross-model-reviewer',
    'stale-authoring-change',
  ]);
  for (const scenario of data.cases) {
    expect(scenario.skill_ref).toBe('axstack-review');
    expect(scenario.input.actual_author).toBeTruthy();
    expect(scenario.input.candidate).toBeTruthy();
    expect(scenario.expected).toBeTruthy();
  }
});

// The remaining checks are shipped prompt-policy structure, not proof that a
// future agent will follow the prompts.
test('review modes: peer keeps exactly two isolated same-brief reviewers', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/peer[\s\S]*exactly two[\s\S]*Sol[\s\S]*Opus/i);
  expect(review).toMatch(/peer[\s\S]*identical|peer[\s\S]*same instantiated brief/i);
  expect(review).toMatch(/first-pass[^.]*isolation|no first-pass cross-read/i);
});

test('review modes: authored routing follows actual author provenance', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(read('skills/axstack-review/SKILL.md')).toMatch(/^description: When .*use axstack-review/m);
  expect(review).toMatch(/actual author provenance/i);
  expect(review).toMatch(/Sol author[^.]*Opus medium/i);
  expect(review).toMatch(/Opus author[^.]*Sol medium/i);
  expect(review).toMatch(/orchestrator[^.]*not[^.]*author|not[^.]*orchestrator/i);
  expect(review).toMatch(/author session[^.]*never[^.]*review|no author session[^.]*review/i);
  expect(review).toMatch(/owner session[^.]*may not[^.]*review|no owner session[^.]*review/i);
});

test('review modes: authored review is one complete exact-revision review', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/authored[\s\S]*exactly one|authored[\s\S]*one independent/i);
  expect(review).toMatch(/authored[\s\S]*all six angles/i);
  expect(review).toMatch(/spec[^.]*ticket[^.]*intent[^.]*acceptance|acceptance[^.]*spec[^.]*ticket[^.]*intent/i);
  expect(review).toMatch(/exact[^.]*candidate[^.]*current base|exact SHA[^.]*current base/i);
  expect(review).toMatch(/Ticket criterion:[\s\S]*expired invite[\s\S]*410/i);
  expect(review).toMatch(/Observed:[\s\S]*200[\s\S]*session/i);
  expect(review).toMatch(/Consequence:[\s\S]*expired links/i);
});

test('review modes: provenance and availability gaps stop without fallback', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/unknown|mixed/i);
  expect(review).toMatch(/exact[^.]*gap[^.]*ask the user/i);
  expect(review).toMatch(/never assume Sol|do not assume Sol/i);
  expect(review).toMatch(/no[^.]*invent[^.]*family|never[^.]*invent[^.]*family/i);
  expect(review).toMatch(/unavailable[^.]*ask the user|ask the user[^.]*unavailable/i);
});

test('review modes: eligible high-stakes checkpoint is revalidated, not duplicated', () => {
  const contracts = compact('skills/axstack/references/contracts.md');
  const review = compact('skills/axstack-review/SKILL.md');
  expect(contracts).toMatch(/Opus high author[^.]*Sol high checkpoint/i);
  expect(contracts).toMatch(/satisfy[^.]*authored final review[^.]*revalid/i);
  expect(contracts).toMatch(/not[^.]*lower[^.]*effort|preserv[^.]*effort/i);
  expect(review).toMatch(/checkpoint[^.]*revalid/i);
  expect(review).toMatch(/no redundant|without[^.]*redundant/i);
});

test('review modes: watch repairs and completeness use the selected mode', () => {
  const watch = compact('skills/axstack-watch/SKILL.md');
  const repair = compact('skills/axstack-watch/references/repair-publication.md');
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  expect(watch).toMatch(/actual author/i);
  expect(watch).toMatch(/never assume Sol|do not assume Sol/i);
  expect(repair).toMatch(/authored[^.]*review rule/i);
  expect(repair).toMatch(/current authored[^.]*receipt|authored[^.]*current receipt/i);
  expect(lifecycle).toMatch(/peer[^.]*two[^.]*Sol[^.]*Opus/i);
  expect(lifecycle).toMatch(/authored[^.]*one[^.]*different[- ]model[- ]family/i);
});

test('review modes: reviewer profile identities stay stable and notes describe mode use', () => {
  const data = JSON.parse(read('profiles/paseo.json'));
  const byId = Object.fromEntries(data.agentProfiles.map((profile) => [profile.id, profile]));
  expect(byId['axstack-reviewer-opus']).toMatchObject({
    provider: 'claude', model: 'claude-opus-5', modeId: 'bypassPermissions', thinkingOptionId: 'medium',
  });
  expect(byId['axstack-reviewer-sol']).toMatchObject({
    provider: 'codex', model: 'gpt-5.6-sol', modeId: 'full-access', thinkingOptionId: 'medium',
  });
  expect(byId['axstack-reviewer-opus'].notes).toMatch(/peer|Sol-authored/i);
  expect(byId['axstack-reviewer-sol'].notes).toMatch(/peer|Opus-authored/i);
});
