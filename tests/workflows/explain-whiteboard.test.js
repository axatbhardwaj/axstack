import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const skill = 'skills/axstack-explain/SKILL.md';
const defense = 'skills/axstack-explain/references/whiteboard-defense.md';
const delivery = 'skills/axstack-explain/references/delivery.md';
const anatomy = 'skills/axstack-anatomy/SKILL.md';
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';

// Independent prompt contracts, with real-source removal/inversion and rewording.
const rules = [
  ['defend discovery', skill, [/description: When/i, /defend/i, /whiteboard/i, /diagram/i, /visualize/i, /draw/i],
    'description: When the user asks to explain, defend, whiteboard, diagram, visualize or draw, says they cannot understand, use axstack-explain.', [[/defend/i,'decorate']]],
  ['whole-work scope', defense, [/apply/i, /whole system/i, /PR/i, /run/i, /change/i, /shipped/i, /in review/i, /planned/i],
    'Apply whiteboard defense to a whole system, PR, run or change, whether shipped, in review or planned.', [[/whole/i,'narrow']]],
  ['explicit triggers', defense, [/triggers include/i, /help me defend/i, /whiteboard defense for PR/i, /prep me for questions/i],
    'Triggers include help me defend X, whiteboard defense for PR N, and prep me for questions on X.', [[/help me defend/i,'decorate']]],
  ['ordinary primary view base', defense, [/extend/i, /§2.1/i, /base/i, /every explanation/i],
    "Extend §2.1's base for every explanation with the five elements.", [[/extend/i,'replace']]],
  ['decision trail evidence', defense, [/use/i, /§1.6/i, /decision trail/i, /decisions/i],
    'Use the §1.6 decision trail as evidence for decisions.', [[/§1.6/i,'intuition']]],
  ['high level data flow', defense, [/cover/i, /high.level/i, /how it works/i, /data flows/i],
    'Cover how it works at a high level and where data flows.', [[/cover/i,'omit']]],
  ['decisions alternatives', defense, [/cover/i, /key decisions/i, /why X instead of Y/i],
    'Cover key decisions as why X instead of Y.', [[/cover/i,'omit']]],
  ['data structures rationale', defense, [/cover/i, /main data structures or state/i, /why/i],
    'Cover the main data structures or state and why they were chosen.', [[/why/i,'names only']]],
  ['misbehavior actors', defense, [/cover/i, /user/i, /dependency/i, /agent/i, /attacker/i, /misbehaves/i, /maliciously/i],
    'Cover what happens if a user, dependency, agent or attacker misbehaves or acts maliciously.', [[/cover/i,'omit']]],
  ['failures show', defense, [/cover/i, /where it fails/i, /how.*failure shows/i],
    'Cover where it fails and how that failure shows.', [[/cover/i,'omit']]],
  ['traced evidence and labels', defense, [/traced means/i, /source/i, /tests/i, /observation/i, /recorded design/i, /§1.3/i, /label/i],
    'Traced means source, tests, observation or recorded design, each with its §1.3 label.', [[/recorded design/i,'intuition']]],
  ['design labels', defense, [/label/i, /design.only claims/i, /planned\/proposed/i],
    'Label design-only claims planned/proposed.', [[/planned\/proposed/i,'live observed']]],
  ['untraced shipped designs', defense, [/shipped or in.review/i, /design.only/i, /\(4\)/i, /\(5\)/i, /implementation not traced/i, /open gap/i, /list/i],
    'For shipped or in-review work, list design-only (4) or (5) as an open gap: implementation not traced.', [[/open gap/i,'verified']]],
  ['open evidence gaps', defense, [/missing alternative/i, /reason/i, /data.structure rationale/i, /misbehaviour/i, /failure/i, /open gaps/i, /list/i],
    'List a missing alternative, reason, data-structure rationale, or untraced misbehaviour or failure as open gaps.', [[/open gaps/i,'facts']]],
  ['trust boundaries and actors', defense, [/name/i, /each trust boundary/i, /flow.*\(1\)/i, /evidence pointer/i, /actors crossing/i],
    'Name each trust boundary on the flow traced in (1), with an evidence pointer and actors crossing it.', [[/each/i,'one']]],
  ['user actors answered or open', defense, [/answer/i, /each actor.*user names/i, /open/i],
    'Answer each actor the user names or list it open.', [[/each/i,'some']]],
  ['other actors scope', defense, [/state/i, /one line/i, /other actors.*out of scope/i],
    'State in one line that other actors are out of scope.', [[/out of scope/i,'verified safe']]],
  ['closing questions answered or open', defense, [/close/i, /likely whiteboard questions/i, /beyond.*\(1\).*\(5\)/i, /evidence.backed/i, /labelled|labeled/i, /open/i],
    'Close with likely whiteboard questions beyond (1)-(5), each with an evidence-backed labelled answer or marked open.', [[/beyond/i,'only']]],
  ['actionable gap lines', defense, [/each open gap/i, /missing evidence/i, /resolve.*before defending/i, /one line/i],
    'Give each open gap one line naming missing evidence and saying to resolve it before defending.', [[/before/i,'after']]],
  ['review consequential chat too', defense, [/every whiteboard.defense explanation/i, /\bconsequential\b/i, /review/i, /chat too/i],
    'Every whiteboard-defense explanation is consequential for review, in chat too.', [[/consequential/i,'nonconsequential']]],
  ['reviewer outage hold', delivery, [/reviewer.*unavailable/i, /hold.*whiteboard-defense explanation/i, /name.*reviewer/i],
    'If the reviewer is unavailable, hold the whiteboard-defense explanation and name the unavailable reviewer.', [[/hold/i,'deliver']]],
  ['claim review failure hold', delivery, [/whiteboard-defense explanation/i, /two repair rounds/i, /same author/i, /hold/i, /unresolved findings/i],
    'Hold a whiteboard-defense explanation still failing claim review after two repair rounds with the same author, naming unresolved findings.', [[/two/i,'unlimited']]],
  ['tool outage hold', delivery, [/missing preview or render tool/i, /unavailable verifier or check/i, /absent after.*ambiguous.*html_render/i, /hold.*page/i, /plain prose/i],
    'For a missing preview or render tool, unavailable verifier or check, or page absent after ambiguous html_render, hold the page and answer in plain prose.', [[/hold/i,'publish']]],
  ['Whiteboard-defense fallback prose reviewed', delivery, [/Whiteboard-defense plain prose/i, /still requires/i, /axstack-explainer-review/i],
    'Whiteboard-defense plain prose still requires axstack-explainer-review.', [[/requires/i,'waives']]],
  ['unavailable visual seats', delivery, [/required author or reviewer seat.*unavailable/i, /hold.*visual/i, /plain prose/i, /nam(?:e|ing).*held visual/i],
    'If a required author or reviewer seat is unavailable, hold the visual and answer in plain prose naming the held visual.', [[/hold/i,'deliver']]],
  ['visual repair limit', delivery, [/visual.*failing/i, /two repair rounds/i, /same author/i, /replace/i, /plain prose/i, /reason/i],
    'Replace a visual still failing checks after two repair rounds with the same author by plain prose with the reason.', [[/two/i,'unlimited']]],
  ['every visual author', skill, [/dispatch/i, /every visual.*delivers/i, /axstack-explainer/i, /bounded evidence brief/i],
    'Dispatch every visual Explain delivers to axstack-explainer with a bounded evidence brief.', [[/every/i,'some']]],
  ['every visual review', skill, [/axstack-explainer-review/i, /always reviews/i, /every visual/i, /exact final bytes/i, /before delivery/i],
    'The axstack-explainer-review always reviews every visual at its exact final bytes before delivery.', [[/always/i,'sometimes']]],
  ['stale diagram route', skill, [/stale.*axstack-diagram/i, /route.*here only/i],
    'For a stale axstack-diagram install, route requests here only.', [[/here only/i,'to both skills']]],
  ['explicit anatomy front door', anatomy, [/direct.*axstack-anatomy/i, /follow/i, /Explain/i, /dispatch/i, /review/i, /preview/i, /delivery/i],
    'Direct axstack-anatomy use follows Explain dispatch, review, preview and delivery.', [[/follows?|follow/i,'ignores']]],
  ['pointer-only detail', defense, [/function names/i, /line.level detail/i, /only/i, /evidence pointers/i, /use/i],
    'Use function names and line-level detail only as evidence pointers.', [[/only/i,'primarily']]],
  ['spec identity precedence', defense, [/spec.readback identity/i, /wins/i, /defending a spec/i],
    'Spec-readback identity wins when defending a spec.', [[/wins/i,'loses']]],
  ['other request precedence', defense, [/show.your.work/i, /blast.radius/i, /keep their rules/i, /unless/i, /whole/i],
    'Show-your-work and blast-radius requests keep their rules unless the user also asks about the whole.', [[/unless/i,'even when']]],
  ['PoC recorded status', defense, [/PoC.*demo.*experiment/i, /user or.*records/i, /identify/i, /optional checklist/i, /proportional/i, /ordinary review rule/i],
    'When the user or stated records identify a PoC, demo or experiment, use an optional checklist and proportional answer under the ordinary review rule.', [[/user or stated records|user or.*records/i,'agent intuition']]],
  ['intent to ship overrides', defense, [/intent to ship/i, /overrides/i, /PoC exemption/i],
    'An intent to ship overrides the PoC exemption.', [[/overrides/i,'preserves']]],
  ['explicit checklist restores full defense', defense, [/explicit checklist request/i, /requires/i, /full whiteboard defense/i],
    'An explicit checklist request requires full whiteboard defense.', [[/requires/i,'waives']]],
  ['overflow closing questions moved', defense, [/closing questions.*cannot fit/i, /per.component explanations/i, /offer/i, /count.*moved/i],
    'Offer per-component explanations for closing questions that cannot fit and count how many moved.', [[/count/i,'conceal']]],
  ['mandatory overflow lines', defense, [/mandatory lines.*exceed 700 words/i, /top.level explanation first/i, /split/i, /per.component/i],
    'If mandatory lines exceed 700 words, give the top-level explanation first and split the rest into per-component explanations.', [[/split/i,'omit']]],
  ['overflow delivered minimum', defense, [/delivered view/i, /keeps.*\(1\)/i, /one line each.*\(4\).*\(5\)/i, /open.gap count/i, /components/i],
    'The delivered view keeps (1), one line each for (4) and (5), and the open-gap count with the components holding them.', [[/keeps/i,'drops']]],
  ['overflow moved count', defense, [/state/i, /how many elements and open gaps moved/i],
    'State how many elements and open gaps moved.', [[/state/i,'hide']]],
  ['claim findings hold', delivery, [/visual.only findings/i, /visual rule/i, /claim findings/i, /hold.*whiteboard-defense explanation/i],
    'Visual-only findings follow the visual rule, and claim findings hold the whiteboard-defense explanation.', [[/hold/i,'waive']]],

];

for (const [name, path, concepts, rewording, inversions] of rules) {
  test(`r10 explain: ${name}`, () => checkRule(sentences(read(path)).join('. '),
    (text) => name === 'defend discovery'
      ? prohibits(text, /do not understand|cannot understand/i, ...concepts)
      : name === 'untraced shipped designs'
        ? prohibits(text, /implementation not traced/i, ...concepts)
        : name === 'PoC recorded status'
          ? sentences(text).some((line) => concepts.every((concept) => concept.test(line))
            && requires(line.replace(/\boptional\b/i, ''), /^/))
          : requires(text, ...concepts), rewording, inversions, concepts));
}

for (const [name, path, negation, concepts, rewording, inversions] of [
  ['never omit 1 4 5', defense, /never omit/i, [/\(1\)/i, /\(4\)/i, /\(5\)/i],
    'Never omit (1), (4) or (5).', [[/never omit/i,'Omit']]],
  ['no invention', defense, /never invent/i, [/alternatives/i, /reasons/i, /threats/i, /failures/i],
    'Never invent alternatives, reasons, threats or failures.', [[/never invent/i,'Invent']]],
  ['no driver visual substitution', delivery, /never writes/i, [/driver/i, /substitute visual/i],
    'The driver never writes a substitute visual.', [[/never writes/i,'writes']]],
  ['failure is not blast radius', defense, /does not trigger|never triggers/i, [/\(5\)/i, /blast.radius proof/i],
    '(5) never triggers the blast-radius proof.', [[/does not trigger|never triggers/i,'triggers']]],
  ['no silent element omission', defense, /never drop/i, [/element/i, /silently/i],
    'Never drop an element silently.', [[/never drop/i,'Drop']]],
  ['no inferred experiment status', defense, /never infer/i, [/status/i],
    'Never infer that status.', [[/never infer/i,'Infer']]],
  ['cap stays closed', defense, /never exceed/i, [/cap/i],
    'Never exceed the cap.', [[/never exceed/i,'Exceed']]],
  ['driver never builds anatomy', anatomy, /never builds/i, [/driver thread/i],
    'The driver thread never builds the figure.', [[/never builds/i,'builds']]],
]) {
  test(`r10 explain: ${name}`, () => checkRule(sentences(read(path)).join('. '),
    (text) => prohibits(text, negation, ...concepts), rewording, inversions));
}

test('visual routing rejects an inserted no-dispatch Mermaid rule', () => {
  const source = read(skill);
  const accepts = (text) => requires(text, /dispatch/i, /every visual/i, /axstack-explainer/i)
    && !/never dispatch|no dispatch|do not dispatch|do not launch|never launch/i.test(text);
  expect(accepts(source)).toBe(true);
  expect(accepts(`${source}\nNever dispatch for chat Mermaid.`)).toBe(false);
});

for (const [name, concepts, rewording, flip, inverse] of [
  ['only 2 and 3 may be omitted', [/omissions of \(2\) and \(3\)/i, /require/i, /does not apply/i, /one.line reason/i, /evidence pointer/i],
    'Omissions of (2) and (3) require does not apply with a one-line reason and evidence pointer.', /require/i, 'allow silence'],
]) {
  test(`r10 explain: ${name}`, () => checkRule(sentences(read(defense)).join('. '),
    (text) => sentences(text).some((line) => !/allow silence|ignore|optional/i.test(line) && concepts.every((concept) => concept.test(line))),
    rewording, [[flip, inverse]], concepts));
}
