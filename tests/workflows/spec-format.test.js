import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const entry = read('skills/axstack-spec/SKILL.md');
// Only guidance actually loaded by Spec counts. Baseline absence is a contract
// failure, not a missing-file error. These checks do not prove agent compliance.
const format = loadedReferences(entry).filter((path) => path === 'references/format.md')
  .map((path) => read(`skills/axstack-spec/${path}`)).join('\n');
const compact = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ');

function rule(name, source, concepts, rewording, direction, inverse, ban) {
  test(`spec format: ${name} (removal/inversion red, rewording green)`, () => {
    checkRule(compact(source), (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts),
      rewording, [[direction, inverse]], concepts);
  });
}

rule('Spec loads the shared format before drafting', entry,
  [/follow|use|apply/i, /readable|reader/i, /format|structure/i, /draft|writ/i],
  'When drafting, apply the reader-first specification structure.', /follow|use|apply/i, 'skip');
rule('the brief comes first, ahead of execution and history', format,
  [/begin|open|start/i, /decision brief/i, /before|ahead of/i, /execution/i, /history/i],
  'Start with the decision brief ahead of execution detail and history.', /before|ahead of/i, 'after');
rule('identity stays compact and review rounds stay out of the opening', format,
  [/keep/i, /identity/i, /status/i, /compact/i, /review.round history/i, /after/i, /current requirements/i],
  'Keep identity and status compact, with review-round history after current requirements.', /after/i, 'before');
rule('opening explains the problem and intended change', format,
  [/opening|brief/i, /explain|state|show/i, /problem/i, /why|reason/i, /proposed|intended/i, /change/i],
  'The opening must show the problem, reason for acting and intended change.', /explain|state|show/i, 'omit');
rule('opening offers a concrete example when useful', format,
  [/opening|brief/i, /include|show|give/i, /concrete/i, /before.?after|before and after/i, /flow/i, /useful|clarif/i],
  'When useful, give a concrete before and after example or flow in the brief.', /include|show|give/i, 'omit');
rule('opening makes the scope boundary visible', format,
  [/opening|brief/i, /state|show|list/i, /included/i, /excluded/i, /scope/i],
  'The brief must list included and excluded scope.', /state|show|list/i, 'hide');
rule('opening exposes consequential risks and unknowns', format,
  [/opening|brief/i, /surface|show|expose/i, /consequential|material/i, /risk/i, /trade.?off/i, /unverified|unknown/i],
  'The opening must expose material risks, tradeoffs and unknown boundaries.', /surface|show|expose/i, 'conceal');
rule('opening gathers the decisions the user needs to make', format,
  [/opening|brief/i, /collect|gather|list/i, /all|every/i, /decision/i, /user/i, /needed|needs|pending/i],
  'In the brief, list every pending decision the user needs to make.', /collect|gather|list/i, 'scatter');
rule('capabilities own precise requirements and acceptance', format,
  [/group|organize/i, /precise|exact/i, /requirements/i, /acceptance/i, /capability|capabilities/i, /stable/i, /ID|identifier|reference/i, /useful/i],
  'Organize exact requirements and acceptance by capability with stable identifiers where useful.', /group|organize/i, 'scatter');
rule('state each rule once and reference it', format,
  [/state|write/i, /each|every/i, /rule/i, /once/i, /reference|link/i],
  'Write every rule once and link to it from other sections.', /once/i, 'repeatedly');
rule('technical execution detail is binding wherever stored', format,
  [/technical|execution/i, /detail/i, /remains?|is/i, /binding|normative/i, /wherever|regardless/i],
  'Execution detail is normative regardless of its location.', /binding|normative/i, 'advisory');
rule('human and agent views share one authoritative contract', format,
  [/human/i, /agent|implementer/i, /share/i, /one|single/i, /authoritative/i, /contract|specification/i],
  'Human and implementer views share a single authoritative contract.', /one|single/i, 'separate');
rule('contradictions are resolved before approval', format,
  [/resolve|repair|reconcile/i, /brief/i, /detail/i, /conflict|contradiction/i, /before|ahead of/i, /approval/i],
  'Reconcile brief and detail contradictions ahead of approval.', /before|ahead of/i, 'after');
rule('supporting records are separate from current requirements', format,
  [/keep|separate/i, /history/i, /evidence/i, /receipts/i, /apart|separate/i, /current requirements/i],
  'Separate history, evidence and receipts from current requirements.', /apart|separate/i, 'mixed');
rule('draft amendments repair current criteria in place', format,
  [/amend|revis/i, /draft/i, /update|edit/i, /current criteria/i, /in place/i, /change log/i, /history/i],
  'When revising a draft, edit current criteria in place and retain the change log as history.', /in place/i, 'only in historical overrides');
rule('approved snapshots stay immutable with external supersession pointers', format,
  [/preserve|keep/i, /approved/i, /snapshot/i, /immutable|unchanged/i, /supersession/i, /metadata|link/i, /outside/i, /approved bytes/i],
  'Keep approved snapshots unchanged and record supersession through metadata or links outside approved bytes.', /immutable|unchanged/i, 'editable');
rule('routine sequencing belongs in Tickets with meaningful constraints retained', format,
  [/routine/i, /file.by.file/i, /task/i, /PR/i, /sequencing/i, /Tickets/i, /design/i, /rollout/i, /constraint/i],
  'Put routine file-by-file task and PR sequencing in Tickets, retaining meaningful design and rollout constraints in the spec.', /Tickets/i, 'the opening brief');

const diligence = read('skills/axstack/references/diligence.md');
rule('spec diligence applies readability alongside completeness', diligence,
  [/draft spec/i, /check|review|assess/i, /readability/i, /alongside/i, /completeness/i, /format|structure/i],
  'For a draft spec, assess readability alongside completeness using the shared format.', /alongside/i, 'instead of');
rule('readability review tests both reader tasks', format,
  [/readability review/i, /verify|check|confirm/i, /human/i, /change/i, /why/i, /decision/i, /risk/i, /implementer/i, /exact requirements/i, /without reconstructing history/i],
  'For readability review, confirm a human finds changes, why, decisions and risks in the opening and an implementer finds exact requirements without reconstructing history.', /verify|check|confirm/i, 'ignore');
rule('format adds no word caps, forced tables or mandatory artifact', format,
  [/impose|require|add/i, /word caps/i, /mandatory tables/i, /artifact/i, /ceremony/i],
  'Do not impose word caps, mandatory tables, an extra artifact or ceremony.', /Do not/i, 'Always', /Do not/i);

test('spec format: usable example leads from a decision to exact capability acceptance', () => {
  const example = format.match(/```markdown\n([\s\S]*?)```/)?.[1] ?? '';
  const brief = example.split('## Execution requirements')[0];
  const execution = example.split('## Execution requirements')[1]?.split('## Evidence and history')[0] ?? '';
  expect(brief).toMatch(/problem|why/i);
  expect(brief).toMatch(/before:.*after:/is);
  expect(brief).toMatch(/included:.*excluded:/is);
  expect(brief).toMatch(/risk|trade.?off/i);
  expect(brief).toMatch(/unverified|unknown/i);
  expect(brief).toMatch(/decision.*approve|approve.*decision/i);
  const requirement = execution.match(/([A-Z]+-\d+):\s*\S/);
  expect(requirement, 'example needs a referenceable requirement').toBeTruthy();
  expect(execution).toMatch(new RegExp(`Acceptance.*${requirement?.[1]}`, 's'));
  expect(execution, 'example acceptance needs a boundary case').toMatch(/zero|empty|fail|error/i);
  expect(example.indexOf('## Decision brief')).toBeLessThan(example.indexOf('## Execution requirements'));
  expect(example.indexOf('## Execution requirements')).toBeLessThan(example.indexOf('## Evidence and history'));
});
