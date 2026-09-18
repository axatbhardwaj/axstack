import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Scenario assertions validate raw inputs and expected policy decisions. They
// do not execute a model and are not model-behavior evidence.
test('review modes: eight raw scenario contracts cover the amendments', () => {
  const data = JSON.parse(read('tests/workflows/review-modes-scenarios.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'sol-authored-own',
    'opus-authored-own',
    'peer',
    'unknown-author',
    'unavailable-cross-model-reviewer',
    'stale-authoring-change',
    'automation-comment-publication',
    'automation-incomplete-publishes-nothing',
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

test('review modes: authored routing enumerates only the accepted preset mappings', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  const routing = compact('skills/axstack/references/routing.md');
  expect(review).toMatch(/any other author provenance[^.]*INCOMPLETE/i);
  expect(review).toMatch(/never[^.]*derive[^.]*reverse pairing[^.]*slot position/i);
  expect(review).not.toMatch(/matches the configured primary reviewer's model[^.]*reviewer-secondary/i);
  const rows = [
    ['mixed', 'Codex / Sol (`codex/gpt-5.6-sol`)', 'axstack-reviewer-secondary', '`claude/claude-opus-5` medium'],
    ['mixed', 'Claude / Opus (`claude/claude-opus-5`)', 'axstack-reviewer-primary', '`codex/gpt-5.6-sol` medium'],
    ['codex-only', 'Codex / Sol (`codex/gpt-5.6-sol`)', 'axstack-reviewer-secondary', '`codex/gpt-5.6-terra` xhigh'],
    ['claude-only', 'Claude / Opus (`claude/claude-opus-5`)', 'axstack-reviewer-secondary', '`claude/claude-sonnet-5` xhigh'],
  ];
  for (const text of [review, routing]) {
    for (const row of rows) {
      for (const cell of row) expect(text).toContain(cell);
    }
    expect(text).toMatch(/provenance is matched on provider\/model ID/i);
  }
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

test('review modes: new runs discover one preset and snapshot all role states', () => {
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/\.axstack-manifest\.json/i);
  expect(routing).toMatch(/profiles\.preset/i);
  expect(routing).toMatch(/actually loaded[^.]*skills root|skills root[^.]*actually loaded/i);
  expect(routing).toMatch(/explicit user selection[^.]*run record|run record[^.]*explicit user selection/i);
  expect(routing).toMatch(/missing or contradictory[^.]*setup gap[^.]*hold|setup gap[^.]*missing or contradictory[^.]*hold/i);
  expect(routing).toMatch(/all 24 role IDs|complete 24-role map/i);
  expect(routing).toMatch(/absent or unconfigured[^.]*recorded explicitly|recorded explicitly[^.]*absent or unconfigured/i);
  expect(routing).toMatch(/absent[^.]*hold[^.]*only that role|only that role[^.]*hold/i);
  expect(routing).toMatch(/later[^.]*must not[^.]*silently[^.]*snapshot|snapshot[^.]*must not[^.]*silently[^.]*later/i);
  expect(routing).toMatch(/explicit user decision[^.]*add|add[^.]*explicit user decision/i);
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
    const profiles = JSON.parse(read(`profiles/presets/${preset}.json`)).roles;
    const byId = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
    for (const [index, id] of ['axstack-reviewer-primary', 'axstack-reviewer-secondary'].entries()) {
      expect([byId[id].provider, byId[id].model, byId[id].thinkingOptionId]).toEqual(pair[index]);
      expect(byId[id].notes).toMatch(/peer|authored/i);
    }
  }
});

test('review modes: automation verdicts bind the reviewed commit and carry the marker', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  const raw = read('skills/axstack-review/SKILL.md');
  expect(raw).toMatch(/^## Authorized submission \(peer review\)/m);
  expect(review).toMatch(/Submit a consolidated peer review only within explicit user authority and only for a complete `APPROVE` or `REQUEST_CHANGES` verdict/);
  expect(raw).toMatch(/^## Automation exception$/m);
  expect(review).toMatch(/same complete-review and exact-commit requirements/i);
  expect(review).toMatch(/immediately before `gh pr review`[^.]*re-read self's reviews/i);
  expect(review).toMatch(/re-check head, base, draft status, authorship, and allowlist/i);
  expect(review).toContain('<!-- axstack-automation verdict head=<sha> -->');
  expect(review).toMatch(/`INCOMPLETE`[^.]*unknown GitHub state submits nothing/i);
  expect(review).toMatch(/`escalate` opens a bound decision token[^.]*exits/i);
  expect(review).toMatch(/`proceed` permits `APPROVE`[^.]*no validated blocker/i);
  expect(review).toMatch(/permits `REQUEST_CHANGES`[^.]*at least one evidenced validated blocker/i);
  expect(review).toMatch(/never submits a `COMMENT` review/i);
});

test('review modes: reviewer brief ends with the required escalation field', () => {
  const raw = read('skills/axstack-review/SKILL.md');
  expect(raw).toContain('Escalate to user: yes | no — <criterion> — <reason>');
  const brief = raw.slice(raw.indexOf('## Template: candidate review brief'), raw.indexOf('## Template: review receipt'));
  expect(brief).toContain('Escalate to user: yes | no — <criterion> — <reason>');
  const receipt = raw.slice(raw.indexOf('## Template: review receipt'), raw.indexOf('## Prompt-only urgent escalation'));
  expect(receipt).toMatch(/Escalate to user: <yes \| no> — <criterion> — <reason>/);
  expect(compact('skills/axstack-review/SKILL.md')).toMatch(/security concern[^.]*permanent on-chain state change[^.]*architectural change in approach/i);
  expect(compact('skills/axstack-review/SKILL.md')).toMatch(/Health is not a reviewer criterion/i);
});
