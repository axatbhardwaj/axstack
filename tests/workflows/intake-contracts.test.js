import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, sentences } from './prose-contract.js';

const denied = /\b(?:no|not|never|skip|avoid\w*|optional|may)\b/i;

const source = (name = 'fleet-dispatch.md') => readFileSync(`${import.meta.dir}/../../skills/axstack/references/${name}`, 'utf8')
  .replaceAll('`', '').replace(/\s+/g, ' ');
const rules = [
  ['intake only', [/only/i, /new user.started/i, /before/i, /first.*dispatch/i],
    'Route only new user-started tasks at intake before the first worker dispatch.'],
  ['scheduled exclusion', [/scheduled/i, /status/i, /follow.up/i, /stay local/i],
    'Scheduled work, status requests and follow-up work must stay local.'],
  ['explicit named host (pilot)', [/must/i, /explicit named host/i, /pilot/i, /placement request/i],
    'The driver must honor the placement request for an explicit named host (pilot).'],
  ['once', [/must/i, /routed marker/i, /prevent/i, /second routing/i, /mid.task/i],
    'The driver must use the routed marker to prevent second routing and mid-task hand-off.'],
  ['support', [/must/i, /write/i, /support/i, /launching host/i, /provider/i, /named.host pilot/i, /outcome/i],
    'The driver must write support per launching host and provider from the named-host pilot outcome.'],
  ['clone', [/must/i, /clone/i, /through T3/i, /missing/i, /failed clone/i, /ineligible/i],
    'The driver must clone a missing repo through T3 and a failed clone makes the host ineligible.'],
  ['acceptance only', [/must/i, /first run/i, /only/i, /acceptance/i, /AXSTACK-ACCEPT/i, /AXSTACK-HANDBACK/i],
    'The destination first run must check only acceptance and end with exactly AXSTACK-ACCEPT or AXSTACK-HANDBACK <reason>.'],
  ['origin ownership', [/must/i, /origin/i, /owns/i, /until/i, /accept/i],
    'The origin must remain the owner and owns the task until the destination accepts.'],
  ['accept before proceed', [/only after/i, /AXSTACK-ACCEPT/i, /link/i, /one proceed/i, /clientRequestId/i, /stop/i],
    'Only after AXSTACK-ACCEPT, record the destination link, send one proceed with a stable clientRequestId and stop origin execution.'],
  ['wait next', [/must/i, /acceptance/i, /proceed/i, /wait/i, /next/i, /hold/i, /active/i, /unconfirmed/i],
    'Both acceptance and proceed waits must follow the wait tool next and hold while active or unconfirmed.'],
  ['no call', [/must/i, /no launch call/i, /unsupported/i, /no eligible/i, /pre.launch/i, /stay local/i],
    'With no launch call because of unsupported runtime, no eligible host or pre-launch failure, the origin must stay local.'],
  ['handback', [/must/i, /AXSTACK-HANDBACK/i, /continue locally/i],
    'After AXSTACK-HANDBACK the origin must continue locally.'],
  ['handback terminates routing', [/hand.back/i, /terminal/i, /routed marker/i, /do not try another destination/i],
    'Hand-back is terminal for routing, preserve the routed marker and do not try another destination.'],
  ['zero matches holds', [/zero matches/i, /after a launch call/i, /holds?/i],
    'Zero matches after a launch call require a hold.'],
  ['retry', [/must/i, /error/i, /lost.*reply/i, /retry once/i, /same clientRequestId/i],
    'On error or a lost launch reply, the origin must retry once with the same clientRequestId.'],
  ['search all', [/must/i, /launch key/i, /fully paginated/i, /includeSubagents:true/i, /destination/i],
    'The origin must search the destination by launch key using fully paginated t3_thread_list with includeSubagents:true.'],
  ['verified match', [/must/i, /one verified match/i, /wait/i, /first run/i],
    'For one verified match the origin must wait for its first run.'],
  ['ambiguity hold', [/must hold/i, /multiple matches/i, /incomplete listing/i, /readback mismatch/i, /never starts/i, /silent first run/i, /exactly one marker/i],
    'The origin must hold for multiple matches, incomplete listing, readback mismatch, a run that never starts or a silent first run without exactly one marker.'],
  ['switch', [/must/i, /intakeRouting/i, /only/i, /automatic decision/i, /missing.*false/i],
    'intakeRouting must gate only the automatic decision, with missing meaning false.'],
];

for (const name of ['fleet-dispatch.md', 'fleet-route-schema.md', 'fleet-verification.md']) {
  test(`${name}: pilot success records the launching host and provider with evidence`, () => {
    const concepts = [/success/i, /driver/i, /must/i, /write/i, /support record/i,
      /launching host/i, /provider/i, /fleet-routing\.json/i, /evidence/i];
    const accepts = (value) => sentences(value).some((s) => concepts.every((c) => c.test(s)) && !denied.test(s));
    checkRule(source(name), accepts,
      'After pilot success the driver must write a support record in fleet-routing.json for the launching host and provider, with evidence.',
      [[/must/i, 'skip']], concepts);
  });
  test(`${name}: pilot failure removes the destination without writing support`, () => {
    const concepts = [/fail/i, /driver/i, /must/i, /remove/i, /named destination host/i,
      /pool list/i, /write no support record/i];
    const accepts = (value) => sentences(value).some((s) => concepts.every((c) => c.test(s))
      && !denied.test(s.replace(/write no support record/i, 'condition')));
    checkRule(source(name), accepts,
      'If the pilot fails, the driver must remove the named destination host from the pool list and write no support record.',
      [[/must/i, 'skip'], [/write no support record/i, 'write a support record']], concepts);
  });
}

test('runtime names the pilot support-record exemption', () => {
  const concepts = [/explicit named host/i, /pilot/i, /needs no support record/i];
  const accepts = (value) => sentences(value).some((s) => concepts.every((c) => c.test(s))
    && !denied.test(s.replace(/needs no support record/i, 'condition')));
  checkRule(source('t3-runtime.md'), accepts,
    'An explicit named host (pilot) needs no support record.',
    [[/needs no support record/i, 'requires a support record']], concepts);
});

for (const [name, concepts, equivalent] of rules) test(`intake semantic contract: ${name}`, () => {
  const accepts = (value) => sentences(value).some((s) => concepts.every((c) => c.test(s))
    && !denied.test(s.replace(/no launch call|no eligible host|never starts|without exactly one marker|do not try another destination/gi, 'condition')));
  const inversion = name === 'handback terminates routing' ? [/do not try/i, 'may try']
    : name === 'zero matches holds' ? [/hold/i, 'skip'] : [/must|only/i, 'skip'];
  checkRule(source(), accepts, equivalent, [inversion], concepts);
});

for (const [name, concepts, equivalent] of [
  ['one driver', [/never/i, /second driver/i, /first may exist/i], 'Never start a second driver while the first may exist.'],
  ['inside task local', [/never/i, /per.dispatch routing/i, /inside/i, /task/i], 'Never require per-dispatch routing inside a task; all workers stay local.'],
]) test(`intake prohibition: ${name}`, () => {
  checkRule(source(), (s) => sentences(s).some((sentence) => concepts.every((c) => c.test(sentence))
    && !denied.test(sentence.replace(/first may exist/gi, 'first exists').replace(/never/i, ''))),
  equivalent, [[/never/i, 'always']], concepts.slice(1));
});
