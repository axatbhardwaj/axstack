import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

function rule(name, path, concepts, paraphrase, direction, inverse, ban) {
  test(`R7.5 ${name}; removal/inversion/rewording`, () => {
    const source = readFileSync(`${import.meta.dir}/../../skills/axstack/references/${path}.md`, 'utf8')
      .replace(/`/g, '').replace(/\s+/g, ' ');
    checkRule(source, (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts),
      paraphrase, [[direction, inverse]], concepts);
  });
}
rule('owner wake suppresses only before eligibility or during same-key delivery', 't3-runtime',
  [/wake suppresses recovery only/i, /before.*recorded nextEligibleCheck/i,
    /same-key wake delivery/i, /queued or running/i, /owner thread/i],
  'An owner wake suppresses recovery only before the recorded nextEligibleCheck or while same-key wake delivery is queued or running in the owner thread.',
  /only/i, 'always including');
rule('armed undelivered or incapable watches do not suppress recovery', 't3-runtime',
  [/armed unfired watch/i, /schedule/i, /unable to observe the named blocker/i, /suppress(?:es)? eligible recovery/i],
  'An armed unfired watch or schedule, or one unable to observe the named blocker, never suppresses eligible recovery.',
  /never/i, 'always', /never/i);
rule('wake receipt identifies actual condition delivery', 'run-record',
  [/bind/i, /queued\/running wake receipts/i, /recovery key/i, /exact queue\/run IDs/i],
  'Bind queued/running wake receipts to the recovery key and exact queue/run IDs.', /bind/i, 'detach');
rule('run activation is gated by canary and exact ownership facts', 't3-runtime',
  [/run-scoped activation requires/i, /passing canary receipts/i, /recovery host\/thread/i,
    /schedule ID/i, /scope/i, /model\/effort/i, /finite budget/i, /expiry/i, /cleanup owner/i],
  'Run-scoped activation requires passing canary receipts plus recorded recovery host/thread, schedule ID, scope, model/effort, finite budget, expiry and cleanup owner.',
  /requires/i, 'bypasses');
rule('already authorized canary needs no repeat approval', 't3-runtime',
  [/already authorized bounded canary/i, /run-scoped activation/i, /need no repeat approval/i, /conditions/i],
  'The already authorized bounded canary and run-scoped activation need no repeat approval when those conditions pass.',
  /need no repeat approval/i, 'need another approval', /need no repeat approval/i);
rule('persistent shared service retains separate authority gate', 't3-runtime',
  [/persistent shared service/i, /requires/i, /separate explicit user authorization/i],
  'A persistent shared service requires separate explicit user authorization.', /requires/i, 'bypasses');
