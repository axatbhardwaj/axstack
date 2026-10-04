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

// These protect declared instructions, not live driver enforcement. Each rule
// has its own failure direction and an independent equivalent rewording.
const rules = [
  ['one row per acceptance clause', closeOut,
    [/one row per acceptance check|each acceptance check.{0,30}(?:own|separate) row|(?:own|separate) row.{0,30}each acceptance check/i, /each clause|every clause/i],
    /one row per acceptance check|each acceptance check its own row/i, 'one row for selected acceptance checks',
    'Give each acceptance check its own row, including every clause of compound checks.'],
  ['evidence or user-accepted hold', closeOut,
    [/record|enter/i, /each row/i, /passing evidence (?:pointer|ref)/i, /\bor\b/i, /user-accepted hold/i, /Decisions/i],
    /user-accepted hold/i, 'driver-accepted hold',
    'Enter in each row a passing evidence reference or a user-accepted hold with its Decisions row.'],
  ['A-P2/B3: unmet clause without a Decisions hold blocks close-out', closeOut,
    [/acceptance clause/i, /lacks|missing/i, /passing evidence and/i, /Decisions/i, /user-accepted hold/i, /hold close-out|close-out (?:must )?hold/i],
    /hold close-out/i, 'allow close-out',
    'Hold close-out when an acceptance clause is missing passing evidence and a Decisions row with a user-accepted hold.'],
  ['A-P2 holdout: recorded accepted hold satisfies the clause', closeOut,
    [/recorded|documented/i, /user-accepted hold/i, /Decisions/i, /satisfies|sufficient/i, /clause/i, /close-out/i],
    /satisfies|is sufficient/i, 'does not satisfy',
    'For close-out, a documented user-accepted hold in Decisions is sufficient for that clause.'],
  ['B3: each driver-elected repair records its reason', closeOut,
    [/record|enter/i, /reason/i, /each|every/i, /driver-elected repair/i, /Decisions/i],
    /(?:each|every) driver-elected repair/i, 'selected driver-elected repairs',
    'Enter in Decisions the reason for every driver-elected repair.'],
  ['Close-out requires the linked acceptance table', () => section(lifecycle, '## Close-out', '\u0000'),
    [/require|must/i, /close-out acceptance table/i],
    /requires|must include/i, 'may omit',
    'Close-out must include the close-out acceptance table (run-record.md#close-out-acceptance).'],
  ['A-P1: checkpoint identifies each adviser receipt revision', checkpoint,
    [/name|identify/i, /draft revision/i, /covered by|covering/i, /each|every/i, /adviser receipt/i, /checkpoint/i],
    /(?:each|every) adviser receipt/i, 'one adviser receipt',
    'At the checkpoint, identify the draft revision covered by every adviser receipt.'],
  ['A-P1: rev N text with receipt on rev N-1 holds approval', checkpoint,
    [/draft text changed|changed draft text/i, /adviser receipt/i, /older revision/i, /hold approval/i, /fresh receipts/i, /presented revision/i],
    /hold approval/i, 'allow approval',
    'With changed draft text and an adviser receipt on an older revision, hold approval until fresh receipts cover the presented revision.'],
  ['A-P1 holdout: only Decisions changed reuses receipts', checkpoint,
    [/change confined|only.*change/i, /Decisions.*row/i, /reuse/i, /adviser receipts/i, /only while|provided/i, /draft text/i, /evidence/i, /scope/i, /question/i, /unchanged/i],
    /(?:remain|stay) unchanged/i, 'may change',
    'If only a Decisions row changes, reuse adviser receipts provided draft text, evidence, scope, and question stay unchanged.'],
];

for (const [name, source, concepts, flip, inverse, rewording] of rules) {
  test(`close-out/spec: ${name}`, () => {
    const text = source();
    expect(requires(text, ...concepts), 'missing required instruction').toBe(true);
    const clauses = sentences(text);
    const matching = clauses.filter((clause) => requires(clause, ...concepts));
    expect(matching).toHaveLength(1);
    const rewrite = (replacement) => clauses.map((clause) =>
      matching.includes(clause) ? replacement(clause) : clause).join('. ');
    expect(requires(rewrite(() => ''), ...concepts), 'removal').toBe(false);
    expect(matching[0]).toMatch(flip);
    expect(requires(rewrite((clause) => clause.replace(flip, inverse)), ...concepts), 'inversion').toBe(false);
    expect(requires(rewrite(() => rewording), ...concepts), 'equivalent rewording').toBe(true);
    expect(requires(rewrite(() => `Do not ${rewording}`), ...concepts), 'negated rewording').toBe(false);
  });
}

test('close-out acceptance template keeps evidence, accepted holds, and repair reasons reviewable', () => {
  expect(section(lifecycle, '## Close-out', '\u0000')).toMatch(/\[close-out acceptance table\]\(run-record\.md#close-out-acceptance\)/i);
  const template = closeOut().match(/```markdown\n([\s\S]*?)```/)?.[1];
  expect(template, 'missing table template').toBeTruthy();
  const rows = template.trim().split('\n');
  expect(rows[0]).toMatch(/Acceptance check.*Result.*Evidence.*user-accepted hold.*Repair.*reason/i);
  for (const row of rows.slice(2)) expect(row.split('|')).toHaveLength(rows[0].split('|').length);
  expect(rows[2]).toMatch(/passed.*SHA.*check.*log/i);
  expect(rows[3]).toMatch(/held.*user.accepted.*Decisions.*user.*receipt/i);
  expect(rows[2]).toMatch(/Decisions.*reason.*none/i);
});
