import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// These checks pin written dispatch contracts, not live agent behavior.
test('analysis pairs: audit dispatch keeps every reconciliation boundary', () => {
  const audit = compact('skills/axstack-audit/SKILL.md');
  expect(audit).toMatch(/Dispatch `axstack-auditor` and `axstack-auditor-sol` independently on the same bounded brief, without cross-reading/i);
  expect(audit).toMatch(/driver reconciles findings per claim/i);
  expect(audit).toMatch(/never average verdicts/i);
  expect(audit).toMatch(/intentionally absent Sol seat[^.]*continue[^.]*base auditor alone/i);
  expect(audit).toMatch(/auditor-sol` is optional[^.]*fails[^.]*fence/i);
  expect(audit).toMatch(/auditor: UNKNOWN \(unlaunchable\)/i);
  expect(audit).toMatch(/mixed fan-out[^.]*Codex[^.]*Claude[^.]*hold/i);
});

test('analysis pairs: code and execution research retain both paired routes', () => {
  const research = compact('skills/axstack-research/SKILL.md');
  const rule = research.split('When dispatching ')[1]?.split('3. **Gather primary source evidence.**')[0];
  expect(rule).toBeTruthy();
  expect(rule).toMatch(/`axstack-research-code` or `axstack-explore-execution`/i);
  expect(rule).toMatch(/`-sol` pair independently on the same bounded brief without cross-reading/i);
  expect(rule).toMatch(/driver reconciles agreement and disagreement per claim/i);
  expect(rule).toMatch(/never averaging findings/i);
  expect(rule).toMatch(/intentionally absent pair[^.]*proceed[^.]*base seat alone/i);
  expect(rule).toMatch(/-sol` pair is optional[^.]*launch failure[^.]*trust\/login prompt[^.]*prompt block/i);
});

test('analysis pairs: routing and declared scenarios cover presence and absence', () => {
  const routing = compact('skills/axstack/references/routing.md');
  const roster = compact('skills/axstack/references/role-roster.md');
  const sonnet = roster.split('- `axstack-ui-verifier`')[1]?.split('- `axstack-explore-codebase`')[0];
  const pairs = roster.split('- Sol pairs ')[1]?.split('- `axstack-debug-investigator')[0];
  expect(sonnet).toBeTruthy();
  for (const role of [
    'axstack-auditor', 'axstack-research-requirements', 'axstack-research-code',
    'axstack-research-web', 'axstack-explore-execution',
  ]) expect(sonnet).toContain(role);
  expect(sonnet).toContain('claude/sonnet');
  expect(pairs).toBeTruthy();
  for (const role of [
    'axstack-auditor-sol', 'axstack-research-code-sol', 'axstack-explore-execution-sol',
  ]) expect(pairs).toContain(role);
  expect(pairs).toMatch(/mixed\/codex-only[^.]*intentionally absent in claude-only/i);
  expect(pairs).toMatch(/independent[^.]*same bounded brief[^.]*without cross-reading/i);
  expect(pairs).toMatch(/reconcile[^.]*findings per claim[^.]*never averages/i);
  expect(pairs).toMatch(/intentional absence[^.]*continue with Sonnet alone/i);
  expect(roster).toMatch(/Optional seats:/i);
  expect(roster).toMatch(/fence the attempt, record `absent \(<reason>\)`/i);
  expect(routing).toMatch(/An unavailable provider, model, role, mode or effort holds that role with no substitution/i);

  const cases = JSON.parse(read('tests/workflows/routing-scenarios.json')).cases;
  const mixed = cases.find(({ id }) => id === 'mixed-analysis-sonnet-high');
  expect(mixed?.expected?.routes).toContain('axstack-research-code-sol: codex/gpt-6-sol high');
  expect(mixed?.expected?.routes).toContain('axstack-explore-execution-sol: codex/gpt-6-sol high');
  expect(mixed?.expected?.pairing).toMatch(/independent[^.]*without cross-reading[^.]*per claim[^.]*without averaging/i);
  const absent = cases.find(({ id }) => id === 'claude-only-sol-pairs-absent');
  expect(absent?.expected?.absent).toEqual([
    'axstack-auditor-sol', 'axstack-research-code-sol', 'axstack-explore-execution-sol',
  ]);
  expect(absent?.expected?.base).toMatch(/Sonnet high proceeds alone/i);
  expect(absent?.expected?.forbidden).toContain('substitute a Sol model');
});

test('analysis pairs: improve dispatches code research with its Sol pair', () => {
  const improve = compact('skills/axstack-improve/SKILL.md');
  expect(improve).toMatch(/axstack-research-code[^.]*axstack-research-code-sol/i);
  expect(requires(improve,
    /axstack-research-code[^.]*axstack-research-code-sol/i,
    /independently[^.]*(?:same|identical) bounded brief[^.]*without cross-reading/i,
  )).toBe(true);
  expect(improve).toMatch(/driver reconciles[^.]*per claim[^.]*never averages/i);
  expect(improve).toMatch(/intentionally absent[^.]*base seat alone/i);
  expect(improve).toMatch(/configured optional[^.]*fails to launch[^.]*fenced/i);
  expect(improve).toMatch(/mixed fan-out[^.]*Codex[^.]*Claude[^.]*hold/i);
});

test('analysis pairs: routing preserves original ownership and direct-route duties', () => {
  const routing = compact('skills/axstack/references/routing.md');
  const roster = compact('skills/axstack/references/role-roster.md');
  expect(roster).toMatch(/`axstack-owner` owns one PR/i);
  expect(routing).toMatch(/An unavailable provider, model, role, mode or effort holds that role with no substitution/i);
  expect(routing).toMatch(/verify primary sources and code/i);
  expect(routing).toMatch(/escalate via adviser-directed investigators/i);
  expect(routing).toMatch(/red loop wanted -> `axstack-debug`/i);
  expect(routing).toMatch(/rank bounded candidates with evidence/i);
  expect(routing).toMatch(/reconcile run record[^.]*launch no native handoff/i);
  expect(routing).toMatch(/ownership-transfer\s+contract[^.]*explicit recipient acceptance/i);
  expect(routing).toMatch(/Never infer the author from the orchestrator or assume an imported own PR's author/i);
});
