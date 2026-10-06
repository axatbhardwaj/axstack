import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';
import { deriveModelClass } from '../../src/roles.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Scenario assertions validate raw inputs and expected policy decisions. They
// do not execute a model and are not model-behavior evidence.
test('review modes: raw scenario contracts cover the amendments', () => {
  const data = JSON.parse(read('tests/workflows/review-modes-scenarios.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual([
    'sol-authored-own',
    'opus-authored-own',
    'peer',
    'unknown-author',
    'unavailable-cross-model-reviewer',
    'stale-authoring-change',
    'automation-verdict-publication',
    'binding-deviation',
    'automation-incomplete-publishes-nothing',
  ]);
  for (const scenario of data.cases) {
    expect(scenario.skill_ref).toBe('axstack-review');
    expect(scenario.input.actual_author).toBeTruthy();
    expect(scenario.input.candidate).toBeTruthy();
    expect(scenario.expected).toBeTruthy();
  }
  const automation = data.cases.find((c) => c.id === 'automation-verdict-publication');
  expect(automation.input.caller).toMatch(/review manager|bounded PR coordinator/i);
  expect(automation.expected.publication).toMatch(/APPROVE|REQUEST_CHANGES/);
  expect(JSON.stringify(automation)).not.toMatch(/gate token/i);
  expect(automation.expected.publication).not.toMatch(/COMMENT/i);
});

// The remaining checks are shipped prompt-policy structure, not proof that a
// future agent will follow the prompts.
test('review modes: peer dispatch requires the primary and peer seats', () => {
  const raw = read('skills/axstack-review/SKILL.md');
  const peer = raw.slice(raw.indexOf('- **Peer:**'), raw.indexOf('- **Authored:**')).replace(/\s+/g, ' ');
  checkRule(peer, (text) => requires(text,
    /peer/i, /exactly two/i, /axstack-reviewer-primary/, /axstack-reviewer-peer/),
  'Peer mode requires exactly two reviewers: axstack-reviewer-primary and axstack-reviewer-peer.',
  [[/axstack-reviewer-peer/, 'axstack-reviewer-secondary'], [/exactly two/i, 'exactly one']]);
});

test('review modes: mixed same-model peer independence requires isolated sessions', () => {
  checkRule(read('skills/axstack-review/SKILL.md'), (text) => requires(text,
    /mixed/i, /(?:share a model|same model)/i, /independence/i,
    /separate sessions/i, /identical brief/i, /isolated first pass/i),
  'Mixed peer reviewers use the same model, with independence requiring separate sessions, the identical brief and an isolated first pass.',
  [[/separate sessions/i, 'shared sessions'], [/isolated first pass/i, 'shared first pass']]);
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
  const roster = compact('skills/axstack/references/role-roster.md');
  const routing = compact('skills/axstack/references/routing.md');
  expect(review).toMatch(/any other author provenance[^.]*INCOMPLETE/i);
  expect(review).toMatch(/never[^.]*derive[^.]*reverse pairing[^.]*slot position/i);
  expect(review).not.toMatch(/matches the configured primary reviewer's model[^.]*reviewer-secondary/i);
  const rows = [
    '| `mixed` | `codex/sol` | `axstack-reviewer-secondary` (`claude/opus` medium) |',
    '| `mixed` | `claude/opus` | `axstack-reviewer-primary` (`codex/sol` high) |',
    '| `codex-only` | `codex/sol` | `axstack-reviewer-secondary` (`codex/luna` xhigh) |',
    '| `claude-only` | `claude/opus` | `axstack-reviewer-secondary` (`claude/sonnet` high) |',
  ];
  for (const text of [review, roster, compact('skills/axstack-audit/SKILL.md')]) {
    for (const row of rows) expect(text).toContain(row);
  }
  expect(review).toMatch(/recorded exact model ID[^.]*derive[^.]*class/i);
  expect(review).toMatch(/no class[^.]*INCOMPLETE/i);
  expect(routing).toMatch(/provenance is matched on provider\/model class/i);
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
  expect(review).toContain('do not lower effort or choose any automatic fallback');
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
  expect(routing).toMatch(/Replacing a session needs an explicit user decision/i);
  expect(routing).toContain("holds that role with no substitution");
  expect(routing).toMatch(/provider[^.]*model[^.]*effort[^.]*no substitution/i);
  expect(review).toMatch(/single-provider[^.]*not[^.]*cross-provider/i);
  expect(review).toMatch(/Sonnet[^.]*explanation[^.]*session independence only/i);
  expect(review).toMatch(/never[^.]*same-model code review|does not permit[^.]*same-model code review/i);
});

test('review modes: status question cues route to observation-only watch', () => {
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/status question[^.]*own open PR or stack[^.]*"check now"[^.]*"what's left"[^.]*"are we done"[^.]*"is it approved"[^.]*axstack-watch[^.]*observation-only/i);
});

test('review modes: new runs discover one preset and snapshot all role states', () => {
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/\.axstack-manifest\.json/i);
  expect(routing).toMatch(/profiles\.preset/i);
  expect(routing).toMatch(/actually loaded[^.]*skills root|skills root[^.]*actually loaded/i);
  expect(routing).toMatch(/explicit user selection[^.]*run record|run record[^.]*explicit user selection/i);
  expect(routing).toMatch(/missing or contradictory[^.]*setup gap[^.]*hold|setup gap[^.]*missing or contradictory[^.]*hold/i);
  expect(routing).toMatch(/all role IDs/i);
  expect(routing).toMatch(/absent or unconfigured[^.]*recorded explicitly|recorded explicitly[^.]*absent or unconfigured/i);
  expect(routing).toMatch(/Such a role[^.]*holds only its work/i);
  expect(routing).toMatch(/later installed or changed roles[^.]*explicit user decision[^.]*snapshot/i);
});

test('review modes: watch repairs and completeness use the selected mode', () => {
  const watch = compact('skills/axstack-watch/SKILL.md');
  const repair = compact('skills/axstack-watch/references/repair-publication.md');
  const lifecycle = compact('skills/axstack/references/lifecycle.md');
  expect(watch).toMatch(/actual author/i);
  expect(watch).toMatch(/never assume[^.]*author|do not assume[^.]*author/i);
  expect(repair).toMatch(/authored[^.]*review rule/i);
  expect(repair).toMatch(/current authored[^.]*receipt|authored[^.]*current receipt/i);
  expect(lifecycle).toMatch(/peer[^.]*two configured roles[^.]*same brief[^.]*isolated/i);
  expect(lifecycle).toMatch(/authored[^.]*one eligible role[^.]*author provenance/i);
});

test('review modes: neutral reviewer IDs carry each ordered preset pair', () => {
  const pairs = {
    mixed: [['codex', 'sol', 'high'], ['codex', 'sol', 'high']],
    'codex-only': [['codex', 'sol', 'high'], ['codex', 'luna', 'xhigh']],
    'claude-only': [['claude', 'opus', 'medium'], ['claude', 'sonnet', 'high']],
  };
  for (const [preset, pair] of Object.entries(pairs)) {
    const profiles = JSON.parse(read(`profiles/presets/${preset}.json`)).roles;
    const byId = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
    for (const [index, id] of ['axstack-reviewer-primary', 'axstack-reviewer-peer'].entries()) {
      expect([byId[id].provider, byId[id].modelClass, byId[id].thinkingOptionId]).toEqual(pair[index]);
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
  expect(review).toMatch(/serious-risk escalation[^.]*holds submission[^.]*durable decision location/i);
  expect(review).toMatch(/`APPROVE` requires no validated blocker/i);
  expect(review).toMatch(/`REQUEST_CHANGES` requires at least one evidenced validated blocker/i);
  expect(review).toMatch(/never submits a `COMMENT` review/i);
});

test('review modes: reviewer brief ends with the required escalation field', () => {
  const raw = read('skills/axstack-review/SKILL.md');
  expect(raw).toContain('Escalate to user: yes | no — <criterion> — <reason>');
  const brief = raw.slice(raw.indexOf('## Template: candidate review brief'), raw.indexOf('## Template: review receipt'));
  expect(brief).toContain('Escalate to user: yes | no — <criterion> — <reason>');
  expect(brief).toMatch(/Actual author: <provider\/model from T3 launch receipt[^>]*>/);
  expect(brief).toMatch(/Claude-Session[^.]*attribution[^.]*not provenance/i);
  const receipt = raw.slice(raw.indexOf('## Template: review receipt'), raw.indexOf('## Prompt-only urgent escalation'));
  expect(receipt).toMatch(/Escalate to user: <yes \| no> — <criterion> — <reason>/);
  expect(compact('skills/axstack-review/SKILL.md')).toMatch(/security concern[^.]*permanent on-chain state change[^.]*architectural change in approach/i);
  expect(compact('skills/axstack-review/SKILL.md')).toMatch(/Health is not a reviewer criterion/i);
});

test('review modes: peer and owner fixtures match the selected preset', () => {
  const problems = [];
  for (const file of ['scenarios', 'owned-scenarios', 'review-modes-scenarios', 'routing-scenarios']) {
    for (const scenario of JSON.parse(read(`tests/workflows/${file}.json`)).cases) {
      if (scenario.input.preset === 'mixed' && scenario.input.owner) {
        const roles = JSON.parse(read('profiles/presets/mixed.json')).roles;
        const owner = roles.find(({ id }) => id === 'axstack-owner');
        const [provider, model, effort] = scenario.input.owner.split(/[\/ ]/);
        expect([provider, deriveModelClass(model), effort], `${file}/${scenario.id}: owner`)
          .toEqual([owner.provider, owner.modelClass, owner.thinkingOptionId]);
        if (scenario.input.actualWriter === 'same owner session') {
          expect(scenario.expected.recordedAuthor).toContain(scenario.input.owner);
          const reviewer = roles.find(({ id }) => id === 'axstack-reviewer-secondary');
          const actual = scenario.expected.reviewers.map((route) => {
            const [id, provider, model, effort] = route.split(/[:/\s]+/);
            return [id, provider, deriveModelClass(model), effort];
          });
          expect(actual).toEqual([
            [reviewer.id, reviewer.provider, reviewer.modelClass, reviewer.thinkingOptionId],
          ]);
        }
      }
      const input = JSON.stringify(scenario.input);
      const peer = scenario.input.mode === 'peer'
        || (!scenario.input.mode && /\bpeer (?:PR|review)\b/i.test(input));
      if (!peer) continue;
      const preset = scenario.input.preset ?? 'mixed';
      const roles = JSON.parse(read(`profiles/presets/${preset}.json`)).roles;
      const text = JSON.stringify(scenario);
      const context = `${file}/${scenario.id}`;
      for (const [, seat] of text.matchAll(/(?:axstack-)?reviewer-(primary|peer|secondary)\b/gi)) {
        if (!['primary', 'peer'].includes(seat.toLowerCase())) problems.push(`${context}: invalid peer seat ${seat}`);
      }
      for (const [, seat, provider, model, effort] of text.matchAll(
        /(?:axstack-)?reviewer-(primary|peer)(?:[=:]|\s+runs)\s*(codex|claude)\/([a-z0-9.-]+)(?:\s+(high|medium|xhigh))?/gi,
      )) {
        const role = roles.find(({ id }) => id === `axstack-reviewer-${seat.toLowerCase()}`);
        if (provider !== role.provider || deriveModelClass(model) !== role.modelClass
          || (effort && effort !== role.thinkingOptionId)) {
          problems.push(`${context}: ${seat} route contradicts ${preset}`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});
