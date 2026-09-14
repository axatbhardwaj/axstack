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
test('review modes: peer keeps exactly two configured role reviewers with isolated same briefs', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/peer[\s\S]*exactly two[\s\S]*axstack-reviewer-primary[\s\S]*axstack-reviewer-secondary/i);
  expect(review).toMatch(/peer[\s\S]*identical|peer[\s\S]*same instantiated brief/i);
  expect(review).toMatch(/first-pass[^.]*isolation|no first-pass cross-read/i);
});

test('review modes: authored routing follows actual author provenance', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  expect(read('skills/axstack-review/SKILL.md')).toMatch(/^description: When .*use axstack-review/m);
  expect(review).toMatch(/actual author provenance/i);
  expect(review).toMatch(/routing snapshot|recorded snapshot/i);
  expect(review).toMatch(/eligible reviewer[^.]*actual author|actual author[^.]*eligible reviewer/i);
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
  expect(review).toMatch(/never assume[^.]*author|do not assume[^.]*author/i);
  expect(review).toMatch(/no[^.]*invent[^.]*pair|never[^.]*invent[^.]*pair/i);
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

test('review modes: preset boundaries and Sonnet explanation exception stay explicit', () => {
  const routing = compact('skills/axstack/references/routing.md');
  const review = compact('skills/axstack-review/SKILL.md');
  expect(routing).toMatch(/preset change[^.]*new runs only|new runs[^.]*preset change/i);
  expect(routing).toMatch(/active runs?[^.]*snapshot/i);
  expect(routing).toMatch(/no automatic fallback|never[^.]*fallback/i);
  expect(review).toMatch(/single-provider[^.]*not[^.]*cross-provider/i);
  expect(review).toMatch(/Sonnet[^.]*explanation[^.]*session independence only/i);
  expect(review).toMatch(/never[^.]*same-model code review|does not permit[^.]*same-model code review/i);
});

test('review modes: watch repairs and completeness use the selected mode', () => {
  const watch = compact('skills/axstack-watch/SKILL.md');
  const repair = compact('skills/axstack-watch/references/repair-publication.md');
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  expect(watch).toMatch(/actual author/i);
  expect(watch).toMatch(/never assume[^.]*author|do not assume[^.]*author/i);
  expect(repair).toMatch(/authored[^.]*review rule/i);
  expect(repair).toMatch(/current authored[^.]*receipt|authored[^.]*current receipt/i);
  expect(lifecycle).toMatch(/peer[^.]*two[^.]*reviewer-primary[^.]*reviewer-secondary/i);
  expect(lifecycle).toMatch(/authored[^.]*one[^.]*eligible[^.]*actual author/i);
});

test('review modes: neutral reviewer IDs carry each ordered preset pair', () => {
  const pairs = {
    mixed: [['codex', 'gpt-5.6-sol', 'medium'], ['claude', 'claude-opus-5', 'medium']],
    'codex-only': [['codex', 'gpt-5.6-sol', 'medium'], ['codex', 'gpt-5.6-terra', 'xhigh']],
    'claude-only': [['claude', 'claude-opus-5', 'medium'], ['claude', 'claude-sonnet-5', 'xhigh']],
  };
  for (const [preset, pair] of Object.entries(pairs)) {
    const profiles = JSON.parse(read(`profiles/presets/${preset}.json`)).agentProfiles;
    const byId = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
    for (const [index, id] of ['axstack-reviewer-primary', 'axstack-reviewer-secondary'].entries()) {
      expect([byId[id].provider, byId[id].model, byId[id].thinkingOptionId]).toEqual(pair[index]);
      expect(byId[id].notes).toMatch(/peer|authored/i);
    }
  }
});
