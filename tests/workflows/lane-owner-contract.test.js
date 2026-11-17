import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = name => readFileSync(`${import.meta.dir}/../../skills/axstack/references/${name}.md`, 'utf8');
const rules = [
  ['pre-settle helper invocation', [/before any settle/i, /run lane-owner/i, /pre-settle snapshot/i],
    'Run lane-owner using the pre-settle snapshot before any settle.', [[/before any settle/i, 'after any settle']]],
  ['failed facts retain holds', [/fail/i, /unknown/i, /retains|preserves/i, /ownership holds/i],
    'For unknown or fail facts, the driver preserves ownership holds.', [[/retains|preserves/i, 'releases']]],
  ['external recorded jobs are explicit', [/pass/i, /out-of-tree PR jobs/i, /--job-thread/],
    'Pass --job-thread for out-of-tree PR jobs.', [[/--job-thread/, '--owner-thread']]],
  ['helper precedes pass-start settlement', [/after/i, /pre-settle lane-owner facts/i, /t3_thread_organize/i, /settle/i],
    'After lane reconciliation and pre-settle lane-owner facts, every pass uses t3_thread_organize to settle predecessors.',
    [[/after/i, 'before']]],
];
for (const [name, concepts, rewording, inversions] of rules) {
  test(`lane owner instruction: ${name}`, () => {
    checkRule(read('automations'), text => requires(text.replaceAll('--no-env-file', 'ENV_DISABLED'), ...concepts), rewording, inversions, concepts);
  });
}

test('a current-pass settle cannot establish release', () => {
  const concepts = [/this pass/i, /settle/i, /never proves/i, /release/i];
  const accepts = text => prohibits(text, /never proves/i, ...concepts);
  checkRule(read('automations'), accepts,
    'A settle written by this pass never proves ownership release.',
    [[/never proves/i, 'always proves']], concepts);
});

test('terminal rows alone cannot establish predecessor exit or release', () => {
  const concepts = [/completed/i, /failed/i, /run row alone/i, /proves neither/i, /predecessor exit/i, /release/i];
  const accepts = text => prohibits(text, /proves neither/i, ...concepts);
  checkRule(read('automations'), accepts,
    'A failed or completed run row alone proves neither release nor predecessor exit.',
    [[/proves neither/i, 'proves both']], concepts);
});

test('continuity retains the report, snapshot and precise lane-owner identities', () => {
  const concepts = [/report (?:path|location)/i, /snapshot/i, /(?:exact|precise) identities/i];
  const accepts = text => {
    const field = text.match(/lane-owner facts:\s*<([^>]+)>/i)?.[1];
    return !!field && concepts.every(concept => concept.test(field));
  };
  checkRule(read('run-record'), accepts,
    'Lane-owner facts: <snapshot, precise identities and report location>',
    [[/identities/i, 'titles']], concepts);
});
