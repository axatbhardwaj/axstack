import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { checkRule, requires, sentences } from './prose-contract.js';

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
  ['watch gate', 'skills/axstack-watch/references/proven-verification.md'],
  ['workflow mirror', 'docs/workflows.md'],
];

// Instruction handoff contracts; not evidence of live agent compliance.
for (const [name, path] of consumers) {
  test(`${name} loads the capture receipt protocol`, () => {
    const text = read(path);
    const accepts = source => requires(source, /load|follow|read/i, /capture receipts/i);
    checkRule(text, accepts, 'Read Capture receipts for executable evidence.',
      [[/load|follow|read/gi, 'ignore']], [/load|follow|read/i, /capture receipts/i]);
    const target = text.match(/\[Capture receipts\]\(([^)]+)\)/)?.[1]
      ?? text.match(/Capture receipts at (skills\/[^ ,]+)/)?.[1];
    expect(target).toBeDefined();
    expect(existsSync(target.startsWith('skills/') ? `${root}/${target}` : `${root}/${path.slice(0, path.lastIndexOf('/'))}/${target}`)).toBe(true);
  });
}

const rules = [
  ['capture references carry identity',
    [/cite|reference/i, /each|every/i, /check-run/i, /receiptPath/i, /repository/i, /requested/i, /head/i, /base/i, /sourceBefore/i, /snapshot/i, /logSha256/i],
    'Reference every check-run capture by receiptPath and identity: repository, requested head/base, sourceBefore snapshot and logSha256.',
    [[/each|every/gi, 'selected'], [/logSha256/gi, 'invented hash']]],
  ['facts come from captures',
    [/read|derive/i, /argv/i, /cwd/i, /exitCode/i, /test counts?/i, /log/i, /receipt/i],
    'Derive argv, cwd, exitCode and test counts from the receipt and its captured log.',
    [[/read|derive/gi, 'guess'], [/captured log/gi, 'memory']]],
  ['inspector consumes the ledger',
    [/run|execute/i, /evidence-inspector/i, /--input/i, /ledger/i, /retain|keep/i, /report/i],
    'Execute evidence-inspector with --input ledger.json and retain its report.',
    [[/run|execute/gi, 'skip']]],
  ['each term and disposition is consumed',
    [/read|inspect/i, /each|every/i, /term/i, /id/i, /status/i, /reasonCode/i, /disposition/i],
    'Inspect every term by id, status, reasonCode and disposition.',
    [[/each|every/gi, 'selected'], [/disposition/gi, 'summary.pass']]],

  ['capture helper owns flags and effects',
    [/use|run/i, /check-run/i, /--help/i, /flags?/i, /effects?/i],
    'Run check-run for evidence and consult --help for flags and effects.',
    [[/use|run/gi, 'ignore'], [/--help/gi, 'memory']]],
  ['owned evidence capture folder at pinned revisions',
    [/create|make/i, /owned/i, /0700/i, /subfolder/i, /run.?s evidence folder/i, /outside source and writable mounts?/i, /check-run/i, /--out/i, /pinned head\/base/i],
    'Make an owned 0700 subfolder in the runs evidence folder outside source and writable mounts for check-run --out at the pinned head/base.',
    [[/0700/gi, '0755'], [/outside source and writable mounts?/gi, 'inside source'], [/pinned head\/base/gi, 'any revision']]],
  ['JSON Pointer citations replace copied identity hashes',
    [/use/i, /JSON Pointer/i, /references?/i, /instead of/i, /transcribing hash(?:es)?/i],
    'Use JSON Pointer references instead of transcribing hashes.',
    [[/JSON Pointer/gi, 'free-form'], [/instead of/gi, 'alongside']]],
  ['stated child result has its own citation',
    [/stated child result/i, /requires/i, /citation/i, /#\/exitCode/i],
    'A stated child result requires a citation to #/exitCode.',
    [[/requires/gi, 'discards'], [/#\/exitCode/gi, '#/wrapperExit']]],
  ['inspector help owns the schema and refresh rules',
    [/follow|read/i, /evidence-inspector/i, /--help/i, /ledger/i, /dispositions?/i, /refresh rules?/i],
    'Read evidence-inspector --help for the item ledger, dispositions and refresh rules.',
    [[/follow|read/gi, 'ignore'], [/--help/gi, 'a duplicate schema']]],
  ['open failed or unknown items remain gaps',
    [/keep/i, /open/i, /fail/i, /unknown/i, /items?/i, /gaps?/i, /owning workflow/i, /holds?/i],
    "Keep every open, fail or unknown item as a gap under the owning workflow's holds.",
    [[/keep/gi, 'drop'], [/gaps?/gi, 'passes']]],
  ['zero limitations use none and n/a',
    [/zero limitations?/i, /record/i, /none/i, /inspector/i, /n\/a/i],
    'For zero limitations record none and inspector n/a.',
    [[/record/gi, 'drop'], [/n\/a/gi, 'pass']]],
  ['limitation citations bind ledger report and item IDs',
    [/cite/i, /ledger path/i, /inspector report/i, /item IDs?/i, /Limitations/i, /Unverified/i],
    'Cite ledger path, inspector report and item ID in Limitations/Unverified.',
    [[/cite/gi, 'discard'], [/item IDs?/gi, 'summary']]],
  ['reviewer judges proof sufficiency',
    [/reviewer/i, /judges|assesses/i, /proof kind/i, /semantic sufficiency/i, /coverage/i, /safety/i],
    'The reviewer assesses proof kind, semantic sufficiency, coverage and safety.',
    [[/reviewer/gi, 'inspector'], [/judges|assesses/gi, 'ignores']]],
];
for (const [name, concepts, rewording, inversions] of rules) {
  test(`receipt protocol: ${name} survives rewording and rejects removal/inversion`, () => {
    // Semicolons keep clauses of one protocol instruction together.
    const normalize = text => sentences(text.replace(/;/g, ',')).join('. ');
    checkRule(normalize(read(protocol)), text => requires(text, ...concepts), normalize(rewording),
      [...inversions, [/^/, 'Do not ']], concepts);
  });
}
test('receipt fields cite captures instead of manual command facts', () => {
  for (const [path, field] of [
    ['skills/axstack-review/references/review-receipt.md', 'Final-head check'],
    ['skills/axstack-review/references/review-receipt.md', 'Safety fact'],
    ['skills/axstack-implement/SKILL.md', 'Acceptance'],
    ['skills/axstack-verify/SKILL.md', 'Acceptance'],
    ['skills/axstack-audit/references/record.md', 'Acceptance'],
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


test('safety fact references limitation items only when applicable', () => {
  const source = read('skills/axstack-review/references/review-receipt.md').split('\n')
    .find(line => line.startsWith('Safety fact:'));
  const concepts = [/limitation.ledger item ID/i, /if applicable/i, /otherwise n\/a/i];
  checkRule(source, text => requires(text, ...concepts),
    'Use a limitation-ledger item ID if applicable, otherwise n/a.',
    [[/limitation.ledger/gi, 'invented safety'], [/otherwise n\/a/gi, 'otherwise invent one']], concepts);
});


test('PR proof command facts cite capture identities', () => {
  const concepts = [/Proof.*section/i, /check-run/i, /receipt/i, /paths?/i, /identit(?:y|ies)/i];
  checkRule(read('skills/axstack/references/pr-shape.md'), text => requires(text, ...concepts),
    'A Proof section cites check-run receipt paths/identities.',
    [[/check-run/gi, 'hand-written']], concepts);
});

test('review producer and both watch gates share the capture citation contract', () => {
  const concepts = [/Final-head check/i, /check-run receipt path/i, /identity/i, /cited fields?/i,
    /#\/argv/i, /->/i, /#\/logPath/i, /#\/exitCode/i];
  for (const path of ['skills/axstack-review/references/review-receipt.md',
    'skills/axstack-watch/references/proven-verification.md', 'docs/workflows.md']) {
    checkRule(read(path), text => requires(text, ...concepts),
      'Final-head check: cite check-run receipt path + identity + cited field: #/argv -> #/logPath, #/exitCode.',
      [[/check-run receipt path/gi, 'hand-written command']], concepts);
  }
});


test('watch gates bind receipt identity to the candidate revisions', () => {
  const concepts = [/compare|match/i, /#\/requested\/head/i, /#\/requested\/base/i, /candidate head\/base/i];
  for (const path of ['skills/axstack-watch/references/proven-verification.md', 'docs/workflows.md']) {
    checkRule(read(path), text => requires(text, ...concepts),
      'Match #/requested/head and #/requested/base with candidate head/base.',
      [[/compare|match/gi, 'ignore']], concepts);
  }
});

test('review limitations provide a per-item unproven tag slot', () => {
  const line = read('skills/axstack-review/references/review-receipt.md').split('\n')
    .find(line => line.startsWith('Limitations:'));
  const concepts = [/items?/i, /tags?/i, /changed-behavior: unproven/i];
  checkRule(line, text => requires(text, ...concepts),
    'Limitations: list each item and its tag, including changed-behavior: unproven.',
    [[/tags?/gi, 'summary']], concepts);
});
