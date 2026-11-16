import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = path => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const protocol = 'skills/axstack/references/capture-receipts.md';
const consumers = [
  ['review receipt', 'skills/axstack-review/references/review-receipt.md'],
  ['candidate brief', 'skills/axstack-review/references/candidate-brief.md'],
  ['candidate review', 'skills/axstack-review/references/review-candidate.md'],
  ['codebase review', 'skills/axstack-review/references/codebase-mode.md'],
  ['implementation', 'skills/axstack-implement/SKILL.md'],
  ['verification recipes', 'skills/axstack-verify/SKILL.md'],
];

// Instruction handoff contracts; not evidence of live agent compliance.
for (const [name, path] of consumers) {
  test(`${name} loads the capture receipt protocol`, () => {
    const text = read(path);
    const accepts = source => requires(source, /load|follow|read/i, /capture receipts/i);
    checkRule(text, accepts, 'Read Capture receipts for executable evidence.',
      [[/load|follow|read/gi, 'ignore']], [/load|follow|read/i, /capture receipts/i]);
    const target = text.match(/\[Capture receipts\]\(([^)]+)\)/)?.[1];
    expect(target).toBeDefined();
    expect(existsSync(`${root}/${path.slice(0, path.lastIndexOf('/'))}/${target}`)).toBe(true);
  });
}

const rules = [
  ['capture references carry identity',
    [/cite|reference/i, /each|every/i, /check-run/i, /receiptPath/i, /repository/i, /requested/i, /head/i, /base/i, /sourceBefore/i, /snapshot/i, /logSha256/i],
    'Reference every check-run capture by receiptPath and identity: repository, requested head/base, sourceBefore snapshot and logSha256.',
    [[/each|every/gi, 'selected'], [/logSha256/gi, 'invented hash']]],
  ['facts come from captures',
    [/read|derive/i, /argv/i, /cwd/i, /exitCode/i, /test counts/i, /log/i, /receipt/i],
    'Derive argv, cwd, exitCode and test counts from the receipt and its captured log.',
    [[/read|derive/gi, 'guess'], [/captured log/gi, 'memory']]],
  ['item ledger keeps identity and policy',
    [/record|keep/i, /each|every/i, /limitation/i, /stable/i, /id/i, /boundary/i, /changedAt/i, /raisedAt/i, /acceptedProofKinds/i, /sourceScope/i, /previousEvidence/i, /ledger/i],
    'Keep every limitation in the ledger with stable id, boundary, changedAt, raisedAt, acceptedProofKinds, sourceScope and previousEvidence.',
    [[/each|every/gi, 'selected'], [/stable/gi, 'newly invented']]],
  ['inspector consumes the ledger',
    [/run|execute/i, /evidence-inspector/i, /--input/i, /ledger/i, /report/i],
    'Execute evidence-inspector with --input ledger.json and retain its report.',
    [[/run|execute/gi, 'skip']]],
  ['each term and disposition is consumed',
    [/read|inspect/i, /each|every/i, /term/i, /id/i, /status/i, /reasonCode/i, /disposition/i],
    'Inspect every term by id, status, reasonCode and disposition.',
    [[/each|every/gi, 'selected'], [/disposition/gi, 'summary.pass']]],
  ['proof keeps kind and chronology limits',
    [/proof/i, /id/i, /itemId/i, /kind/i, /observedAt/i, /receipt/i, /caller.declared/i],
    'Proof carries id, itemId, kind, observedAt and receipt; kind and chronology are caller-declared.',
    [[/caller.declared/gi, 'capture-attested']]],
];
for (const [name, concepts, rewording, inversions] of rules) {
  test(`receipt protocol: ${name} survives rewording and rejects removal/inversion`, () => {
    // Semicolons keep clauses of one protocol instruction together.
    const normalize = text => sentences(text.replace(/;/g, ',')).join('. ');
    checkRule(normalize(read(protocol)), text => requires(text, ...concepts), normalize(rewording),
      [...inversions, [/^/, 'Do not ']], concepts);
  });
}
for (const [name, prohibition, concepts, rewording] of [
  ['summary is not proof', /never/i, [/summary.pass/i, /proof/i], 'Never use summary.pass as proof.'],
  ['acceptance stays unproven', /never/i, [/user-accepted-unproven/i, /proved/i], 'Never label user-accepted-unproven as proved.'],
]) test(`receipt protocol: ${name}`, () => {
  checkRule(read(protocol), text => prohibits(text, prohibition, ...concepts), rewording,
    [[/never/gi, 'always']], concepts);
});

test('receipt fields cite captures instead of manual command facts', () => {
  for (const [path, field] of [
    ['skills/axstack-review/references/review-receipt.md', 'Final-head check'],
    ['skills/axstack-review/references/review-receipt.md', 'Safety fact'],
    ['skills/axstack-implement/SKILL.md', 'Acceptance'],
    ['skills/axstack-verify/SKILL.md', 'Acceptance'],
  ]) {
    const line = read(path).split('\n').find(line => line.startsWith(`${field}:`)) ?? '';
    checkRule(line, text => requires(text, /capture|check-run/i, /receipt/i, /path/i, /identit(?:y|ies)/i),
      `${field}: cite check-run receipt path and identity.`, [[/identit(?:y|ies)/gi, 'description']],
      [/capture|check-run/i, /receipt/i, /path/i, /identit(?:y|ies)/i]);
  }
});

test('final-head receipt belongs to the reviewer drive', () => {
  const line = read('skills/axstack-review/references/review-receipt.md').split('\n')
    .find(line => line.startsWith('Final-head check:'));
  const concepts = [/reviewer/i, /final.head/i, /drive|ran/i, /check-run/i, /receipt/i];
  checkRule(line, text => requires(text, ...concepts),
    'Final-head check: cite the check-run receipt for the check the reviewer ran at the final head.',
    [[/reviewer/gi, 'author'], [/final.head/gi, 'earlier head']], concepts);
});

test('review and verification limitation fields carry reconciled item dispositions', () => {
  for (const [path, field] of [
    ['skills/axstack-review/references/review-receipt.md', 'Limitations'],
    ['skills/axstack-review/references/codebase-report.md', 'Limitations'],
    ['skills/axstack-implement/SKILL.md', 'Unverified'],
    ['skills/axstack-verify/SKILL.md', 'Unverified'],
  ]) {
    const line = read(path).split('\n').find(line => line.startsWith(`${field}:`));
    const concepts = [/ledger/i, /inspector/i, /item/i, /disposition/i];
    checkRule(line, text => requires(text, ...concepts),
      `${field}: cite ledger, inspector report and item dispositions.`,
      [[/disposition/gi, 'summary']], concepts);
  }
});
