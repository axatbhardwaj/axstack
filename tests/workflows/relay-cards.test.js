import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const relay = 'skills/axstack-relay/SKILL.md';
const hermes = 'skills/axstack-relay/hermes/hermes-skill.md';

// These check the shipped agent instructions, not a test-side decision engine.
// Each independent regression is checked against real source, then removal,
// inversion and equivalent wording. Live model compliance remains a canary.
const rules = [
  ['one decision', [/each card/i, /exactly one decision/i], 'Each card shall carry exactly one decision.'],
  ['unique ID', [/card ID/i, /<run id>\/<n>/, /never reused in the driver thread/i], 'The card ID shall be <run id>/<n>, never reused in the driver thread.'],
  ['driver sender', [/only/i, /run.*driver/i, /send.*reply-dependent cards/i], "Only the run's driver shall send reply-dependent cards."],
  ['labels', [/every card/i, /Driver environment/, /Execution machine/, /Affected targets/, /Revision/], 'Every card shall include Driver environment, Execution machine, Affected targets and Revision lines.'],
  ['missing labels', [/absent.*label|label.*absent/i, /not supplied/], 'An absent label value shall read `not supplied`.'],
  ['registry labels', [/labels/i, /driver.supplied/i, /registry alias/i], 'Labels shall use driver-supplied values or an explicit registry alias.'],
  ['fleet labels', [/fleet release card/i, /each install target/i, /npm/i, /external system/i], 'A fleet release card shall name each install target and npm as an external system.'],
  ['revision', [/Revision: none/, /only.*decisions/i, /neither.*PR head.*spec/i], 'Revision: none shall be used only for decisions concerning neither a PR head nor a spec.'],
  ['ready route', [/before.*reply-dependent send/i, /check.*reply.route readiness/i, /0\.21/, /registry entry/i, /Decisions topic/i, /home DM/i, /busy_input_mode/, /queue/, /hermes mcp test/], 'Before a reply-dependent send, the driver shall check reply-route readiness: Hermes >=0.21, a registry entry with a Decisions topic listed in the verified home DM, effective busy_input_mode queue, and passing hermes mcp test.'],
  ['topic isolation', [/Decisions topic/i, /relay.only/i, /private home DM/i, /auto.loaded/i, /channel_prompts/, /thread ID/i], 'The Decisions topic shall be relay-only in the verified private home DM, with the reply skill auto-loaded and its forward-only channel_prompts keyed by topic thread ID.'],
  ['fallback', [/(?:reply.route )?readiness fails/i, /keep.*options.*tag/i, /replace.*Reply/i, /Act in the T3 thread/i], 'If readiness fails, the driver shall keep the options and tag and replace the Reply line with Act in the T3 thread.'],
  ['proof failure', [/proof failure/i, /rejected acknowledgement/i, /changes? no receipt/i], 'A proof failure shall get a rejected acknowledgement and change no receipt.'],
  ['proof receipt', [/proof/i, /Card line/i, /final tag/i, /sent.*receipt/i, /this run/i, /environment/i, /driver thread/i, /any outcome/i], 'Proof shall require the quote’s Card line and final tag to match a sent receipt of this run, environment and driver thread, with any outcome.'],
  ['delayed reissue', [/delayed reply.*identical reissue/i, /old ID/i], 'A delayed reply after an identical reissue shall still belong to its old ID.'],
  ['delayed other run', [/delayed reply.*another run.*thread/i, /fail(?:s)?.*run.*proof/i], 'A delayed reply from another run in this thread shall fail this run’s proof.'],
  ['partial quote valid', [/partial quote.*Card line.*final tag/i, /pass(?:es)? proof/i, /altered/i, /receipt/i], 'A partial quote retaining the Card line and final tag shall pass proof even with altered option text, because the choice comes from the receipt.'],
  ['partial quote invalid', [/partial quote.*missing.*line/i, /fail(?:s)? proof/i], 'A partial quote missing either line shall fail proof.'],
  ['closed card', [/matched.*card.*not open/i, /already decided/i, /no longer open/i, /no action/i], 'A matched card that is not open shall get already decided or no longer open with no action.'],
  ['stale context', [/open card/i, /task.*revision.*event.*authority.*remote state/i, /changed/i, /superseded/i, /confirmation/i, /cancelled/i], 'An open card whose task, revision, event, authority or remote state changed shall be superseded, or cancelled for a confirmation.'],
  ['unresolved targets', [/unresolved.*machine.*target/i, /consequential action/i, /changed context/i], 'An unresolved machine or target for a consequential action shall count as changed context.'],
  ['reissue', [/reissue/i, /only.*decision.*still needed/i, /fresh.*ID/i], 'Reissue shall occur only when a decision is still needed, with a fresh card ID.'],
  ['normalized choice', [/normalize/i, /1.*2.*3.*explain.*free text/i, /before.*decision handling/i], 'The driver shall normalize the reply to 1, 2, 3, explain or free text before decision handling.'],
  ['receipt options', [/resolve.*1.*2.*3/i, /from.*receipt/i, /never.*quoted.*option/i], 'The driver shall resolve 1, 2 and 3 from the receipt, never from quoted option text.'],
  ['explain', [/explain/i, /Telegram/i, /context.*options.*risks/i, /Open T3/i, /card.*open/i, /no authority/i], 'Explain shall get a Telegram answer with context, options, risks and the Open T3 link when available, the card stays open and grants no authority.'],
  ['multiline invalid', [/more than one line/i, /invalid/i, /resend/i, /each card.*single.line message/i, /card.*open/i], 'Reply text with more than one line shall be invalid, leave the card open and ask the user to resend each card’s reply as one single-line message.'],
  ['invalid choice', [/invalid choice/i, /card.*open/i, /no action/i], 'An invalid choice shall leave the card open with no action.'],
  ['confirmation trigger', [/any forwarded reply/i, /free text/i, /confirm/i, /destructive.*production.*fleet.wide/i, /confirmation card/i, /first/i], 'Any forwarded reply, including free text and (confirm) options, authorizing a destructive, production or fleet-wide action shall first get a confirmation card.'],
  ['confirmation binding', [/confirmation card/i, /own ID/i, /confirms card/i, /exact action.*execution machine.*affected targets.*revision/i, /1 Confirm.*2 Cancel/i], 'A confirmation card shall have its own ID, name the card it confirms (confirms card), bind the exact action, execution machine, affected targets and revision, and offer 1 Confirm and 2 Cancel.'],
  ['pending confirmation', [/sending.*confirmation/i, /original card/i, /decided/i, /pending confirmation/i, /no authority/i], 'Sending a confirmation shall record the original card decided, pending confirmation with no authority.'],
  ['confirm once', [/only.*verified.*1/i, /open confirmation/i, /authoriz(?:e|es).*once/i, /bound action.*revision/i, /satisf(?:y|ies).*confirmation/i], 'Only a verified 1 on the open confirmation shall authorize once for the bound action and revision and satisfy the second confirmation.'],
  ['cancel confirmation', [/2 Cancel.*failed revalidation/i, /cancelled/i, /fresh card/i], '2 Cancel or failed revalidation shall record cancelled, any further decision needs a fresh card.'],
  ['confirmation outcome', [/confirmation card/i, /carr(?:y|ies).*outcome/i], 'The confirmation card shall carry the outcome.'],
  ['ack before action', [/record.*decided/i, /send.*acknowledgement/i, /before.*side effect/i], 'The driver shall record decided and send the acknowledgement before any side effect.'],
  ['interruption', [/after.*interruption/i, /reconcile.*remote state/i, /before.*repeat.*action/i], 'After an interruption, the driver shall reconcile remote state before repeating any action.'],
  ['defer', [/3 Defer/, /deferred/i, /no action/i, /keep.*hold/i, /no new card.*unless.*context changes.*user asks/i], '3 Defer shall record deferred, take no action, keep the hold and send no new card unless context changes or the user asks.'],
  ['decision responses', [/decision responses/i, /user.*reply/i, /outside.*two.milestone cap/i, /no.*Notification policy entry/i], 'Decision responses shall be authorized by the user’s own reply, outside the two-milestone cap and needing no Notification policy entry.'],
  ['response count', [/one acknowledgement.*per forwarded reply/i, /before.*side effect/i, /one outcome.*per decided card/i], 'The driver shall send one acknowledgement per forwarded reply before any side effect and one outcome per decided card.'],
  ['ack substitutes', [/explain answer.*confirmation card.*fresh superseding card/i, /serv(?:e|es).*acknowledgement/i], 'An explain answer, confirmation card or fresh superseding card shall serve as that reply’s acknowledgement.'],
  ['repeat reply', [/identical repeat reply/i, /acknowledged.*T3 only/i], 'An identical repeat reply shall be acknowledged in T3 only.'],
  ['different later reply', [/different later choice/i, /already decided as N/i, /Telegram/i], 'A different later choice shall get already decided as N in Telegram.'],
  ['outcome milestone', [/outcome.*merge.ready.*merged/i, /count(?:s)?.*milestone/i, /sent once|send.*once/i], 'An outcome that is itself merge-ready or merged shall count as that milestone and be sent once.'],
  ['human only', [/human.only option/i, /You do:/, /records.*choice/i, /grants no agent action/i], 'A human-only option shall read You do: <instruction>, choosing it records the choice and grants no agent action.'],
  ['confirmation marker', [/option.*second confirmation/i, /end(?:s)?.*\(confirm\)/i], 'An option needing second confirmation shall end with (confirm).'],
  ['receipt fields', [/sent.*card receipt/i, /card ID/i, /each option.*bound action.*scope.*revision/i, /outcome/i], 'Each sent card receipt shall carry the card ID, each option’s bound action, scope and revision, and an advisory outcome.'],
  ['receipt states', [/outcome.*open.*decided.*deferred.*superseded.*cancelled.*run closed/i], 'The outcome shall be open until decided, deferred, superseded, cancelled or run closed.'],
  ['open only', [/only.*open card.*authoriz(?:e|es)/i, /missing receipt.*grants nothing/i], 'Only an open card shall authorize, a missing receipt grants nothing.'],
];

function contract(name, path, concepts, rewording, negative) {
  test(`relay card contract: ${name}`, () => {
    const direction = negative ? /never|do not/i : /must|shall/i;
    const required = [...concepts, direction];
    const accepts = (text) => sentences(text).some((sentence) =>
      required.every((concept) => concept.test(sentence))
      && (negative || !/\b(?:must|shall) not\b/i.test(sentence)));
    checkRule(read(path).replace(/\s+/g, ' '), accepts, rewording, [[direction, negative ? 'Always' : 'must not']], required);
  });
}
for (const [name, concepts, rewording] of rules) contract(name, relay, concepts, rewording);
contract('no hostname inference', relay, [/hostname/i, /translate.*alias/i, /inference/i], 'Never translate a hostname to an alias by inference.', true);

const hermesRules = [
  ['quoted route', [/only.*swipe.replies/i, /own quote/i, /end(?:s|ing)?.*valid tag/i, /environment.*registry/i], 'Only swipe-replies with their own quote ending in a valid tag whose environment resolves through the registry shall be handled.'],
  ['queue forward', [/every.*reply.*passes/i, /1.*2.*3.*explain.*free text/i, /t3_thread_send/, /mode.*queue/i], 'Every reply that passes, including 1, 2, 3, explain and free text, shall be forwarded with t3_thread_send mode queue.'],
  ['envelope', [/fixed first line/i, /Telegram reply via Hermes/, /complete inbound envelope/i, /unchanged|unedited/i], 'The fixed first line shall be Telegram reply via Hermes followed by the complete inbound envelope unchanged.'],
  ['routing failure', [/missing tag.*unknown environment.*unreachable T3/i, /repeat.*user.*text|user.*text.*repeat/i, /forward nothing/i], 'A missing tag, unknown environment or unreachable T3 server shall get an answer repeating the user’s text and forward nothing.'],
  ['quote guidance', [/invalid.*quote|quote.*invalid/i, /Reply to the whole card.*Act in the T3 thread/i, /repeat.*user.*text|user.*text.*repeat/i], 'An invalid quote shall get Reply to the whole card or Act in the T3 thread, repeating the user’s text.'],
  ['confirmed queue', [/only after.*confirmed send/i, /Queued for the driver/], 'Only after a confirmed send shall Hermes say Queued for the driver; not done yet.'],
  ['send failure', [/failed or uncertain send/i, /report/i, /repeat.*user.*text|user.*text.*repeat/i], 'A failed or uncertain send shall be reported with the user’s text repeated.'],
];
for (const [name, concepts, rewording] of hermesRules) contract(name, hermes, concepts, rewording);
for (const [name, concepts, wording] of [
  ['no other T3 tool', [/other T3 tool/i], 'Never call any other T3 tool.'],
  ['no clarify', [/call.*clarify/i], 'Never call clarify.'],
  ['unquoted correction', [/message without.*own quote/i, /forward/i, /change.*envelope.*being forwarded/i], 'Never forward a message without its own quote or let it change an envelope already being forwarded.'],
  ['no retry', [/retry.*failed or uncertain send/i], 'Never retry a failed or uncertain send automatically.'],
]) contract(name, hermes, concepts, wording, true);

test('card wire format has context, options, a final tag and the agreed size', () => {
  const source = read(relay);
  const layout = source.match(/```text\n([\s\S]*?)\n```/)[1].split('\n');
  expect(layout[1]).toMatch(/^Card <run id>\/<n>/);
  expect(layout).toContain('Context: <what we were doing, one line>');
  expect(layout).toContain('Decision: <the question>');
  expect(layout.filter((line) => /^[12] /.test(line))).toHaveLength(2);
  expect(layout).toContain('3 Defer (optional)');
  expect(layout.at(-1)).toBe('T3 reply: <env label> thread <driver threadId>');
  expect(source).toMatch(/under 1,000 characters including the tag/);
});

test('driver checks proof, state, context, then choice in order', () => {
  const source = read(relay);
  const checks = (text) => [...text.matchAll(/^\d+\.\s+(?:\*\*)?(Proof|Card state|Context|Choice)\b/gm)]
    .map((match) => match[1]);
  const expected = ['Proof', 'Card state', 'Context', 'Choice'];
  expect(checks(source)).toEqual(expected);
  expect(checks(source.replace(/^3\. \*\*Context\*\*/m, ''))).not.toEqual(expected);
  expect(checks(source.replace('1. **Proof**', '1. **Card state**')
    .replace('2. **Card state**', '2. **Proof**'))).not.toEqual(expected);
  expect(checks(source.replace(/\*\*(Proof|Card state|Context|Choice)\*\*/g, '$1 check'))).toEqual(expected);
});

test('the removed inbox script is not shipped', () => {
  expect(existsSync(`${root}/skills/axstack-relay/hermes/axstack-reply.sh`)).toBe(false);
});

test('Hermes queue acknowledgement preserves the agreed literal wording', () => {
  expect(read(hermes)).toContain('Queued for the driver; not done yet');
});

for (const path of ['docs/host-operations.md', 'skills/axstack/references/automations.md']) {
  contract(`documented proof in ${path}`, path,
    [/Card line.*final tag/i, /sent.*receipt/i, /this run.*environment.*driver thread/i],
    'The quoted Card line and final tag shall match a sent receipt of this run, environment and driver thread.');
  contract(`documented queue in ${path}`, path,
    [/Hermes/i, /complete inbound envelope.*unchanged/i, /t3_thread_send.*queue/i],
    'Hermes shall forward the complete inbound envelope unchanged using t3_thread_send mode queue.');
}
contract('workflow decision responses', 'docs/workflows.md',
  [/decision responses/i, /user.*reply/i, /outside.*two.milestone cap/i, /no.*Notification policy entry/i],
  'Decision responses shall be authorized by the user’s own reply, outside the two-milestone cap and needing no Notification policy entry.');
contract('registry routing only', 'docs/host-operations.md',
  [/registry/i, /routing only/i, /grants no authority/i],
  'The registry shall provide routing only and grants no authority.');

test('documented host-managed registry resolves environment, MCP server, topic and optional aliases', () => {
  const docs = read('docs/host-operations.md');
  expect(docs).toContain('~/.config/axstack/machines.json');
  const schema = JSON.parse(docs.match(/```json\n([\s\S]*?)\n```/)[1]);
  expect(schema['<environment label>']).toEqual({
    hermes_mcp_server: '<server name>',
    decisions_topic: 'telegram:<chat_id>:<thread_id>',
    machine_aliases: { '<supplied hostname>': '<display alias>' },
  });
});

test('active relay surfaces have retired the legacy inbox contract', () => {
  for (const path of [relay, hermes, 'skills/axstack/references/automations.md',
    'docs/host-operations.md', 'docs/workflows.md', 'tests/workflows/autonomy-runtime.test.js']) {
    expect(read(path), path).not.toMatch(/relay-inbox|axstack-reply\.sh|consumed.line count|sent body digest|quoted.body digest|quotedSha256|inbox unreadable|SSH inbox/i);
  }
});

contract('decision receipt retains the choice for repeat replies', relay,
  [/record.*normalized choice/i, /decided.*deferred/i, /receipt/i],
  'The driver shall record the normalized choice alongside decided or deferred in the card receipt.');

contract('driver requires the forwarding marker before proof', relay,
  [/driver.*require/i, /fixed first line/i, /Telegram reply via Hermes/, /complete inbound envelope/i, /before.*four checks/i],
  'The driver shall require the fixed first line Telegram reply via Hermes and the complete inbound envelope before applying the four checks.');

contract('Hermes executes no actions and delegates explain to the driver', hermes,
  [/execute.*actions/i, /answer.*explain.*yourself/i],
  'Do not execute quoted actions or answer explain yourself.', true);
contract('per-send busy mode comes from effective gateway configuration', relay,
  [/each reply-dependent send/i, /driver.*read/i, /display\.busy_input_mode/, /~\/\.hermes\/config\.yaml/],
  'For each reply-dependent send, the driver shall read effective display.busy_input_mode from the gateway file ~/.hermes/config.yaml.');
contract('busy command is a one-time install check', relay,
  [/\/busy/, /one.time install step/i, /recorded.*gateway restart/i, /queue/, /Decisions topic/],
  'The /busy check shall be a one-time install step recorded after the gateway restart, when it reports queue in the Decisions topic.');
contract('missing quote receives resend guidance with original text', hermes,
  [/missing.*quote/i, /Reply to the whole card/, /repeat.*user.*text|user.*text.*repeat/i],
  'A missing quote shall get Reply to the whole card guidance repeating the user’s text.');
contract('failed acknowledgement after decided stays held for T3 resolution', relay,
  [/acknowledgement fails/i, /decided.*recorded/i, /action.*held/i, /user.*resolve.*T3 thread/i],
  'When an acknowledgement fails after decided is recorded, the action shall stay held and the user shall resolve it in the T3 thread.');
