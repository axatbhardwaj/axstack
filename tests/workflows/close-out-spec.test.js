import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const record = 'skills/axstack/references/run-record.md';
const lifecycle = 'skills/axstack/references/lifecycle.md';
const spec = 'skills/axstack-spec/SKILL.md';
const section = (path, heading, end) => read(path).split(heading)[1]?.split(end)[0] ?? '';
const closeOut = () => section(record, '## Close-out acceptance', '## Privacy');
const checkpoint = () => section(spec, '4. **Obtain', '5. **Snapshot');
const acceptedHold = /user[- ](?:accepted|approved) (?:hold|deferral)|(?:hold|deferral).{0,20}(?:accepted|approved) by (?:the )?user/i;

// Declared instructions only. Independent paraphrases and contrary directions
// exercise the concepts without requiring a literal phrase in the source.
const rules = [
  ['one row per acceptance clause', closeOut,
    [/row|entry/i, /per acceptance check|(?:each|every|all) acceptance (?:check|criterion|criteria)/i, /each clause|every clause|all clauses/i],
    ['Give each acceptance check its own row, including every clause of compound checks.',
      'For every acceptance criterion, provide a separate entry covering all clauses.'],
    'Use one row for selected acceptance checks, including each clause of a compound check.'],
  ['evidence or user-accepted hold', closeOut,
    [/record|enter|carry|include|contain/i, /(?:each|every) row/i, /passing|passed|success/i, /evidence|proof/i, /pointer|reference|ref|link/i, /\bor\b/i, acceptedHold, /Decisions/i],
    ['Each row must carry a passing evidence pointer, or else a user-accepted hold citing its Decisions row.',
      'Every row includes a link to proof of success or a hold approved by the user in Decisions.'],
    'Each row must carry passing evidence or a driver-accepted hold citing its Decisions row.'],
  ['A-P2/B3: unmet clause without a Decisions hold blocks close-out', closeOut,
    [/acceptance (?:clause|check)/i, /neither.{0,100}nor|both.{0,100}missing|missing.{0,30}both|lacks both/i, /passing evidence|proof of success/i, /Decisions/i, acceptedHold, /hold close-out|block close-out|close-out (?:is|must be) (?:held|blocked)/i],
    ['Hold close-out when both passing evidence and a Decisions row with a user-accepted hold are missing for an acceptance clause.',
      'If neither proof of success nor a Decisions entry for a hold approved by the user exists for an acceptance check, block close-out.'],
    'If neither passing evidence nor a Decisions row with a user-accepted hold exists for an acceptance clause, allow close-out.'],
  ['A-P2 holdout: recorded accepted hold satisfies the clause', closeOut,
    [/recorded|documented|logged/i, acceptedHold, /Decisions/i, /satisfies|sufficient|meets|permits/i, /clause|check/i, /close-out/i],
    ['For close-out, a documented user-accepted hold in Decisions is sufficient for that clause.',
      'A hold approved by the user and logged in Decisions meets the acceptance check for close-out.'],
    'A recorded user-accepted hold in Decisions does not satisfy that clause for close-out.'],
  ['B3: each driver-elected repair records its reason', closeOut,
    [/record|enter|log/i, /reason|why|rationale/i, /each|every|all/i, /driver[- ](?:elected|chosen) repair/i, /Decisions/i],
    ['Log in Decisions why every driver-elected repair was chosen.',
      'For all driver-chosen repairs, enter the rationale in Decisions.'],
    'Log in Decisions why selected driver-elected repairs were chosen.'],
  ['Close-out requires the linked acceptance table', () => section(lifecycle, '## Close-out', '\u0000'),
    [/require|must|needs?|mandatory/i, /close-out/i, /acceptance/i, /table/i],
    ['Close-out needs the close-out acceptance table.',
      'The acceptance table is mandatory for close-out.'],
    'Close-out may omit the close-out acceptance table.'],
  ['A-P1: checkpoint identifies each adviser receipt revision', checkpoint,
    [/name|identify|state|show|indicate/i, /draft/i, /revision|version/i, /each|every|all/i, /adviser/i, /receipt/i, /covers?|covering|reviewed/i, /checkpoint/i],
    ['At the checkpoint, state which draft revision each adviser receipt covers.',
      'Show at the checkpoint the version of the draft reviewed by every adviser receipt.'],
    'At the checkpoint, state which draft revision one adviser receipt covers.'],
  ['A-P1: rev N text with receipt on rev N-1 holds approval', checkpoint,
    [/draft text|draft wording/i, /\b(?:changed|edited)\b/i, /adviser receipt/i, /older|previous/i, /revision|version/i, /hold approval|block approval|withhold approval/i, /fresh receipts|new receipts|updated receipts/i, /presented|current/i],
    ['When the draft text has changed since an adviser receipt was given on an older revision, hold approval until fresh receipts cover the presented revision.',
      'If draft wording was edited after an adviser receipt on a previous version, block approval until updated receipts cover the current version.'],
    'When draft text has changed since an adviser receipt on an older revision, allow approval before fresh receipts cover the presented revision.'],
  ['A-P1 holdout: Decisions-only reuse preserves the high-stakes exception', checkpoint,
    [/confined|only|limited/i, /Decisions/i, /reuse/i, /adviser receipts/i, /draft text/i, /evidence/i, /scope/i, /question/i, /unchanged/i, /unless|except|excluding/i, /high-stakes/i],
    ['If only a Decisions row changes, reuse adviser receipts provided draft text, evidence, scope, and question stay unchanged, except for high-stakes decisions.',
      'A change limited to Decisions reuses adviser receipts with draft text, evidence, scope, and question unchanged, excluding high-stakes decisions.'],
    'If only a Decisions row changes, reuse adviser receipts with draft text, evidence, scope, and question unchanged, including high-stakes decisions.'],
  ['Archived receipts include the acceptance table', () => section(lifecycle, '`Archived`—one each:', '`active`'),
    [/close-out/i, /acceptance/i, /table/i],
    ['The acceptance table for close-out.', 'Close-out table of acceptance checks.'],
    'The close-out task table.'],
];

for (const [name, source, concepts, rewordings, inverse] of rules) {
  test(`close-out/spec: ${name}`, () => {
    const clauses = sentences(source());
    const matching = clauses.filter((clause) => requires(clause, ...concepts));
    expect(matching.length, 'missing required instruction').toBeGreaterThan(0);
    expect(requires(clauses.filter((clause) => !matching.includes(clause)).join('. '), ...concepts), 'removal').toBe(false);
    expect(requires(inverse, ...concepts), 'inversion').toBe(false);
    for (const rewording of rewordings) {
      expect(requires(rewording, ...concepts), 'equivalent rewording').toBe(true);
      expect(requires(`Do not ${rewording}`, ...concepts), 'negated rewording').toBe(false);
    }
  });
}

test('close-out acceptance template keeps evidence, accepted holds, and repair reasons reviewable', () => {
  expect(section(lifecycle, '## Close-out', '\u0000')).toMatch(/\]\(run-record\.md#close-out-acceptance\)/);
  const template = closeOut().match(/```markdown\n([\s\S]*?)```/)?.[1];
  expect(template, 'missing table template').toBeTruthy();
  const cells = template.trim().split('\n').map((row) => row.split('|').slice(1, -1));
  const headers = [[/acceptance/i, /check|clause|criterion/i], [/result|outcome/i], [/evidence|proof/i, /hold/i], [/repair/i, /reason|why|rationale/i]];
  headers.forEach((concepts, index) => expect(concepts.every((concept) => concept.test(cells[0][index]))).toBe(true));
  for (const row of cells.slice(2)) expect(row).toHaveLength(cells[0].length);
  expect(cells.slice(2).some((row) => /\b(?:passed|met)\b/i.test(row[1]) && /SHA/i.test(row[2]) && /check|log/i.test(row[2]))).toBe(true);
  expect(cells.slice(2).some((row) => /held|unmet/i.test(row[1]) && /user.*(?:accept|approv)/i.test(row[1]) && /Decisions/i.test(row[2]) && /user/i.test(row[2]) && /receipt/i.test(row[2]))).toBe(true);
  expect(cells.slice(2).every((row) => /Decisions/i.test(row[3]) && /reason|why|rationale/i.test(row[3]) && /none/i.test(row[3]))).toBe(true);
});
