import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const shared = (name) => read(`skills/axstack/references/${name}.md`).replace(/\s+/g, ' ');
const rules = [
  ['role-roster', 'writer floor exception', [/same.binding/i, /package/i, /integration/i, /independent.PR authors/i, /exempt/i, /blanket/i, /floor/i],
    'Same-binding package, integration and independent-PR authors are exempt from the blanket mixed fanout floor.', [/are exempt/i, 'remain subject to']],
  ['role-roster', 'distinct brief exception', [/distinct.brief nonwriter packages/i, /eligible configured roles/i, /exempt/i, /blanket/i, /floor/i],
    'Distinct-brief nonwriter packages with eligible configured roles are exempt from the blanket mixed fanout floor.', [/are exempt/i, 'remain subject to']],
  ['run-record', 'package close-out counts', [/report/i, /packages identified/i, /launched/i, /completed/i, /serialized/i, /reasons/i],
    'Report packages identified, launched, completed and serialized with reasons.', [/report/i, 'omit']],
  ['run-record', 'execution overlap distinct', [/record/i, /native execution overlap/i, /separately/i, /queued/i, /parallel tool calls/i],
    'Record native execution overlap separately from queued work and parallel tool calls.', [/separately/i, 'indistinguishably']],
  ['perf-loop', 'noncontending parallel preparation', [/permit/i, /parallel/i, /non.measuring preparation/i, /isolated non.contending/i, /probes/i],
    'Permit parallel non-measuring preparation or probes in isolated non-contending environments.', [/permit/i, 'forbid']],
  ['perf-loop', 'probes consume attempts', [/every attempted/i, /candidate.effect probe/i, /consumes/i, /existing attempt budget/i],
    'Every attempted candidate-effect probe consumes the existing attempt budget.', [/consumes/i, 'bypasses']],
  ['ui-improvement-loop', 'noncontending parallel preparation', [/permit/i, /parallel/i, /non.measuring preparation/i, /isolated non.contending/i, /probes/i],
    'Permit parallel non-measuring preparation or probes in isolated non-contending environments.', [/permit/i, 'forbid']],
  ['ui-improvement-loop', 'probes consume attempts', [/every attempted/i, /candidate.effect probe/i, /consumes/i, /existing attempt budget/i],
    'Every attempted candidate-effect probe consumes the existing attempt budget.', [/consumes/i, 'bypasses']],
  ['routing', 'repository analysis only', [/repository.mode/i, /Correct/i, /Cleanup/i, /permit/i, /bounded read.only evidence analysis/i, /existing/i, /roles/i],
    'In repository-mode Correct and Cleanup, permit bounded read-only evidence analysis using existing research/exploration roles.', [/permit/i, 'forbid']],
  ['diligence', 'all receipt coverage', [/before candidate publication/i, /check/i, /every package/i, /integration receipt/i, /evidence/i],
    'Before candidate publication, check every package and integration receipt against its evidence.', [/check/i, 'skip']],
];
for (const [file, name, concepts, rewording, inversion] of rules) {
  test(`parallel-first compatibility: ${file} ${name} (removal/inversion/rewording)`, () => {
    checkRule(shared(file), (text) => requires(text, ...concepts), rewording, [inversion], concepts);
  });
}

for (const name of ['lifecycle', 'routing', 'role-roster', 'autopilot', 'run-record', 't3-runtime', 'candidate-publication', 'local-artifacts']) {
  test(`${name} explicitly follows the shared package contract`, () => {
    const source = read(`skills/axstack/references/${name}.md`);
    const accepts = (text) => loadedReferences(text).some((link) => link === 'parallel-first.md');
    expect(accepts(source)).toBe(true);
    const directive = source.split(/\n\s*\n/).find(accepts);
    expect(accepts(source.replace(directive, ''))).toBe(false);
    expect(accepts(source.replace(directive, 'Never follow [Parallel-first](parallel-first.md).'))).toBe(false);
    expect(accepts(source.replace(directive, 'Consult [Parallel-first](parallel-first.md).'))).toBe(true);
  });
}
