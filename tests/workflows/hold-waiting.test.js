import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';

// General decision holds end a turn; only eligible parked holds disable wakes.
for (const path of [
  'skills/axstack/references/autopilot.md',
  'skills/axstack/references/test-audit-weekly.md',
  'skills/axstack-implement/SKILL.md',
  'skills/axstack-review/SKILL.md',
  'skills/axstack-watch/SKILL.md',
  'skills/axstack-watch/references/escalation.md',
  'skills/axstack-watch/references/proven-verification.md',
  'skills/axstack-watch/references/repair-publication.md',
  'docs/workflows.md',
]) {
  test(`general hold waits for a decision: ${path}`, () => {
    // The quoted card name is data, not a negation of the wait instruction.
    const text = readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
      .replaceAll('`verification not proven`', 'verification-gap').replace(/\s+/g, ' ');
    const concepts = [/end(?:s)? (?:its|the) turn/i, /waiting on/i];
    checkRule(text, (source) => requires(source, ...concepts),
      'End the turn waiting on the user to decide.', [[/waiting on/i, 'disregarding']], concepts);
  });
}
