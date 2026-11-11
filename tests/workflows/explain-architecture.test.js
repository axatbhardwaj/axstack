import { test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const skill = 'skills/axstack-explain/SKILL.md';
const mode = 'skills/axstack-explain/references/architecture-diagram.md';
// Missing guidance is an absent instruction, never a missing-module red.
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
// Keep link destinations in the contract while allowing link labels to change.
const normalize = (source) => sentences(source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')).join('. ');

// A1–A3 prompt contracts. Existing diagram tests cover generic visuals, not
// mandatory grounded authoring, actual-provider independence or this route.
const rules = [
  ['architecture routing', skill, [/architecture.*system.map/i, /diagram requests/i, /follow|read|consult/i, /references\/architecture-diagram\.md/i],
    'For architecture and system-map diagram requests, consult Architecture diagrams (references/architecture-diagram.md).', [[/follow|read|consult/i, 'ignore']]],
  ['route intent', mode, [/apply/i, /how parts fit together/i, /who talks to whom/i, /where risks sit/i],
    'Apply this mode to how parts fit together, who talks to whom, and where risks sit.', [[/apply/i, 'exclude']]],
  ['ordinary diagrams unchanged', mode, [/ordinary diagrams/i, /keep|retain/i, /Explain.*existing path/i],
    'Ordinary diagrams retain Explain’s existing path.', [[/keep|retain/i, 'replace']]],
  ['driver bounds first', mode, [/driver/i, /first/i, /bounds/i, /question/i, /Explain §1/i],
    'The driver first bounds the question under Explain §1.', [[/first/i, 'last']]],
  ['grounding order', mode, [/after.*driver bounds/i, /require/i, /axstack-scout/i, /grounding/i, /before research or authorship/i],
    'After the driver bounds the question, require axstack-scout grounding before research or authorship.', [[/before/i, 'after']]],
  ['grounding identity', mode, [/reuse/i, /scout evidence/i, /only/i, /inspected content identity/i, /unchanged/i],
    'Reuse scout evidence only when its inspected content identity is unchanged.', [[/unchanged/i, 'changed']]],
  ['research condition', mode, [/after grounding/i, /require/i, /axstack-research/i, /only when/i, /diagram depends/i, /external.*vendor.*platform facts/i, /outside.*inspected repositor/i],
    'After grounding, require axstack-research only when the diagram depends on external, vendor or platform facts outside the inspected repositories.', [[/only when/i, 'regardless of whether']]],
  ['research skip receipt', mode, [/otherwise/i, /driver records/i, /not needed/i, /reason/i],
    'Otherwise the driver records not needed (<reason>) for research.', [[/records/i, 'conceals']], /not needed/i],
  ['evidence reconciliation', mode, [/reconcile/i, /scout and research evidence/i, /before author dispatch/i],
    'Reconcile scout and research evidence before author dispatch.', [[/before/i, 'after']]],
  ['private driver source map', mode, [/driver/i, /keeps/i, /source map/i, /outside.*reader view/i],
    'The driver keeps the source map outside the reader view.', [[/outside/i, 'inside']]],
  ['author input', mode, [/give/i, /axstack-explainer/i, /reconciled evidence/i, /source map/i, /author brief/i],
    'Give axstack-explainer the reconciled evidence and source map in its author brief.', [[/give/i, 'withhold from']]],
  ['exclusive author', mode, [/require/i, /axstack-explainer/i, /one writer/i, /architecture diagram/i],
    'Require axstack-explainer as the one writer of the architecture diagram.', [[/one writer/i, 'one of several writers']]],
  ['same author repair', mode, [/return/i, /every repair/i, /same author/i],
    'Return every repair to the same author.', [[/same/i, 'another']]],
  ['independent final-byte reviewer', mode, [/require/i, /independent/i, /axstack-explainer-review/i, /exact final bytes/i, /after authorship/i, /before delivery/i],
    'After authorship and before delivery, require independent axstack-explainer-review on the exact final bytes.', [[/exact/i, 'approximate']]],
  ['actual provider independence', mode, [/require/i, /reviewer provider/i, /different from/i, /actual author provider/i, /session provenance/i],
    'Require the reviewer provider to be different from the actual author provider, using session provenance.', [[/different from/i, 'the same as']]],
  ['full claim set each round', mode, [/review/i, /full claim set/i, /every round/i, /nodes/i, /edges/i, /badges.*markers/i, /legend/i, /prior findings/i],
    'Review the full claim set every round, including nodes, edges, badges and markers, legend and prior findings.', [[/every round/i, 'the first round only']]],
  ['driver previews before review', mode, [/inline HTML/i, /driver captures/i, /728px dark/i, /360px light/i, /previews/i, /before review/i, /SHA-256/i],
    'For inline HTML, the driver captures 728px dark and 360px light previews before review, bound to SHA-256.', [[/before/i, 'after']]],
  ['review design evidence', mode, [/reviewer/i, /inspects/i, /driver.*previews/i, /design review/i, /728px dark/i, /360px light/i],
    'The reviewer inspects the driver’s 728px dark and 360px light previews for design review.', [[/inspects/i, 'ignores']]],
  ['reviewed bytes delivery', mode, [/driver/i, /renders/i, /only/i, /reviewed bytes/i, /after.*review passes/i],
    'The driver renders only reviewed bytes after the review passes.', [[/only/i, 'also unreviewed alongside']]],
  ['byte changes invalidate review', mode, [/any|every/i, /byte change/i, /requires/i, /fresh review/i],
    'Every byte change requires fresh review.', [[/fresh/i, 'stale']]],
  ['seat failures hold', mode, [/required seat/i, /unavailable or rejected/i, /hold/i, /diagram/i, /name/i, /blocker/i, /resume condition/i],
    'If a required seat is unavailable or rejected, hold the diagram and name the blocker and resume condition.', [[/hold/i, 'deliver']]],
  ['single-provider hold', mode, [/single.provider presets/i, /hold/i, /user routing choice/i],
    'Single-provider presets hold for a user routing choice.', [[/hold/i, 'proceed without a']]],
];

for (const [name, path, concepts, rewording, inversions, prohibition] of rules) {
  test(`architecture mode: ${name}`, () => checkRule(normalize(read(path)),
    (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
    rewording, inversions, concepts));
}

for (const [name, negation, concepts, rewording, inversions] of [
  ['driver authorship forbidden', /never authors/i, [/driver/i, /architecture diagrams/i],
    'The driver never authors architecture diagrams.', [[/never authors/i, 'authors']]],
  ['same-provider exception excluded', /never permits/i, [/mode/i, /same.provider author.*review/i, /Explain.*session.independence exception/i],
    'This mode never permits same-provider author and review through Explain’s session-independence exception.', [[/never permits/i, 'permits']]],
  ['no seat substitution', /never substitute/i, [/required seat/i, /provider/i, /model/i],
    'Never substitute a required seat, provider or model.', [[/never substitute/i, 'Substitute']]],
]) {
  test(`architecture mode: ${name}`, () => checkRule(normalize(read(mode)),
    (text) => prohibits(text, negation, ...concepts), rewording, inversions));
}
