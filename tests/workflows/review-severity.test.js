import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const review = 'skills/axstack-review/SKILL.md';
const diligence = 'skills/axstack/references/diligence.md';
const watch = 'skills/axstack-watch/SKILL.md';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (path) => read(path).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// Shipped instruction contracts only: no policy simulator or live forge proof.
// Existing review tests cover completeness and binding, not C1-C4 decisions.
const rules = [
  ['C1 shared rubric covers every finding', review,
    [/every|each/i, /review and diligence finding/i, /high/i, /medium/i, /low/i, /shared rubric/i],
    'Rate each review and diligence finding high, medium, or low using the shared rubric.',
    [/every|each/i, 'selected']],
  ['C1 high means real impact', review,
    [/high/i, /correctness/i, /security/i, /data.loss/i, /contract defect/i, /real impact/i],
    'High covers correctness, security, data-loss, or contract defects that have real impact.',
    [/real impact/i, 'hypothetical polish']],
  ['C1 medium includes obligations and evidence integrity', review,
    [/medium/i, /material behavio[u]?r/i, /test/i, /maintainability defect/i, /softened or dropped obligation/i,
      /evidence.integrity mismatch/i, /SHAs/i, /counts/i, /missing red.green logs/i],
    'Medium covers material behavior, test, or maintainability defects, a softened or dropped obligation, or an evidence-integrity mismatch such as SHAs, counts, or missing red/green logs.',
    [/medium/i, 'low']],
  ['C1 low is behavior-preserving polish', review,
    [/low/i, /polish/i, /change behavio[u]?r/i],
    'Low means polish that does not change behavior.',
    [/does not change|never changes/i, 'changes'], /does not change|never changes/i],
  ['C2 reviewer rates', review, [/reviewer/i, /rates?|assigns?/i, /each|every/i, /finding/i],
    'The reviewer assigns a rating to every finding.', [/reviewer/i, 'owner']],
  ['C2 uncertainty rounds up', review, [/uncertain/i, /ratings?/i, /round/i, /up(?:ward)?/i],
    'Round uncertain ratings upward.', [/up(?:ward)?/i, 'down']],
  ['C2 only diligence raises', review, [/only diligence/i, /raise/i, /rating/i],
    'Only diligence can raise a rating.', [/only diligence/i, 'any reviewer']],
  ['C2 nobody lowers', review, [/rating/i],
    'Nobody can lower a rating.', [/nobody (?:can|may) lower/i, 'The owner can lower'], /nobody (?:can|may) lower/i],
  ['C3 medium and high block approval', review, [/medium/i, /high/i, /block/i, /APPROVE/i],
    'Medium and high findings block APPROVE.', [/block/i, 'permit']],
  ['C3 fix and re-review blockers', review, [/fix/i, /re-review/i, /each|every/i, /medium/i, /high/i, /finding/i],
    'Fix and re-review each medium or high finding.', [/re-review/i, 'skip review of']],
  ['C3 lows do not block', review, [/low/i, /approval/i, /merge/i],
    'Low findings never block approval or merge.', [/do not block|never block/i, 'block'], /do not block|never block/i],
  ['C3 one linked follow-up issue in the right tracker', review,
    [/owner/i, /records?|logs?/i, /all low findings/i, /one|single/i, /follow-up issue/i, /repository.s tracker/i,
      /GitHub Issues/i, /Linear for `defi-com`/i, /linked from the PR/i],
    'The owner logs all low findings in a single follow-up issue in the repository\'s tracker (GitHub Issues, or Linear for `defi-com`), linked from the PR.',
    [/one|single/i, 'several']],
  ['C3 follow-up does not gate merge', review, [/follow-up issue/i, /merge/i],
    'The follow-up issue does not gate merge.', [/never gates?|does not gate/i, 'gates'], /never gates?|does not gate/i],
  ['C1 diligence loads the shared rubric', diligence, [/load|follow/i, /Finding severity/i, /shared rubric/i],
    'Follow Finding severity for the shared rubric.', [/load|follow/i, 'ignore']],
  ['C3 diligence blockers mean FINDINGS', diligence, [/diligence/i, /returns?|reports?/i, /FINDINGS/i, /any|every/i, /medium/i, /high/i, /mismatch/i],
    'Diligence reports FINDINGS for every medium or high mismatch.', [/FINDINGS/i, 'PASS']],
  ['C3 diligence lists only lows with PASS', diligence,
    [/diligence/i, /returns?|reports?/i, /PASS/i, /low items listed/i, /only low mismatches remain/i],
    'Diligence reports PASS with the low items listed when only low mismatches remain.', [/PASS/i, 'FINDINGS']],
  ['C3 diligence UNKNOWN unchanged', diligence, [/diligence/i, /UNKNOWN/i, /unchanged|intact/i, /keep|preserve/i],
    'Preserve diligence UNKNOWN intact.', [/unchanged|intact/i, 'as PASS']],
  ['C4 receipt IDs establish agent authorship', watch,
    [/only/i, /comments and threads/i, /IDs/i, /recorded in an agent receipt/i, /count as agent-authored/i],
    'Only comments and threads with IDs recorded in an agent receipt count as agent-authored.',
    [/only/i, 'all']],
  ['C4 every other item holds automatic merge', watch,
    [/every other/i, /review thread/i, /review body/i, /top-level comment/i, /human or (?:a )?bot/i, /holds? automatic merge/i],
    'Every other review thread, review body, or top-level comment from a human or bot holds automatic merge.',
    [/holds? automatic merge/i, 'permits automatic merge']],
  ['C4 card waits for human resolution or dismissal', watch,
    [/post/i, /merge card/i, /non-agent items/i, /until/i, /human/i, /resolves? or dismisses?/i],
    'Post a merge card for these non-agent items until a human resolves or dismisses them.',
    [/human/i, 'agent']],
  ['C4 unresolvable items need a named card reply', watch,
    [/clear/i, /GitHub-unresolvable/i, /review bodies/i, /top-level comments/i, /only/i, /user.s reply/i, /that merge card/i, /naming the items/i],
    'Clear GitHub-unresolvable review bodies and top-level comments only by the user\'s reply to that merge card naming the items.',
    [/naming the items/i, 'without naming them']],
  ['C4 agents never rate resolve or dismiss external items', watch,
    [/agents/i, /rate/i, /resolve/i, /dismiss/i, /non-agent items/i],
    'Agents never rate, resolve, or dismiss these non-agent items.', [/never/i, 'can'], /never/i],
  ['C4 always-commenting bot holds until user clears threads', watch,
    [/always-commenting review bot/i, /blocks? automatic merge/i, /until/i, /user/i, /clears? its threads/i],
    'An always-commenting review bot blocks automatic merge until the user clears its threads.',
    [/user/i, 'agent']],
  ['C4 low agent threads can remain open', watch,
    [/agent-authored threads/i, /only/i, /low/i, /can (?:stay|remain) open/i],
    'Agent-authored threads containing only low findings can remain open.',
    [/can (?:stay|remain) open/i, 'must close']],
  ['C4 repository conversation resolution still applies', watch,
    [/apply|honor/i, /any|every/i, /repository rule/i, /requires? conversation resolution/i],
    'Honor every repository rule that requires conversation resolution.', [/apply|honor/i, 'ignore']],
];

const acceptsRule = ([, , concepts, , , prohibition]) => (text) => prohibition
  ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);

for (const rule of rules) {
  const [name, path, concepts, rewording, inversion] = rule;
  test(`review severity: ${name}`, () => {
    checkRule(compact(path), acceptsRule(rule), rewording, [inversion], concepts);
  });
  test(`review severity real-source rewording: ${name}`, () => {
    const text = compact(path);
    const targets = sentences(text).filter(acceptsRule(rule));
    expect(targets.length).toBeGreaterThan(0);
    const reworded = targets.reduce((source, target) => source.replace(target, rewording), text);
    for (const sibling of rules.filter((row) => row[1] === path)) {
      expect(acceptsRule(sibling)(reworded), sibling[0]).toBe(true);
    }
  });
}

test('diligence uses the packaged severity definition once, without a second rubric', () => {
  expect(loadedReferences(read(diligence))).toContain('../../axstack-review/SKILL.md#finding-severity');
  expect(read(diligence)).not.toMatch(/`(?:high|medium|low)`\s*=/);
});

test('review receipts bind severity and agent comment IDs', () => {
  const receipt = read(review).split('## Template: review receipt')[1].split('## Prompt-only urgent escalation')[0];
  expect(receipt).toMatch(/Findings: <(?:severity|high).*evidence.*consequence/i);
  expect(receipt).toMatch(/Agent-authored comment and thread IDs: <.*none>/i);
});

test('watch predicate and maintenance use the C4 holds, preserving blocking feedback', () => {
  const text = compact(watch).split('## 5. State readiness precisely')[1].split('## 6.')[0];
  expect(text).toMatch(/no unresolved blocking agent-authored thread, top-level blocking comment, or effective blocking review remains/i);
  expect(text).toMatch(/until[^.]*current base[^.]*comment holds above are cleared[^.]*required CI is green[^.]*merge-ready/i);
  expect(text).not.toMatch(/every review comment and thread must be addressed|every review comment and thread is addressed/i);
});

test('publication prose rewording uses in-memory source instead of tracked writes', () => {
  expect(read('tests/workflows/publication-integrity.test.js')).not.toMatch(/\bwriteFileSync\b/);
});
