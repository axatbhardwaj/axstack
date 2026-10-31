import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const reference = '../axstack/references/independent-delivery.md';
const phases = ['spec', 'tickets', 'implement'];
const entries = Object.fromEntries(phases.map((phase) => [phase, read(`skills/axstack-${phase}/SKILL.md`)]));
// An absent load is an instruction failure, never a missing-module/setup red.
const loaded = (phase) => loadedReferences(entries[phase]).includes(reference)
  && existsSync(`${import.meta.dir}/../../skills/axstack/references/independent-delivery.md`)
  ? read('skills/axstack/references/independent-delivery.md').replace(/\s+/g, ' ') : '';

for (const phase of phases) {
  test(`${phase} explicitly loads independent delivery`, () => {
    expect(loadedReferences(entries[phase])).toContain(reference);
    expect(loaded(phase)).toMatch(/independently deliverable outcomes/i);
    const directive = entries[phase].split(/\n\s*\n/).find((paragraph) => paragraph.includes(reference));
    const accepts = (text) => loadedReferences(text).includes(reference);
    expect(accepts(entries[phase].replace(directive, ''))).toBe(false);
    expect(accepts(entries[phase].replace(directive,
      directive.replace(/load and follow/i, 'never load or follow')))).toBe(false);
    expect(accepts(entries[phase].replace(directive,
      `Before this phase, consult [Independent delivery](${reference}).`))).toBe(true);
  });
}

// Observable loaded-instruction contracts, not a scheduler or model-decision test.
// Each rule rejects deletion, concept removal and inversion, and accepts paraphrase.
const rules = [
  ['Spec outcome interfaces', [/Spec/i, /name|identify/i, /independently deliverable outcomes/i, /acceptance checks/i, /produced/i, /consumed interfaces/i],
    'Spec must identify independently deliverable outcomes with acceptance checks and produced and consumed interfaces.', [/name|identify/i, 'omit']],
  ['Tickets accountable map', [/Tickets/i, /map/i, /each outcome/i, /accountable scope driver/i, /accepted or proposed/i, /write/i, /resource boundaries/i, /dependency milestones/i, /evidence/i, /invalidation/i],
    'Tickets must map each outcome to an accountable scope driver marked accepted or proposed, write and resource boundaries, dependency milestones and evidence with invalidation conditions.', [/must map/i, 'may omit']],
  ['conditional separate drivers', [/default/i, /separate/i, /accountable scope drivers/i, /independent outcomes/i, /\bwhen explicitly authorized/i, /supported/i, /runtime/i],
    'For independent outcomes, default to separate accountable scope drivers when explicitly authorized and supported by the runtime.', [/when/i, 'unless']],
  ['tasks remain delegates', [/tasks/i, /within/i, /accepted scope/i, /remain/i, /native delegates/i, /accountable driver/i],
    'Tasks within the accepted scope remain native delegates of its accountable driver.', [/remain/i, 'stop being']],
  ['reuse current ownership', [/reuse/i, /accepted owners/i, /current attempts/i, /before/i, /new drivers/i],
    'Before proposing new drivers, reuse accepted owners and current attempts.', [/reuse/i, 'discard']],
  ['launch-only hold', [/missing/i, /new.driver launch permission/i, /holds only/i, /that launch/i, /dependency/i, /scoped.hold/i],
    'Missing new-driver launch permission holds only that launch under dependency and scoped-hold rules.', [/holds only/i, 'holds everything beyond']],
  ['accepted existing work progresses', [/existing driver/i, /progress/i, /only/i, /work/i, /already inside/i, /accepted authority/i],
    'The existing driver can progress only work already inside its accepted authority.', [/only/i, 'regardless of whether']],
  ['new outcomes during implementation', [/during Implement/i, /admit newly discovered independent outcomes/i, /same/i, /scope/i, /interface/i, /dependency map/i],
    'During Implement, admit newly discovered independent outcomes through the same scope, interface and dependency map.', [/admit newly discovered/i, 'ignore newly discovered']],
  ['reconciliation before dispatch', [/before dispatch/i, /reconcile/i, /semantic and write conflicts/i, /milestone and revision evidence/i, /ownership/i, /current attempts/i, /writer exclusivity/i, /capacity/i, /native and forge state/i],
    'Before dispatch, reconcile semantic and write conflicts, milestone and revision evidence, ownership and current attempts, writer exclusivity and capacity with native and forge state.', [/before dispatch/i, 'after dispatch']],
  ['branch on actual code ancestry', [/use/i, /main/i, /integration target/i, /branch base/i, /unless/i, /genuine unfinished code predecessor/i, /exact reviewed revision/i],
    'Use main or the integration target as branch base unless a genuine unfinished code predecessor requires its exact reviewed revision.', [/unless/i, 'even when']],
  ['artifact milestone differs from ancestry', [/artifact.only dependency/i, /\bcan be satisfied/i, /accepted immutable interface or artifact milestone/i, /without Git ancestry/i],
    'An artifact-only dependency can be satisfied by an accepted immutable interface or artifact milestone without Git ancestry.', [/can be satisfied/i, 'cannot be satisfied']],
  ['execution binds evidence', [/bind/i, /each consumed milestone/i, /actual current evidence/i, /at execution/i, /producer revision/i, /immutable artifact identity/i, /receipt/i, /acceptance state/i],
    'At execution, bind each consumed milestone to actual current evidence with producer revision or immutable artifact identity, receipt and acceptance state.', [/actual current evidence/i, 'assumed future evidence']],
  ['invalidate affected consumers', [/producer revision changes/i, /invalidate/i, /affected consumer evidence/i, /revalidate/i, /unrelated scopes progress/i],
    'When a producer revision changes, invalidate affected consumer evidence and revalidate it while unrelated scopes progress.', [/invalidate/i, 'retain']],
  ['uncertain dependency hold', [/unknown or stale/i, /dependency evidence/i, /holds/i, /affected consumers/i, /until reconciled/i],
    'Unknown or stale dependency evidence holds affected consumers until reconciled.', [/holds/i, 'advances']],
];

for (const [name, concepts, rewording, inversion] of rules) {
  test(`independent delivery: ${name} rejects removal/inversion and accepts rewording`, () => {
    checkRule(loaded('spec'), (text) => requires(text, ...concepts), rewording, [inversion], concepts);
  });
}

for (const [name, concepts, rewording] of [
  ['planning grants no authority', [/planning/i, /grants/i, /launch permission/i, /execution authority/i],
    'Planning never grants launch permission or execution authority.'],
  ['worktrees prove no independence', [/separate worktrees/i, /prove/i, /semantic independence/i],
    'Separate worktrees never prove semantic independence.'],
]) {
  test(`independent delivery: ${name} rejects removal/inversion and accepts rewording`, () => {
    checkRule(loaded('spec'), (text) => prohibits(text, /never/i, ...concepts),
      rewording, [[/never/i, 'always']], concepts);
  });
}
