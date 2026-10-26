import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = (name) => sentences(readFileSync(`${import.meta.dir}/../../skills/axstack/references/${name}.md`, 'utf8').replace(/`/g, '')).join('. ');
const passes = ['automations', 'review-manager-prompt', 'pr-triage-nightly', 'test-audit-weekly'];
const guards = [/owns no PR watch/i, /zero unsettled descendants/i, /no pending receipt/i, /not held, wedged or a stalled owner/i];
const action = [/at pass end/i, /unbound/i, /t3_thread_organize/i, /action: settle/i, /own thread only/i, /only when/i];
const wording = 'Only when it has no pending receipt, is not held, wedged or a stalled owner, owns no PR watch and has zero unsettled descendants, the unbound scheduled pass must at pass end request action: settle through t3_thread_organize for its own thread only.';
const accepts = (text) => sentences(text).some((s) => [...action, ...guards].every((r) => r.test(s))
  && requires(guards.reduce((v, r) => v.replace(r, ''), s), /^/)
  && !/\b(?:unless|except|allow\w*|permit\w*)\b/i.test(s));

for (const path of passes) {
  test(`pass self-settle: ${path} owns the guarded end action`, () => {
    checkRule(read(path), accepts, wording,
      [[/own thread only/i, 'any thread'], [/only when/i, 'even when'],
        [/owns no PR watch/i, 'owns a PR watch'], [/zero unsettled descendants/i, 'active descendants'],
        [/no pending receipt/i, 'a pending receipt'], [/not held, wedged or a stalled owner/i, 'held, wedged or a stalled owner'],
        [/action: settle/i, 'action: archive'], [/^/, 'Never ']], [...action, ...guards]);
  });
}

const rules = [
  ...['automations', 't3-runtime', 'workspace-hygiene'].map((path) => [path, 'deferred exception and next-pass verification',
    [/self.settle/i, /one exception/i, /terminal.before.settle/i, /settlesWhenTurnEnds:true/i, /next pass/i, /verif\w*/i, /settled: true/i],
    'The next pass must verify settled: true after T3 reports settlesWhenTurnEnds:true for self-settle, the one exception to terminal-before-settle.',
    [[/one exception/i, 'no exception'], [/settled: true/i, 'settled: false'], [/next pass/i, 'unrelated thread']]]),
  ['t3-runtime', 'visible titles at launch and rename',
    [/visible.*driver.*titles/i, /plain outcome/i, /at most 30 characters/i, /launch and rename/i],
    'At launch and rename, visible driver thread titles express a plain outcome of at most 30 characters.',
    [[/at most 30 characters/i, 'unlimited length'], [/launch and rename/i, 'launch only']]],
  ['t3-runtime', 'visible title prefix prohibition',
    [/visible.*driver.*titles/i, /no repo, issue or size prefix/i],
    'Visible driver thread titles use no repo, issue or size prefix.',
    [[/no repo, issue or size prefix/i, 'a repo, issue or size prefix']], [/no repo, issue or size prefix/i]],
  ['t3-runtime', 'hidden children retain dispatch identity',
    [/hidden children/i, /keep|retain/i, /dispatch.key titles/i],
    'Hidden children retain dispatch-key titles.', [[/dispatch.key titles/i, 'short outcome titles']]],
  ['workspace-hygiene', 'native attribution excludes driver settle',
    [/record settle: native only/i, /no driver settle was issued/i, /that thread/i],
    'Record settle: native only when no driver settle was issued for that thread.',
    [[/no driver settle was issued/i, 'a driver settle was issued']], [/no driver settle was issued/i]],
];
for (const [path, name, concepts, rewording, inversions, masks = []] of rules) {
  test(`pass self-settle: ${path} ${name}`, () => {
    const check = (text) => sentences(text).some((s) => concepts.every((r) => r.test(s))
      && requires(masks.reduce((v, r) => v.replace(r, ''), s), /^/));
    checkRule(read(path), check, rewording, [...inversions, [/^/, 'Never ']], concepts);
  });
}
