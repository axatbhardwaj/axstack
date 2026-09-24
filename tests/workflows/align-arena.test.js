import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');
const readJson = (path) => JSON.parse(read(path));

// Structural checks for the arena round inside align: who authors, who judges,
// how the pick and graft are bounded, and where the synthesis is recorded.

test('align research: dispatches source-specific branches with one owner each', () => {
  const text = compact('skills/axstack-align/SKILL.md');
  expect(text).toMatch(/not derivable[^.]*local repo[^.]*ordinary reading[^.]*dispatch[^.]*`axstack-research` branches[^.]*through Orca/i);
  expect(text).toMatch(/requirements[^.]*code[^.]*web[^.]*once configured[^.]*X/i);
  expect(text).toMatch(/one owner per branch[^.]*cross-harness[^.]*roles allow/i);
  expect(text).toMatch(/cited note[^.]*research skill.s source standards/i);
  expect(text).toMatch(/folds verified claims into the frontier[^.]*records the receipts/i);
  expect(text).toMatch(/ordinary reading stays in-chat[^.]*single factual lookup never dispatches/i);
});

test('align arena: gated to hard-to-reverse choices and replaces critique for that question', () => {
  const text = compact('skills/axstack-align/SKILL.md');
  expect(text).toMatch(/## Arena for hard-to-reverse design choices/);
  expect(text).toMatch(/same test as for an ADR/i);
  expect(text).toMatch(/small or routine questions never enter the arena/i);
  expect(text).toMatch(/Rung 2[^.]*arena/i);
  expect(text).toMatch(/replace the critique round for that question with one arena round/i);
  // The pre-consultation draft rule is explicitly overridden for arena-grade questions,
  // in align and in the standing contracts, so the two never conflict.
  expect(text).toMatch(/drafts the prioritized frontier and recommendations, except for an arena-grade question[^.]*drafts no recommendation until the candidates and judge verdicts return/);
  const contracts = compact('skills/axstack/references/contracts.md');
  expect(contracts).toMatch(/forms an independent assessment first[^.]*\. The one exception is an arena-grade Align question[^.]*driver assesses only after the candidates and judge verdicts return/);
});

test('align arena: advisers author, judges judge, driver picks and grafts', () => {
  const text = compact('skills/axstack-align/SKILL.md');
  for (const phase of ['Frame', 'Fan out', 'Cross-judge', 'Pick', 'Graft', 'Present']) {
    expect(text, `phase ${phase}`).toMatch(new RegExp(`\\d\\. \\*\\*${phase}\\.\\*\\*`));
  }
  expect(text).toMatch(/three to six gradeable rubric criteria/i);
  expect(text).toMatch(/candidates receive only the brief/i);
  for (const id of ['axstack-advisor-astra', 'axstack-advisor-fable', 'axstack-arena-candidate-grok', 'axstack-arena-candidate-antigravity']) expect(text).toContain(id);
  expect(text).toMatch(/one candidate per configured family[^.]*same brief[^.]*without cross-reading/i);
  expect(text).toMatch(/the driver authors no candidate/i);
  expect(text).toMatch(/axstack-arena-judge-astra[^.]*axstack-arena-judge-fable[^.]*each independently score/i);
  expect(text).toMatch(/anonymized[^.]*relabeled candidates[^.]*rubric/i);
  expect(text).toMatch(/judges never author, never cross-read/i);
  expect(text).toMatch(/reads every candidate end to end/i);
  expect(text).toMatch(/never average verdicts or fabricate consensus/i);
  expect(text).toMatch(/convergence[^.]*adopt the consensus shape, no graft/i);
  expect(text).toMatch(/wide divergence[^.]*reframe and rerun once/i);
  expect(text).toMatch(/spec approval remains the one human checkpoint/i);
});

test('align arena: synthesis lands in Decisions rows and absent seats hold only that question', () => {
  const text = compact('skills/axstack-align/SKILL.md');
  expect(text).toMatch(/synthesis note[^.]*both judge verdicts[^.]*`Decisions` rows/i);
  expect(text).toMatch(/configured candidate or judge seat[^.]*unavailable[^.]*hold that question/i);
  expect(text).toMatch(/user decides whether to proceed without it/i);
  expect(text).toMatch(/uncertain dispatch[^.]*reconcile[^.]*never treated as absent/i);
});

test('align arena: judge seats exist in every preset at xhigh and mirror adviser availability', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    for (const seat of ['astra', 'fable']) {
      const judge = roles.find(({ id }) => id === `axstack-arena-judge-${seat}`);
      const adviser = roles.find(({ id }) => id === `axstack-advisor-${seat}`);
      expect(judge, `${preset}: missing judge ${seat}`).toBeTruthy();
      expect(judge.thinkingOptionId).toBe('xhigh');
      expect(judge.provider).toBe(adviser.provider);
      expect(judge.model).toBe(adviser.model);
      expect(judge.notes).toMatch(/read-only/i);
      expect(judge.notes).toMatch(/never authors a candidate/i);
    }
  }
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/axstack-arena-judge-astra[^.]*axstack-arena-judge-fable[^.]*judge them/);
  expect(routing).toMatch(/axstack-arena-candidate-grok[^.]*axstack-arena-candidate-antigravity[^.]*families/i);
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const roles = readJson(`profiles/presets/${preset}.json`).roles;
    for (const judge of roles.filter(({ id }) => id.startsWith('axstack-arena-judge-'))) {
      expect(judge.notes).toMatch(/every candidate by label/i);
    }
  }
});

test('align arena: scenario corpus covers four families and availability holds', () => {
  const cases = readJson('tests/workflows/align-grilling-scenarios.json').cases;
  const byId = Object.fromEntries(cases.map((item) => [item.id, item]));
  expect(byId['design-rung-2'].expected.join(' ')).toMatch(/Astra[^.]*Fable[^.]*Grok[^.]*Antigravity/i);
  expect(byId['arena-grok-unavailable'].expected.join(' ')).toMatch(/Pause[^.]*Ask the user/i);
  expect(byId['arena-single-provider-hold'].expected.join(' ')).toMatch(/Hold[^.]*single-provider/i);
});
