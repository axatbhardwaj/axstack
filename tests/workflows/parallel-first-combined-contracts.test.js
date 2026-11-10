import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const shared = 'skills/axstack/references/parallel-first.md';
const roster = 'skills/axstack/references/role-roster.md';
const read = (path) => existsSync(`${root}/${path}`)
  ? readFileSync(`${root}/${path}`, 'utf8').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replaceAll('`', '').replace(/\s+/g, ' ') : '';

// Assertions read the real instruction owners. They check concepts together in
// an affirmative instruction, then remove/invert/reword that actual instruction
// in memory. No fixture scheduler or production test hook is introduced.
// This bounded grammar protects contracts, not arbitrary English equivalence.
function contract(label, path, concepts, rewording) {
  test(label, () => {
    const source = read(path);
    const accepts = (text) => sentences(text).some((sentence) =>
      !/\b(?:do not|must not|shall not|never|forbid\w*|optional)\b/i.test(sentence)
      && concepts.every((concept) => concept.test(sentence)));
    expect(accepts(source), `${path}: ${label}`).toBe(true);
    checkRule(source, accepts, rewording, [[/^/, 'Do not ']]);
  });
}

contract('C2: same-binding writers are exempt from the extra author-provider floor', shared,
  [/same[- ](?:binding|author binding)|same[^.]*supported author binding/i,
    /package/i, /integrat/i, /exempt|exception|without[^.]*second|no[^.]*second/i,
    /provider|Codex[^.]*Claude/i],
  'Same-binding package and integration authors are exempt from the second author-provider floor.');

contract('C2: distinct-brief decomposition has a scoped diversity exemption', shared,
  [/distinct|different|disjoint/i, /brief|concern/i, /decompos|package/i,
    /exempt|exception|without[^.]*divers|no[^.]*divers/i],
  'Distinct-brief decomposition packages are exempt from extra provider diversity.');

contract('C2: author binding retains independent authored review', shared,
  [/writers/i, /same/i, /supported/i, /binding/i, /independent authored[- ]review/i],
  'Ordinary writers must use the same supported author binding for independent authored-review.');

contract('C2: every contributor satisfies the applicable review pairing', shared,
  [/every|all/i, /contribut/i, /must|require/i, /satisf/i, /review pairing/i],
  'Every contributor must satisfy the applicable review pairing.');

// These checks join the exemption with its opposite boundary. A broad exemption
// that also erased corroboration floors must fail even if package fanout works.
contract('C2: roster retains the mixed research provider floor', roster,
  [/research/i, /(?:at least )?two (?:different |distinct )?providers/i, /require|must|retain/i],
  'Mixed research requires at least two different providers.');

for (const [phase, path, concept] of [
  ['arena', 'skills/axstack-brainstorm/references/arena.md', /arena|mixed fan[- ]?out/i],
  ['audit', 'skills/axstack-audit/SKILL.md', /audit|mixed fan[- ]?out/i],
]) {
  contract(`C2: ${phase} retains its mixed corroboration floor`, path,
    [concept, /Codex/i, /Claude/i, /retain|require|must|hold/i],
    `Mixed ${phase} fanout must retain one Codex and one Claude seat.`);
}

contract('C2: peer first passes remain independently paired', 'skills/axstack-review/references/peer-mode.md',
  [/primary[^.]*peer|(?:both|two|paired) (?:peer )?reviewers/i,
    /independent|isolated/i, /first pass|first[- ]pass/i],
  'Both peer reviewers must produce independent first-pass assessments.');

contract('C4: each isolated candidate retains exactly one writer', shared,
  [/each|every|per|one writer-owned/i, /candidate|worktree|artifact/i,
    /one (?:active )?writer|sole writer|exclusive writer|writer-owned/i],
  'Each isolated candidate must have one active writer.');

contract('C4: the final combined branch has one integration writer', shared,
  [/one|sole|exclusive/i, /integration author|integrator/i, /final|combined/i,
    /writer|writes|owns/i],
  'One integration author is the sole writer of the final combined branch.');

contract('C4: terminal package evidence can satisfy an internal code dependency', shared,
  [/terminal/i, /package/i, /receipt|evidence/i, /exact|tip|revision/i,
    /internal|within (?:one|a|the same) PR/i, /satisf|suffic|consum|accept/i],
  'A verified terminal package receipt and exact tip can satisfy an internal code dependency.');

contract('C4: cross-PR code dependencies still need reviewed parents', shared,
  [/cross[- ]PR|across PRs|between PRs/i, /reviewed[- ]parent|reviewed parent/i,
    /retain|preserv|require|must|follow/i],
  'Cross-PR code dependencies must retain reviewed-parent rules.');

contract('C4: changed consumed identities invalidate affected consumers', shared,
  [/chang|stale|drift/i, /consum|input|producer/i, /invalidat/i, /affect/i],
  'Changed producer input identities must invalidate affected consumer evidence.');

contract('C4: unaffected packages continue while affected dependencies hold', shared,
  [/unrelated|unaffected/i, /work|package|consumer/i, /continue|progress|proceed/i],
  'Unrelated packages must continue while affected consumers hold.');

contract('C4: package-local repairs return to their exclusive author', shared,
  [/package[- ]local/i, /repair|fix/i, /return|route/i, /(?:exclusive|own|same|package) author/i],
  'Return package-local fixes to their exclusive author.');

contract('C4: integration-only repairs belong to the integration author', shared,
  [/integration[- ]only/i, /repair|fix/i, /return|route|belong/i, /integration author/i],
  'Return integration-only fixes to the integration author.');

contract('C4: consumed package tips remain ancestors of the final head', shared,
  [/package|consumed/i, /tip|commit/i, /ancestor|ancestry/i, /final|integrat/i,
    /verify|must|preserv|retain/i],
  'Verify consumed package tips are ancestors of the final integrated head.');

contract('C4: unknown contributor provenance holds the candidate', shared,
  [/unknown|divergent/i, /provenance|provider|binding/i, /hold/i, /candidate|review/i],
  'Unknown contributor provenance must hold the candidate review.');

contract('C4: integration acceptance requires all required package inputs', shared,
  [/final/i, /publication|acceptance/i, /all|every/i, /required/i, /package/i,
    /wait|require|must/i],
  'Final acceptance and publication must wait for all required packages.');

contract('C4: review and repair budgets stay per PR across packages', shared,
  [/review|repair/i, /budget/i, /per PR|per pull request/i, /package/i,
    /retain|remain|preserv|keep|stay/i],
  'Review and repair budgets remain per PR across packages.');

test('C4: contributor and owner self-review is forbidden in the joined candidate', () => {
  const accepts = (text) => sentences(text).some((sentence) =>
    /contribut/i.test(sentence) && /owner/i.test(sentence) && /review/i.test(sentence)
    && /ineligible|must not|cannot|never/i.test(sentence)
    && !/may review|can review|eligible to review/i.test(sentence.replace(/ineligible/gi, 'barred')));
  checkRule(read(shared), accepts,
    'Every contributor and the owner are ineligible to review the joined candidate.',
    [[/ineligible|must not|cannot|never/i, 'eligible to']]);
});

// The shared ownership rule alone cannot catch stale routing at a consumer.
// Check each distinct publication/diligence/hygiene/docs hand-off against its
// actual source; a general owner sentence elsewhere cannot satisfy it.
for (const [boundary, path, context, equivalent] of [
  ['publication evidence mismatch', 'skills/axstack/references/candidate-publication.md',
    [/missing|mismatched/i, /evidence/i, /hold\w* publication/i],
    'Missing or mismatched evidence holds publication and returns to the responsible package or integration author in its existing session and worktree.'],
  ['prepublication findings', 'skills/axstack/references/candidate-publication.md',
    [/FINDINGS/, /before publish|before publication/i],
    'Resolve FINDINGS with the responsible package or integration author in its existing session and worktree before publication.'],
  ['combined diligence findings', 'skills/axstack/references/diligence.md',
    [/Scope:\s*FINDINGS/, /same round/i, /block\w* merge-ready/i],
    'Scope: FINDINGS routes to the responsible package or integration author in its existing session and worktree in the same round and blocks merge-ready.'],
  ['retained author resource', 'skills/axstack/references/workspace-hygiene.md',
    [/repair/i],
    'Repairs return to the responsible package or integration author in its existing session and worktree.'],
  ['public workflow repair', 'docs/workflows.md',
    [/repair/i, /worktree/i],
    'Repairs route to the responsible package or integration author in its existing session and worktree.'],
]) {
  test(`M2: ${boundary} routes to the responsible package or integration author`, () => {
    const route = /package(?: author)? or integration author|integration(?: author)? or package author/i;
    const direction = /return\w*|route\w*|resolve/i;
    const concepts = [...context, /responsible|exclusive|owning/i, route, direction,
      /existing|current/i, /session/i, /worktree/i];
    const accepts = (text) => requires(text, ...concepts);
    expect(accepts(equivalent), 'equivalent wording preserves the boundary and exclusive owner route').toBe(true);
    const source = read(path);
    expect(accepts(source), `${path}: ambiguous same-author routing at ${boundary}`).toBe(true);
    checkRule(source, accepts, equivalent,
      [[route, 'same author'], [/responsible|exclusive|owning/i, 'any available'],
        [direction, 'do not $&']], concepts);
  });
}
