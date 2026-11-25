import { readSkillFile as readFileSync } from './skill-source.js';
import { expect, test } from 'bun:test';
import { checkRule, prohibits, requires as hasRule } from './prose-contract.js';


// These check instruction contracts, not live agent compliance. Synonyms allow
// prose edits; removal/inversion and paraphrase probes live in the run evidence.
const reference = '../axstack/references/test-value.md';
const linkedPolicy = (skill) => readFileSync(
  `${import.meta.dir}/../../skills/${skill}/SKILL.md`, 'utf8',
).split(/\n\s*\n/).find((paragraph) => paragraph.includes(`](${reference})`)) ?? '';
const sentences = (text) => text.replace(/\[[^\]]+\]\([^)]+\)/g, 'reference')
  .replace(/\s+/g, ' ').split(/[.!?]\s+/);
const requires = (text, ...concepts) => sentences(text).some((sentence) =>
  !/\b(?:no|not|never|skip|avoid\w*|optional|may)\b/i.test(sentence)
  && concepts.every((concept) => concept.test(sentence)));

test('authors gate all new and changed tests and reject failures', () => {
  const policy = linkedPolicy('axstack-implement');
  expect(requires(policy,
    /\b(?:apply|use|enforce)\b/i, /\bgate\b/i, /\b(?:every|each|all)\b/i,
    /\b(?:new|added)\b/i, /\b(?:changed|modified)\b/i, /\btests?\b/i,
  )).toBe(true);
  expect(sentences(policy).some((sentence) =>
    /\btests?\b.*\b(?:fail\w*|reject\w*)\b.*\bgate\b.*\b(?:is|are|must be) not added\b/i.test(sentence)
    || /\b(?:reject|exclude)\b.*\btests?\b.*\b(?:fail\w*)\b.*\bgate\b/i.test(sentence),
  )).toBe(true);
});

const valuePolicy = readFileSync(`${import.meta.dir}/../../skills/axstack/references/test-value.md`, 'utf8');
const implementPolicy = readFileSync(`${import.meta.dir}/../../skills/axstack-implement/SKILL.md`, 'utf8');
const section = (policy, heading) => policy.split(`\n${heading}\n`)[1]?.split(/\n#+ /)[0] ?? '';
const gate = section(valuePolicy, '## Authoring gate');
const normal = section(implementPolicy, '### Normal behavior path');
const repair = section(valuePolicy, '## F proof');

for (const [name, policy, concepts, rewording, inversion] of [
  ['new checks assert externally visible outcomes through a caller interface', gate,
    [/assert|check/i, /observable|visible/i, /outcome|behavior/i, /caller|public/i, /boundary|interface/i],
    'Check the behavior visible to callers through a public interface.', [/caller|public/gi, 'private']],
  ['new assertions use independently specified expectations', gate,
    [/choose|derive|specify/i, /expected results?|expectations?/i, /accepted contract|independent source/i],
    'Specify expectations from an independent source.', [/accepted contract|independent source/i, 'implementation under test']],
  ['new checks cover regressions missing from existing coverage', gate,
    [/new|add/i, /only/i, /regression|failure/i, /existing|current/i, /miss\w*|absent from/i],
    'Add a test only for a failure the current tests would miss.', [/miss\w*|absent from/i, 'already catch']],
  ['new tests survive unrelated refactors', gate,
    [/new test|checks?/i, /surviv\w*|keep\w*.*passing/i, /behavior.preserving|equivalent/i, /refactors?/i],
    'Checks keep passing through equivalent refactors.', [/surviv\w*|keep\w*.*passing/i, 'break']],
  ['CI executes the test body and blocking status is recorded', gate,
    [/verify|confirm/i, /\bCI\b/, /executes?|runs?/i, /test body|assertions/i, /record|document/i, /block\w*|required/i],
    'Confirm CI runs the assertions and document whether the check is required.', [/executes?|runs?/i, 'discovers']],
  ['scoped repairs to existing tests use the repair skill', normal,
    [/route|use|send/i, /scoped/i, /repairs?/i, /existing tests?/i, /axstack-test-fixing/],
    'Use axstack-test-fixing for scoped repairs to existing tests.', [/route|use|send/i, 'Never use']],
  ['code repair checks tolerate an equivalent refactor where applicable', repair,
    [/where relevant|where applicable/i, /equivalent|behavior.preserving/i, /code/i, /refactor/i, /green|pass\w*/i],
    'Where applicable, run the repaired check against a behavior-preserving code refactor and confirm it passes.', [/green|pass\w*/i, 'fails']],
  ['repair preserves CI gating', repair,
    [/preserve|retain|keep/i, /\bCI\b/, /gating|blocking/i],
    'Retain CI blocking status for the repaired check.', [/preserve|retain|keep/i, 'Remove']],
]) {
  test(name, () => checkRule(policy, (text) => hasRule(text, ...concepts), rewording, [inversion]));
}

test('normal TDD excludes opportunistic refactors of existing tests', () => {
  const exclusion = /\b(?:do not refactor|leave unchanged)\b/i;
  checkRule(normal, (text) => prohibits(text, exclusion, /existing tests?/i, /normal TDD/i),
    'In normal TDD, leave unchanged any existing tests.', [[exclusion, 'refactor']]);
});

test('reviewers assess every test hunk and inspect removal keepers without editing peer code', () => {
  const policy = linkedPolicy('axstack-review');
  expect(requires(policy,
    /\b(?:check|assess|evaluate)\b/i, /\badded\b/i,
    /\b(?:changed|modified)\b/i, /\b(?:removed|deleted)\b/i, /\btest hunks?\b/i,
  )).toBe(true);
  expect(requires(policy,
    /\b(?:inspect|verify|examine)\b/i, /\b(?:removed|deleted)\b/i,
    /\btests?\b/i, /\b(?:named|identified)\b/i, /\bkeepers?\b/i,
  )).toBe(true);
  expect(requires(policy, /\bpeer\b/i, /\breport[- ]only\b/i)).toBe(true);
  expect(sentences(policy).some((sentence) =>
    /\b(?:remov\w*|delet\w*)\b/i.test(sentence)
    && /\bwithout\b/i.test(sentence) && /\bkeepers?\b/i.test(sentence)
    && /\bvacuity\b/i.test(sentence) && /\bobsolescence\b/i.test(sentence)
    && /\b(?:is a finding|report\w* .*finding)\b/i.test(sentence),
  )).toBe(true);
});

test('test audits account for the bounded scope and route only proven cleanup through review', () => {
  const policy = readFileSync(`${import.meta.dir}/../../skills/axstack-improve/SKILL.md`, 'utf8');
  expect(linkedPolicy('axstack-improve')).not.toBe('');
  expect(requires(policy, /\b(?:one|single)\b/i, /\bowner(?:ship)? boundary\b/i)).toBe(true);
  expect(requires(policy,
    /\bmark\w*\b/i, /\b(?:every|each|all)\b/i, /\btest declarations?\b/i,
    /\bR\s*\/\s*F\s*\/\s*C\s*\/\s*D\b/, /\bcompleteness\b/i,
  )).toBe(true);
  expect(sentences(policy).some((sentence) =>
    /\b(?:no|not)\b/i.test(sentence) && /\bdelet\w*\b/i.test(sentence)
    && /\bquota\b/i.test(sentence),
  )).toBe(true);
  expect(requires(policy, /\breport\w*\b/i, /\breviewed\b/i, /\beligible\b/i, /\bcounts?\b/i)).toBe(true);
  expect(requires(policy, /\b(?:report|document)\b/i, /\bF\b/, /\bfindings?\b/i)).toBe(true);
  expect(requires(policy,
    /\b(?:every|each|all)\b/i, /\bC\s*\/\s*D\b/, /\bevidence\b/i,
    /\bname\b/i, /\blocation\b/i, /\bfailure\b/i, /\bkeeper\b/i,
    /\bvacuity\b/i, /\bobsolescence\b/i, /\bvalidation command\b/i,
  )).toBe(true);
  expect(requires(policy,
    /\bonly\b/i, /\bauthoriz\w*\b/i, /\bproven\b/i, /\bC\s*\/\s*D\b/,
    /\baxstack-implement\b/, /\bstructure-preserving\b/i,
    /\bsame[- ]check\b/i, /\bgreen\b/i, /\bbefore\b/i, /\bafter\b/i,
    /\bindependent\b.*\breview\b/i,
  )).toBe(true);
  expect(requires(policy,
    /\bonly\b/i, /\bauthoriz\w*\b/i, /\bF repairs?\b/,
    /\broute\w*\b/i, /\baxstack-implement\b/,
    /\b(?:through|via)(?: its| an?)?(?: normal)? independent review\b/i,
  )).toBe(true);
  expect(requires(policy,
    /\brepaired (?:check|test)\b/i, /\bpass\w*\b.*\bbase\b/i,
    /\bred\b/i, /\bremov\w*\b/i, /\binvert\w*\b/i,
    /\bdisposable mutation\b/i, /\brestor\w*\b.*\bbyte for byte\b/i,
    /\bsurviv\w*\b.*\breword\w*\b/i,
  )).toBe(true);
  expect(sentences(policy).some((sentence) =>
    /\b(?:never|do not) (?:weaken or loosen|loosen or weaken)(?: an?)? assertions?\b/i.test(sentence),
  )).toBe(true);
  expect(sentences(policy).some((sentence) =>
    /\breport\w*\b/i.test(sentence)
    && /\bproduction seams?\b/i.test(sentence)
    && /\btest-only\b|\bonly\b.*\btests?\b/i.test(sentence)
    && /\b(?:do not|never|without) (?:chang|edit|modif)\w*\b|\bunchanged\b/i.test(sentence),
  )).toBe(true);
  expect(requires(policy, /\bdiscovery\b/i, /\breport[- ]only\b/i)).toBe(true);
});

test('semantic prose checks reject removal and inversion but tolerate rewording with contract exemptions', () => {
  const policy = readFileSync(`${import.meta.dir}/../../AGENTS.md`, 'utf8');
  expect(requires(policy,
    /\bprose[- ]contract tests?\b/i, /\bsemantic instructions?\b/i,
    /\bmust\b.*\bfail\b/i, /\bremov\w*\b/i, /\binvert\w*\b/i,
    /\bsurviv\w*\b.*\breword\w*\b/i,
  )).toBe(true);
  expect(requires(policy, /\bexact prompt-byte\b/i, /\bpublic-key\b/i, /\bexempt\b/i)).toBe(true);
});
