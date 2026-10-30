import { readSkillFile as readFileSync } from './skill-source.js';
import { expect, test } from 'bun:test';
import { publicDocPaths } from './public-docs.js';
import { existsSync, readdirSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const readJson = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
const presetDir = `${root}/profiles/presets`;
const presetNames = ['mixed', 'codex-only', 'claude-only'];
// T5a migration contracts: instruction checks, not live T3 execution proof.
const phaseNames = ['align', 'audit', 'debug', 'explain', 'implement', 'improve',
  'research', 'review', 'spec', 'tickets'];
const migratedGuidance = [
  ...phaseNames.map((name) => `skills/axstack-${name}/SKILL.md`),
  ...['routing', 'contracts', 'run-record', 'autopilot', 'diligence', 'ui-verification']
    .map((name) => `skills/axstack/references/${name}.md`),
];
const guidance = (path) => readFileSync(`${root}/${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

test('T5a phase entry points load the T3 boundary and remove the old runtime', () => {
  for (const path of migratedGuidance) {
    const text = guidance(path);
    const target = path.includes('/references/') ? 't3-runtime.md' : '../axstack/references/t3-runtime.md';
    expect(loadedReferences(text), path).toContain(target);
    const runtimeLinks = [...text.matchAll(/\]\(([^)]*-runtime\.md)(?:#[^)]*)?\)/g)].map((match) => match[1]);
    // Autopilot also links directly to the shipped PR-watch cadence contract.
    expect(runtimeLinks.every((link) => link.endsWith('t3-runtime.md')
      || (path === 'skills/axstack/references/autopilot.md'
        && link === '../../axstack-watch/references/watch-runtime.md')), path).toBe(true);
    expect(text, path).not.toMatch(/Readable sidebar/i);
  }
  for (const preset of presetNames) {
    for (const role of readJson(`profiles/presets/${preset}.json`).roles) {
      expect(role.notes, `${preset}: ${role.id}`).not.toMatch(/\bTUI\b|\bagy\b|alias resolves|provider default|pre-turn Codex rejection/i);
    }
  }
});

const migrationPins = [
  ['skills/axstack-implement/SKILL.md', 'A turn with unsettled launched threads must end only under the bound-watch rule in the T3 runtime contract.'],
  ['AGENTS.md', 'Use T3 Code as the only active runtime.'],
  ['AGENTS.md', 'Route every delegated worker, reviewer, or cross-harness dispatch through the `t3-code` MCP, never native subagents.'],
  ['skills/axstack/references/routing.md', 'Resume must reuse the saved capabilities and role snapshot with no re-resolution; changes require the user’s explicit decision.'],
  ['skills/axstack/references/routing.md', 'An unavailable provider, model, role, mode or effort holds that role with no substitution.'],
  ['skills/axstack-review/SKILL.md', 'The T3 driver thread is the sole owner and coordinator; it never writes tracked files or repairs an author’s source.'],
  ['skills/axstack/references/ui-verification.md', 'The verifier is read-only: it never edits source.'],
  ['skills/axstack/references/contracts.md', 'One T3 host/server owns a run.'],
  ['skills/axstack/references/contracts.md', "Every substitution requires the user's decision: configured alternatives are not defaults."],
  ['skills/axstack/references/contracts.md', 'Rejection, timeout, quota and auth failures hold affected work.'],
  ['skills/axstack/references/routing.md', "Use an explicit model as given; for `model:null` without a class, grok uses the provider's first listed model from saved capabilities and records its exact ID."],
  ['skills/axstack/references/routing.md', 'A first listed ID without the `grok-` prefix holds that role with no substitution; the prefix checks family, not X access or other live capability.'],
  ['skills/axstack/references/routing.md', 'Later installed or changed roles need an explicit user decision to enter the snapshot.'],
  ['skills/axstack/references/routing.md', 'Replacing a session needs an explicit user decision and revalidation.'],
  ['skills/axstack/references/run-record.md', 'Before changing `Driver` or a task `Owner`, verify that the prior driver is inactive against actual T3 thread and run state, or that an explicit accepted transfer permits reassignment.'],
  ['skills/axstack/references/run-record.md', "The record is derived progress, not authority."],
  ['skills/axstack-review/SKILL.md', 'Use separate driver-made disposable detached checkouts under the run directory, each detached at the pinned exact source SHA; that source SHA substitutes for the PR base in the reviewer workspace rule.'],
  ['skills/axstack-review/SKILL.md', 'Keep reports, probes, and logs in each private per-dispatch evidence folder.'],
  ['skills/axstack-review/SKILL.md', 'Rejection, timeout, quota and auth failures hold affected work without substitution.'],
  ['skills/axstack-spec/SKILL.md', 'Use Linear through the executor MCP only for repositories in `defi-com`.'],
  ['skills/axstack-spec/SKILL.md', 'Keep specs for other repositories on GitHub; if the issue, PR or repository-file location is unclear, ask before creating a planning artifact.'],
  ['skills/axstack-spec/SKILL.md', 'For missing Linear access through the executor MCP, record its guide/help evidence, hold only that operation, and stop this phase without mutation or store switch; the selected document remains authoritative.'],
  ['skills/axstack-tickets/SKILL.md', 'In Linear mode, use only the executor MCP for `defi-com` repositories and verify its advertised issue operations.'],
  ['skills/axstack-tickets/SKILL.md', 'When the pinned spec requires a document read, verify that operation separately; missing access holds the affected operation without mutation or store switch.'],
  ['skills/axstack/references/autopilot.md', 'Cancellation does not cancel a running author run by inference; let it report, then settle that exact attempt under lifecycle guards without new publication.'],
];
for (const [path, sentence] of migrationPins) {
  test(`T5a safety pin: ${path}: ${sentence.slice(0, 38)}`, () => {
    const accepts = (text) => normalize(text).includes(normalize(sentence));
    expect(accepts(guidance(path))).toBe(true);
    expect(accepts(normalize(guidance(path)).replace(normalize(sentence), ''))).toBe(false);
    expect(accepts(sentence.replace(/\b([A-Za-z]+)\b/, '$1 not'))).toBe(false);
  });
}

const migrationRules = [
  ['skills/axstack/references/routing.md', [/resolv\w*/i, /Codex/i, /Claude/i, /class/i, /saved T3 capabilities/i, /--provider/i, /--capabilities/i],
    'From saved T3 capabilities, resolve Codex and Claude classes with --provider and --capabilities.'],
  ['skills/axstack/references/ui-verification.md', [/use/i, /configured verifier browser/i, /user.*browser.tool policy/i],
    'Use the configured verifier browser and honor the user browser-tool policy.'],
  ['skills/axstack/references/run-record.md', [/record/i, /driver threadId/i, /projectId/i, /scheduledTaskIds/i],
    'Record projectId, scheduledTaskIds and driver threadId for the run.'],
];
for (const [path, concepts, rewording] of migrationRules) {
  test(`T5a binding rule: ${path}: ${concepts[0]}`, () => {
    const accepts = (text) => requires(text, ...concepts);
    const matching = sentences(guidance(path)).filter(accepts);
    expect(matching.length).toBeGreaterThan(0);
    expect(accepts(rewording)).toBe(true);
    const removed = sentences(guidance(path)).filter((sentence) => !accepts(sentence)).join('. ');
    expect(accepts(removed)).toBe(false);
    for (const sentence of [...matching, rewording]) {
      expect(accepts(`${removed}. Do not ${sentence}`)).toBe(false);
    }
  });
}

test('T5a run record exposes native delegated and writer identities', () => {
  const text = guidance('skills/axstack/references/run-record.md');
  for (const field of ['taskId/childThreadId/childRunId', 'threadId/runId/worktree/branch/base SHA',
    'capabilities JSON path', 'scheduledTaskIds', 'T3 threads and runs']) expect(text).toContain(field);
});

