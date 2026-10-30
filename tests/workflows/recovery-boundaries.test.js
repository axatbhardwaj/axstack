import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8');
const runtime = 'axstack/references/t3-runtime.md';
const cleanup = 'axstack-cleanup/SKILL.md';
function rule(name, path, concepts, paraphrase, direction, inverse, ban) {
  test(`R7c recovery: ${name}; removal/inversion/rewording`, () => {
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(read(path).replace(/`/g, '').replace(/\s+/g, ' '), accepts,
      paraphrase, [[direction, inverse]], concepts);
  });
}
rule('ordinary status remains read-only', runtime,
  [/ordinary status/i, /periodic status sweeps/i, /remain|stay/i, /read-only/i],
  'Ordinary status and periodic status sweeps stay read-only.', /read-only/i, 'mutating');
rule('recovery messages grant no user authority', runtime,
  [/recovery continuation/i, /user reply/i, /answer/i, /approval/i, /authorization/i],
  'A recovery continuation is never a user reply, answer, approval or authorization.', /never/i, 'always', /never/i);
rule('held and uncertain queues are report-only', runtime,
  [/held queues/i, /pending requests/i, /parked user-reply holds/i, /unknown request\/queue state/i, /report-only/i],
  'Held queues, pending requests, parked user-reply holds and unknown request/queue state remain report-only.', /report-only/i, 'eligible');
rule('diagnosis exception needs owner authority and idle state', runtime,
  [/diagnosis: none/i, /specific unexplained non-human blocker/i, /already authorized read-only diagnostic next action/i, /idle/i, /eligible only/i],
  'A diagnosis: none record is eligible only for an idle owner with a specific unexplained non-human blocker and an already authorized read-only diagnostic next action.', /eligible only/i, 'eligible regardless');
rule('recovery contacts exact existing top-level owner only', runtime,
  [/send|deliver/i, /one bounded continuation/i, /exact existing top-level owning Coordinator\/Driver/i, /condition key/i],
  'Deliver one bounded continuation with its condition key to the exact existing top-level owning Coordinator/Driver.', /send|deliver/i, 'discard');
rule('external wake support is verified before promise', runtime,
  [/verify|prove/i, /native PR watch/i, /exact external dependency/i, /before promising/i, /wake/i],
  'Prove native PR watch support for the exact external dependency before promising its wake.', /verify|prove/i, 'assume');
rule('expiry forbids sends even when deletion fails', cleanup,
  [/after expiry/i, /cleanup-only/i, /zero sends/i, /even if deletion failed/i],
  'After expiry, perform cleanup-only with zero sends even if deletion failed.', /zero sends/i, 'unlimited sends');
rule('run completion preserves shared service', cleanup,
  [/run completion/i, /unregisters|removes/i, /only/i, /own registration/i, /preserves/i, /shared service/i, /other registrations/i],
  'Run completion removes only its own registration and preserves the shared service and other registrations.', /preserves/i, 'deletes');
rule('owned schedule exact deletion has absence proof', cleanup,
  [/completion\/cancellation\/handoff/i, /reconcile|verify/i, /ownership/i, /delete only/i, /run-owned schedule IDs/i, /absence readback/i],
  'On completion/cancellation/handoff, verify ownership and delete only run-owned schedule IDs with absence readback.', /delete only/i, 'delete all');
rule('cleanup never consumes user messages', cleanup,
  [/preserve|retain/i, /user messages/i, /shared persistent schedules/i],
  'Retain user messages and shared persistent schedules.', /preserve|retain/i, 'delete');
rule('unknown cleanup state does not repeat delivery', cleanup,
  [/unknown deletion or queue state/i, /scoped cleanup finding/i, /never/i, /redo product work/i],
  'Unknown deletion or queue state is a scoped cleanup finding, never a reason to redo product work.', /never/i, 'always', /never/i);

test('R7c watch and cleanup load recovery authority and registration contracts', () => {
  for (const path of ['axstack-watch/SKILL.md', cleanup]) {
    expect(loadedReferences(read(path)).some((link) => link.endsWith('t3-runtime.md#bounded-recovery-boundary'))).toBe(true);
  }
});
