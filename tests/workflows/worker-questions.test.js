import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits } from './prose-contract.js';

const copies = ['skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/lifecycle.md', 'docs/workflows.md'];
const rules = [
  ['native detection', [/delegated child/i, /detect|find/i, /questions/i,
    /t3_pending_request_list\(childThreadId\)/],
  'Find questions from a delegated child using t3_pending_request_list(childThreadId).',
  [/t3_pending_request_list\(childThreadId\)/, 'task_status.hasPendingQuestion']],
  ['flag alone is insufficient', [/hasPendingQuestion alone/i],
  'For question detection, hasPendingQuestion alone must never be relied on.',
  [/never (?:rely on|be relied on)/i, 'always rely on'], /never (?:rely on|be relied on)/i],
  ['read, confirm and answer in order', [/t3_pending_request_read.*then confirm.*still pending.*then answer (?:only )?once (?:within|under) existing authority.*t3_pending_request_respond/i],
  'First call t3_pending_request_read, then confirm it is still pending, then answer only once under existing authority via t3_pending_request_respond.',
  [/then confirm.*?then answer (?:only )?once/i, 'then answer once before confirming it is still pending']],
  ['second ask holds', [/second ask/i, /holds?|held/i],
  'A second ask is held.', [/holds?|held/i, 'continues']],
  ['fresh review rounds', [/independent review rounds|each independent review round/i, /(?:fresh|new) delegate_task/i],
  'For each independent review round, start a new delegate_task.',
  [/(?:fresh|new) delegate_task/i, 'same-child follow-up']],
  ['same-child restriction', [/only|limited to/i, /author continuation/i, /(?:a|the|that) child.s own question/i, /same child/i],
  "Reuse of the same child is limited to author continuation or an answer to that child's own question.",
  [/only|limited to/i, 'arbitrarily including']],
  ['marker fallback', [/providers without a question tool/i, /grok/i, /antigravity/i,
    /launched writers/i, /AXSTACK-QUESTION/i, /keep|retain/i],
  'Launched writers and providers without a question tool (grok, antigravity) retain the AXSTACK-QUESTION marker route.',
  [/keep|retain/i, 'discard'], /without a question tool/i],
];

// Each shipped copy is an instruction boundary; removal/inversion must fail
// there even if another copy remains correct. Rewordings keep intent, not bytes.
for (const path of copies) {
  for (const [name, concepts, rewording, inversion, negative] of rules) {
    test(`worker questions: ${name} in ${path}`, () => {
      const source = readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replaceAll('`', '').replace(/\s+/g, ' ');
      const accepts = negative ? (text) => prohibits(text, negative, ...concepts)
        : (text) => requires(text, ...concepts);
      checkRule(source, accepts, rewording, [inversion], concepts);
    });
  }
}

for (const [name, concepts, rewording, inversions] of [
  ['delegated questions keep native wakes', [/delegated-child questions/i, /retain native completion paths/i,
    /60-minute backstop/i, /when other recovery conditions are clear/i],
  'When other recovery conditions are clear, delegated-child questions retain native completion paths and use the 60-minute backstop.',
  [[/retain native completion paths/i, 'lose native completion paths'], [/60-minute backstop/i, '5-minute recovery cadence']]],
  ['marker follow-up records the new native task', [/delegated marker question/i, /answer once/i,
    /t3_thread_send\(childThreadId, mode:queue\)/, /record.*returned taskId/i, /delegated terminal checks/i],
  'For a delegated marker question, answer once via t3_thread_send(childThreadId, mode:queue), record the returned taskId, and use delegated terminal checks.',
  [[/record.*returned taskId/i, 'discard the returned taskId'], [/delegated terminal checks/i, 'original summary alone']]],
]) {
  test(`worker questions: ${name}`, () => {
    const path = name.startsWith('delegated') ? 'skills/axstack-watch/references/watch-runtime.md' : copies[0];
    const text = readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replaceAll('`', '').replace(/\s+/g, ' ');
    checkRule(text, (source) => requires(source, ...concepts), rewording, inversions, concepts);
  });
}
