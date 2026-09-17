import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');
const readJson = (path) => JSON.parse(read(path));

// Structural checks for the arena round inside align: who authors, who judges,
// how the pick and graft are bounded, and where the synthesis is recorded.

test('align arena: gated to hard-to-reverse choices and replaces critique for that question', () => {
  const text = compact('skills/axstack-align/SKILL.md');
  expect(text).toMatch(/## Arena for hard-to-reverse design choices/);
  expect(text).toMatch(/same test as for an ADR/i);
  expect(text).toMatch(/small or routine questions never enter the arena/i);
  expect(text).toMatch(/replace the critique round for that question with one arena round/i);
});

test('align arena: advisers author, judges judge, driver picks and grafts', () => {
  const text = compact('skills/axstack-align/SKILL.md');
  for (const phase of ['Frame', 'Fan out', 'Cross-judge', 'Pick', 'Graft', 'Present']) {
    expect(text, `phase ${phase}`).toMatch(new RegExp(`\\d\\. \\*\\*${phase}\\.\\*\\*`));
  }
  expect(text).toMatch(/three to six gradeable rubric criteria/i);
  expect(text).toMatch(/candidates receive only the brief/i);
  expect(text).toMatch(/axstack-advisor-astra[^.]*axstack-advisor-fable[^.]*each independently produce one candidate/i);
  expect(text).toMatch(/the driver authors no candidate/i);
  expect(text).toMatch(/axstack-arena-judge-astra[^.]*axstack-arena-judge-fable[^.]*each independently score/i);
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
  expect(text).toMatch(/adviser or judge seat is unavailable, hold that question without substitution/i);
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
});
