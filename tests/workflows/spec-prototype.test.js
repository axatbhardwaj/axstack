import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const prose = (path) => read(path).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/^#+ .*$/gm, '').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
const prototype = () => prose('skills/axstack-spec/references/prototype.md');
// Written safety contracts, not live compliance. Every semantic predicate is
// checked against removal, concept loss, inversion and equivalent wording.
// These safety nouns contain negative words without negating the instruction.
const affirmative = (s) => requires(s.replace(/never-merged|no-verdict|\[skip ci\]/gi, 'term'), /^/);
const affirms = (text, ...terms) => sentences(text).some((s) => affirmative(s) && terms.every((term) => term.test(s)));
const positive = (text, terms, equivalent, inversion) =>
  checkRule(text, (s) => affirms(s, ...terms), equivalent, [inversion], terms);
const negative = (text, ban, terms, equivalent, inversion) =>
  checkRule(text, (text) => sentences(text).some((s) => ban.test(s)
    && terms.every((term) => term.test(s)) && affirmative(s.replace(ban, ''))), equivalent, [inversion], terms);

for (const path of ['skills/axstack-align/SKILL.md', 'skills/axstack/references/design-lens.md']) {
  test(`prototype deferral gate, tag and cumulative count: ${path}`, () => {
    const text = prose(path);
    positive(text, [/defer/i, /only/i, /delivery runs?/i, /substantial/i, /continues? to Spec/i],
      'Defer a question only in delivery runs whose substantial work continues to Spec.', [/only/i, 'also outside']);
    positive(text, [/Open \(prototype\):\s*<question>/i, /tag|mark|carrier/i],
      'Mark a deferred item Open (prototype): <question>.', [/Open \(prototype\):/i, 'Open:']);
    positive(text, [/plain Open:/i, /keeps?|retains?/i, /meaning/i],
      'A plain Open: retains its existing meaning.', [/retains?|keeps?/i, 'loses']);
    negative(text, /(?:does not|never) block/i, [/deferral/i, /Align/i],
      'A deferral never blocks Align completion.', [/never|does not/i, 'must']);
    positive(text, [/Spec/i, /deferred/i, /Align/i, /cumulative count/i, /inside|within/i],
      'Questions on deferred items in Spec stay within Align cumulative count.', [/inside|within/i, 'outside']);
    negative(text, /(?:need no|without|never require)/i, [/deferred/i, /refinement opt-in/i],
      'Questions on deferred items never require refinement opt-in.', [/need no|without|never require/i, 'require']);
  });
}

test('Spec runs step 3a before the first draft adviser round', () => {
  const text = prose('skills/axstack-spec/SKILL.md').split(/\b3a\./)[1] ?? '';
  positive(text, [/prototype/i, /before/i, /first draft adviser round/i, /follow/i],
    'At 3a follow prototype guidance before the first draft adviser round.', [/before/i, 'after']);
  expect(read('skills/axstack-spec/SKILL.md')).toMatch(/\]\(references\/prototype\.md\)/);
});

test('prototype kinds retain the switcher and same-dispatch fallback without routing', () => {
  const text = prototype();
  positive(text, [/UI/i, /variants/i, /switcher/i, /require|include/i],
    'UI variants require a switcher.', [/require|include/i, 'may omit']);
  positive(text, [/start command/i, /fails?/i, /tier 2/i, /same dispatch/i],
    'If the start command fails, use tier 2 in the same dispatch.', [/same dispatch/i, 'replacement dispatch']);
  negative(text, /never re-?route/i, [/run/i],
    'Never reroute the run for a prototype.', [/never/i, 'always']);
});

test('prototype variants stub mutations and confer no sensitive authority', () => {
  const text = prototype();
  positive(text, [/variants/i, /read-only/i, /stub/i, /every mutation/i],
    'Keep variants read-only and stub every mutation.', [/stub/i, 'execute']);
  negative(text, /grants? no/i, [/prototype/i, /production data/i, /credential/i, /transaction/i, /infrastructure/i, /authority/i],
    'A prototype grants no production data, credential, transaction or infrastructure authority.', [/grants? no/i, 'grants']);
});

test('pre-baseline authority is bounded to one question and draft revision', () => {
  const text = prototype();
  positive(text, [/pre-baseline/i, /only/i, /delivery runs/i, /one author per question/i, /only named files/i, /one create-only push/i, /never-merged ref/i],
    'The pre-baseline exception applies only in delivery runs: one author per question, only named files and one create-only push of a never-merged ref.', [/one author per question/i, 'any authors']);
  positive(text, [/dispatch/i, /bind/i, /deferred question/i, /current draft revision/i, /in place of.*approved identity/i],
    'Bind the dispatch to the deferred question and current draft revision in place of an approved identity.', [/current draft revision/i, 'any revision']);
  positive(text, [/driver/i, /record/i, /Authority:/i, /run record/i],
    'The driver records the exception on the run record Authority: line.', [/records?/i, 'may omit']);
});

test('prototype authors commit while only the driver pushes', () => {
  const text = prototype();
  positive(text, [/author/i, /commits?/i, /\[skip ci\]/i],
    'The author commits with [skip ci].', [/\[skip ci\]/i, '[run ci]']);
  positive(text, [/only the driver/i, /push/i, /author head|author SHA/i],
    'Only the driver pushes the author SHA.', [/only the driver/i, 'any author']);
  negative(text, /author never pushes/i, [],
    'The author never pushes.', [/never/i, 'always']);
});

test('completion exemption is restricted to prototype authors', () => {
  const text = prototype();
  const accepts = (value) => sentences(value).some((s) =>
    /(?:^|\s)Only prototype authors (?:skip|omit) red\/green logs\b/i.test(s)
    && !/\b(?:not|never|may)\b/i.test(s));
  checkRule(text, accepts, 'Only prototype authors omit red/green logs.', [
    [/Only prototype authors/i, 'All authors'], [/skip|omit/i, 'require'],
    [/Only prototype authors/i, 'Only prototype authors and other authors'],
  ], [/prototype/i, /red\/green logs/i]);
  positive(text, [/completion/i, /terminal checks/i, /non-empty diff/i, /clean tree/i, /start command/i, /observed output/i],
    'For completion require terminal checks, non-empty diff, clean tree and evidence of the start command and observed output.', [/clean tree/i, 'dirty tree']);
});

test('prototype review decisions, caps and unresolved exits preserve the interview budget', () => {
  const text = prototype();
  positive(text, [/each decision/i, /one Qn/i, /recommendation/i, /reason/i, /trade-off/i],
    'Present each decision as one Qn with a recommendation, reason and trade-off.', [/one Qn/i, 'uncounted']);
  negative(text, /(?:is not|never treat.*as) an advised hold/i, [/review/i],
    'Prototype review is not an advised hold.', [/is not/i, 'is']);
  positive(text, [/per question/i, /at most 3 review rounds/i, /at most 3 build-or-revise sends/i, /each.*at most one verification repair/i],
    'Per question allow at most 3 review rounds and at most 3 build-or-revise sends, each with at most one verification repair.', [/at most 3 review rounds/i, 'unlimited review rounds']);
  positive(text, [/per spec/i, /at most 2/i, /prototyped questions/i],
    'Per spec allow at most 2 prototyped questions.', [/at most 2/i, 'unlimited']);
  positive(text, [/stop before/i, /last Qn/i, /20/i, /justified 35/i],
    'Stop before spending the last Qn of 20 or the justified 35.', [/stop before/i, 'continue after']);
  positive(text, [/at any cap/i, /ask once/i, /Qn.*budget remains/i, /extend/i, /discuss|discussion/i, /drop/i],
    'At any cap ask once, as a Qn if budget remains: extend, discuss or drop.', [/ask once/i, 'ask repeatedly']);
  positive(text, [/tier 3/i, /abandonment/i, /drop/i, /spent budget/i, /held inline page/i, /no-verdict/i, /discussion/i, /ordinary Qn/i],
    'Tier 3, abandonment, drop, a spent budget or a held inline page take a no-verdict exit to discussion as an ordinary Qn.', [/no-verdict/i, 'approved']);
  positive(text, [/budget.*spent/i, /Decisions needed from the user/i, /spec approval/i],
    'With the budget spent put the question under Decisions needed from the user for spec approval.', [/Decisions needed from the user/i, 'Settled decisions']);
  negative(text, /never.*(?:appears?|mark).*settled/i, [/no-verdict/i],
    'A no-verdict question never appears settled.', [/never/i, 'always']);
});

test('prototype capture uses only the exact absent-ref lease', () => {
  const raw = read('skills/axstack-spec/references/prototype.md');
  const command = 'git push --force-with-lease=refs/heads/prototype-axstack-<slug>: origin <sha>:refs/heads/prototype-axstack-<slug>';
  const pushes = raw.match(/git push[^`\n]*/g) ?? [];
  expect(pushes).toEqual([command]); // Exact-text safety: the empty lease forbids overwriting any existing ref.
});

test('capture scans before push, forbids PR/merge and limits publication bypass', () => {
  const text = prototype();
  positive(text, [/before.*push/i, /scan.*diff/i, /secrets/i, /personal data/i],
    'Before the push scan the diff for secrets and personal data.', [/before/i, 'after']);
  positive(text, [/failed scan/i, /holds?|blocks?/i, /push/i],
    'A failed scan blocks the push.', [/holds?|blocks?/i, 'permits']);
  negative(text, /never (?:open|create)/i, [/PR/i, /merge/i],
    'Never open a PR or merge a prototype.', [/never/i, 'always']);
  const accepts = (text) => sentences(text).some((s) => affirms(s, /only/i, /never-merged prototype ref push/i,
    /skips?|bypasses?/i, /candidate-publication/i, /diligence/i, /review/i, /PR rules/i)
    && !/prototype ref push (?:and|or|,)/i.test(s));
  checkRule(text, accepts,
    'Only the never-merged prototype ref push bypasses candidate-publication diligence, review and PR rules.', [
      [/Only the never-merged prototype ref push/i, 'All candidate pushes'],
      [/prototype ref push/i, 'prototype ref push and candidate pushes'], [/skips?|bypasses?/i, 'must follow'],
    ], [/never-merged/i, /candidate-publication/i]);
  negative(text, /never base/i, [/candidate/i, /prototype SHA/i],
    'Never base a candidate on the prototype SHA.', [/never/i, 'always']);
});
