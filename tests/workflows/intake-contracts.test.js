import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, prohibits, sentences } from './prose-contract.js';

const source = () => readFileSync(`${import.meta.dir}/../../skills/axstack/references/fleet-dispatch.md`, 'utf8')
  .replaceAll('`', '').replace(/\s+/g, ' ');
const rules = [
  ['intake only', [/only/i, /new user.started/i, /before/i, /first.*dispatch/i],
    'Route only new user-started tasks at intake before the first worker dispatch.'],
  ['scheduled exclusion', [/scheduled/i, /status/i, /follow.up/i, /stay local/i],
    'Scheduled work, status requests and follow-up work must stay local.'],
  ['named host opt-out', [/must/i, /named host/i, /automatic/i, /opt.out/i],
    'The driver must honor a named host as an automatic-routing opt-out.'],
  ['once', [/must/i, /routed marker/i, /prevent/i, /second routing/i, /mid.task/i],
    'The driver must use the routed marker to prevent second routing and mid-task hand-off.'],
  ['support', [/must/i, /support/i, /launching host/i, /provider/i, /first unnamed intake/i],
    'The pilot must record support per launching host and provider from the first unnamed intake.'],
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

for (const [name, concepts, equivalent] of rules) test(`intake semantic contract: ${name}`, () => {
  const accepts = (value) => sentences(value).some((s) => concepts.every((c) => c.test(s))
    && requires(s.replace(/no launch call|no eligible host|never starts|without exactly one marker/gi, 'condition'), /^/));
  checkRule(source(), accepts, equivalent, [[/must|only/i, 'skip']], concepts);
});

for (const [name, concepts, equivalent] of [
  ['one driver', [/never/i, /second driver/i, /first may exist/i], 'Never start a second driver while the first may exist.'],
  ['inside task local', [/never/i, /per.dispatch routing/i, /inside/i, /task/i], 'Never require per-dispatch routing inside a task; all workers stay local.'],
]) test(`intake prohibition: ${name}`, () => {
  checkRule(source(), (s) => sentences(s).some((sentence) => concepts.every((c) => c.test(sentence))
    && prohibits(sentence.replace(/first may exist/gi, 'first exists'), /never/i, /^/)),
  equivalent, [[/never/i, 'always']], concepts.slice(1));
});
