import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = () => readFileSync(`${import.meta.dir}/../../skills/axstack/references/ui-verification.md`, 'utf8');
const credit = 'https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/create-verification-skill/SKILL.md';

// AC10 owns proof quality here; existing UI contracts cover dispatch and artifact
// binding, not user paths, observed effects, dry-run skips or surviving cleanup.
// Mutate real-source sentences in memory; no production test hook or file writes.
const rules = [
  ['verifier candidate and page proof scope', [/apply|use/i, /standards/i, /verifier/i, /candidate checks/i, /inline-page interaction pass/i],
    [/apply|use/gi, 'waive'], 'Use these standards for verifier candidate checks and the inline-page interaction pass.'],
  ['real user path', [/drive|exercise/i, /real user path/i],
    [/real user path/gi, 'internal setter path'], 'Exercise the real user path.'],
  ['action, state and effects', [/capture|record/i, /action/i, /resulting state|outcome/i, /side effects/i],
    [/capture|record/gi, 'omit'], 'Record the action, the outcome and its side effects.'],
  ['observed dry-run skips', [/dry.run/i, /verify|check/i, /skip\w*/i, /observ\w*|inspect\w*/i],
    [/observ\w*|inspect\w*/gi, 'assuming'], 'For a dry-run claim, check what it skips by inspecting files, network calls or Git refs.'],
  ['evidence survives cleanup', [/keep|retain/i, /evidence/i, /private evidence folder/i, /after (?:cleanup|teardown)/i],
    [/after/gi, 'only before'], 'Retain evidence in the private evidence folder after teardown.'],
];

for (const [name, concepts, inversion, rewording] of rules) {
  test(`UI proof standards: ${name}`, () => {
    // Normalize real source so mutations also reach instructions wrapped in Markdown.
    const text = sentences(read()).join('. ');
    const accepts = (source) => requires(source, ...concepts);
    checkRule(text, accepts, rewording, [inversion, [/^/, 'Do not ']], concepts);
  });
}

test('UI proof standards: pinned source credit and license', () => {
  const text = read();
  expect(text).toContain(credit);
  expect(requires(text, /paraphrased/i, /pstack/i, /create-verification-skill/i, /MIT/i)).toBe(true);
});
