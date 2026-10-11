import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
// Written decision contracts, not a runtime eligibility engine or live proof.
const rules = [
  ['workspace-hygiene.md', 'every writer follow-up uses acceptance settlement',
    [/every writer follow-up/i, /rebase/i, /base update/i, /conflict/i, /body/i, /receipt/i, /repair/i, /same.turn settlement and readback/i],
    'Every writer follow-up, including receipt, body, conflict, base update and rebase changes, counts as repair for same-turn settlement and readback.',
    [/every writer follow-up/i, 'only source repairs']],
  ['workspace-hygiene.md', 'latest overall run gates settlement',
    [/immediately before settlement/i, /require/i, /accepted run/i, /latest overall run/i, /current/i, /native state/i],
    'Immediately before settlement require native state proving the accepted run is current and the latest overall run.',
    [/latest overall run/i, 'latest terminal run']],
  ['workspace-hygiene.md', 'active and queued work and descendants prevent hiding',
    [/before settlement/i, /verify/i, /zero active, pending or queued work/i, /zero unsettled descendants/i],
    'Before settlement verify zero unsettled descendants and zero active, pending or queued work.',
    [/zero active, pending or queued work/i, 'active, pending or queued work is allowed'],
    [/zero active, pending or queued work/i, /zero unsettled descendants/i]],
  ['workspace-hygiene.md', 'acceptance and sidebar metadata are separate',
    [/successful receipt acceptance/i, /distinct from/i, /T3 sidebar settlement/i, /metadata/i],
    'Successful receipt acceptance is distinct from T3 sidebar settlement metadata.',
    [/distinct from/i, 'identical to']],
  ['workspace-hygiene.md', 'fresh inventory precedes absence and cadence claims',
    [/before/i, /zero.unsettled claim/i, /cadence relaxation/i, /handback/i, /Close.out/i, /fresh/i, /fully paginated native inventory/i, /run.owned writers/i, /delegated children/i, /known orphans/i, /already.settled/i, /unconsumed results/i],
    'Before any zero-unsettled claim, cadence relaxation, handback or Close-out, read a fresh fully paginated native inventory of run-owned writers, delegated children and known orphans, including already-settled threads with unconsumed results.',
    [/before/i, 'after']],
  ['workspace-hygiene.md', 'inventory gaps hold only affected claims',
    [/incomplete inventory/i, /unknown ownership/i, /UNKNOWN/i, /holds only/i, /affected claim or transition/i],
    'Unknown ownership or incomplete inventory records UNKNOWN and holds only the affected claim or transition.',
    [/holds only/i, 'permits']],
  ['workspace-hygiene.md', 'cancellation is not successful acceptance',
    [/cancellation disposition/i, /separate from successful acceptance/i, /native terminal cancellation/i, /exact attempt identity/i, /driver reason/i, /preservation pointers/i],
    'Cancellation disposition remains separate from successful acceptance and requires native terminal cancellation, exact attempt identity, a driver reason and preservation pointers.',
    [/separate from successful acceptance/i, 'successful acceptance']],
  ['workspace-hygiene.md', 'cancellation has independent protection guards',
    [/cancellation disposition/i, /requires/i, /zero live or queued work/i, /zero unsettled descendants/i, /zero user takeover/i, /zero unanswered questions/i, /zero QUESTION or FAILED markers/i, /zero serious.risk holds/i],
    'Cancellation disposition requires zero live or queued work, zero unsettled descendants, zero user takeover, zero unanswered questions, zero QUESTION or FAILED markers and zero serious-risk holds.',
    [/zero live or queued work/i, 'live or queued work is allowed'],
    [/zero live or queued work/i, /zero unsettled descendants/i, /zero user takeover/i, /zero unanswered questions/i, /zero QUESTION or FAILED markers/i, /zero serious.risk holds/i]],
  ['automations.md', 'retirement names predecessor and failed successor passes',
    [/retirement settles remaining/i, /predecessor/i, /duplicate/i, /failed.successor/i, /threads/i, /t3_thread_organize/i],
    'Retirement settles remaining predecessor, duplicate and failed-successor pass threads with t3_thread_organize.',
    [/settles remaining/i, 'leaves active']],
];

for (const [path, name, concepts, wording, inversion, masks = []] of rules) {
  test(`completion guards: ${name}`, () => {
    const accepts = (text) => sentences(text).some((clause) =>
      concepts.every((concept) => concept.test(clause))
      && !/\b(?:unless|except|allow\w*|permit\w*)\b/i.test(clause)
      && requires(masks.reduce((rest, mask) => rest.replace(mask, ''), clause), /^/));
    checkRule(sentences(read(`skills/axstack/references/${path}`)).join('. '),
      accepts, wording, [inversion], concepts);
  });
}

test('workflow summary keeps every follow-up in same-turn settlement', () => {
  const concepts = [/every writer follow-up/i, /rebase/i, /base update/i, /conflict/i, /body/i, /receipt/i, /same.turn settlement and readback/i];
  checkRule(sentences(read('docs/workflows.md')).join('. '), (text) => requires(text, ...concepts),
    'Every writer follow-up, including rebase, base update, conflict, body and receipt changes, follows same-turn settlement and readback.',
    [[/same.turn/i, 'later-turn']], concepts);
});
