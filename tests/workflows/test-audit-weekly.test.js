import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const path = `${import.meta.dir}/../../skills/axstack/references/test-audit-weekly.md`;
// An absent prompt is an absent instruction, not an import/setup failure.
const policy = existsSync(path) ? readFileSync(path, 'utf8') : '';
const sentences = (text) => text.replace(/`/g, '').replace(/\s+/g, ' ').split(/[.!?]\s+/);
const requires = (text, ...concepts) => sentences(text).some((sentence) =>
  !/\b(?:not|never|optional|may)\b/i.test(sentence)
  && concepts.every((concept) => concept.test(sentence)));
const noPublication = (sentence) =>
  /\bpublish nothing\b|\b(?:do not|never) (?:publish|open\b.*\bPR)\b|\bno (?:PR|publication)\b/i.test(sentence)
  && !/\b(?:not|never) publish nothing\b|\b(?:may|must|should) (?:publish|open)\b/i.test(sentence);

test('weekly audits withhold publication on unsafe or empty admission', () => {
  const conditions = [
    /\b(?:red|failing)\b.*\b(?:baseline|starting suite)\b/i,
    /\b(?:flaky|unstable)\b.*\b(?:baseline|starting suite)\b/i,
    /\b(?:overlap\w*|conflict\w*)\b.*\b(?:live|active)\b.*\bOrca\b.*\b(?:Run|worktree)\b.*\b(?:ownership|owned paths)\b/i,
    /\b(?:open|pending)\b.*\btest-audit PR\b/i,
    /\b(?:zero|no) proven candidates\b/i,
  ];
  for (const condition of conditions) {
    expect(sentences(policy).some((sentence) => condition.test(sentence)
      && noPublication(sentence)), `publication guard: ${condition}`).toBe(true);
  }
});

test('weekly test edits forbid weakening and changes to delivery controls', () => {
  const forbidden = [
    /\bskip\b/i, /\bonly\b/i, /\bxfail\b/i,
    /\b(?:rewrit\w* snapshots?|snapshot rewrites?)\b/i,
    /\bcoverage[- ]thresholds?\b/i, /\bCI\b/, /\bline[- ]caps?\b/i,
  ];
  for (const edit of forbidden) {
    expect(sentences(policy).some((sentence) =>
      edit.test(sentence.split(/\b(?:never|do not|forbidden|prohibited)\b/i)[1] ?? '')
      && !/\b(?:not forbidden|not prohibited|do not forbid|never prohibit|allowed|permitted)\b/i.test(sentence)),
    `forbidden edit: ${edit}`).toBe(true);
  }
});

test('F repairs prove the retained contract without loosening assertions', () => {
  expect(requires(policy, /\bF repairs?\b/i, /\b(?:must|require)\b/i,
    /\bpass\w*\b.*\bbase\b/i, /\b(?:red|fail\w*)\b/i,
    /\bcontract\b/i, /\b(?:instruction|code)\b/i, /\bremov\w*\b/i, /\binvert\w*\b/i,
    /\btargeted disposable mutation\b/i, /\brestor\w*\b.*\bbyte for byte\b/i)).toBe(true);
  expect(sentences(policy).some((sentence) =>
    /\b(?:never|do not)\b.*\b(?:weaken|loosen)\b.*\bassertions?\b/i.test(sentence)
    && !/\b(?:may|should|must) (?:weaken|loosen)\b/i.test(sentence))).toBe(true);
});
