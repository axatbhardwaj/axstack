import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const audit = () => readFileSync(`${root}/skills/axstack-audit/SKILL.md`, 'utf8');
const proposals = () => audit().split(/## 5\.[^\n]*\n/)[1]?.split(/\n## 6\./)[0] ?? '';
const clausesOf = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

// These contracts protect the new proposal scope and evidence/authority limits.
// Existing owned-audit and correct-integration tests own delivery and §6 parity.
// Mutations operate on real source in memory; they never edit tracked guidance.
const rules = [
  ['proposal scope', [/one/i, /bounded/i, /hypothesized/i, /skill or environment change/i],
    [/skill or environment change/gi, 'skill change'], '3. Propose one hypothesized, bounded skill or environment change.'],
  ['optional lens', [/environment lens/i, /optional/i, /proposals/i],
    [/optional/gi, 'mandatory'], 'For bounded proposals, the environment lens is optional.', /optional/i],
  ['environment targets', [/consider|inspect/i, /navigation pointers/i, /automated checks/i, /coding.standard placement for review/i, /steering.file bloat/i, /no.op instructions/i, /tool economy/i, /information access/i],
    [/consider|inspect/gi, 'ignore'], 'Inspect navigation pointers, automated checks, coding-standard placement for review, steering-file bloat and no-op instructions, tool economy, and information access.', /no.op instructions/i],
  ['trim parity', [/steering.file trims/i, /follow|apply/i, /section 6/i, /AGENTS\.md/i, /CLAUDE\.md/i, /parity rule/i],
    [/follow|apply/gi, 'bypass'], "For steering-file trims, apply section 6's AGENTS.md and CLAUDE.md parity rule."],
  ['recurrence route', [/repeated mistakes/i, /route|refer/i, /axstack-correct/i, /section 6/i, /proposals/i],
    [/axstack-correct/gi, 'environment cleanup'], 'Refer repeated mistakes to axstack-correct as section 6 proposals.'],
  ['existing checks first', [/before proposing/i, /new check/i, /report|state/i, /whether/i, /existing check/i, /unwired or broken/i],
    [/before proposing/gi, 'after proposing'], 'Before proposing a new check, state whether an existing check is unwired or broken.'],
  ['mechanical rules', [/mechanical rule/i, /prefer|favor/i, /deterministic check/i, /over/i, /prose rule/i],
    [/prefer|favor/gi, 'reject'], 'For a mechanical rule, favor a deterministic check over a prose rule.'],
  ['read boundary', [/read only/i, /evidence/i, /section 2/i, /permits/i, /plus/i, /read.only/i, /AGENTS\.md/i, /CLAUDE\.md/i, /CI configuration/i, /package scripts/i, /at the audited revision/i],
    [/read only/gi, 'read any'], 'Read only the evidence that section 2 permits plus read-only AGENTS.md and CLAUDE.md, CI configuration and package scripts at the audited revision.'],
  ['transcript boundary', [/read/i, /transcripts/i, /environment lens/i],
    [/no transcripts/gi, 'all transcripts'], 'For the environment lens, read no transcripts.', /no transcripts/i],
  ['unsupported findings', [/finding/i, /without (?:an? )?(?:evidence )?pointer/i, /report|mark/i, /UNKNOWN/],
    [/UNKNOWN/g, 'PASS'], 'When a finding is without an evidence pointer, mark it UNKNOWN.', /without (?:an? )?(?:evidence )?pointer/i],
  ['edit boundary', [/environment lens/i, /automatic edit/i],
    [/no automatic edit/gi, 'an automatic edit'], 'The environment lens performs no automatic edit.', /no automatic edit/i],
  ['delivery preservation', [/environment lens/i, /keep|retain/i, /existing delivery path/i, /field 6/i],
    [/keep|retain/gi, 'replace'], 'For the environment lens, retain the existing delivery path in field 6.'],
];

// Mask the expected negative phrase, including the literal category "no-op".
const accepts = (row) => (text) => clausesOf(text).some((clause) => row[4]
  ? prohibits(clause, row[4], ...row[1]) : requires(clause, ...row[1]));

for (const row of rules) {
  const [name, concepts, [direction, inverse], rewording] = row;
  test(`audit environment: ${name}`, () => {
    const clauses = clausesOf(proposals());
    const check = accepts(row);
    const matches = clauses.filter(check);
    expect(matches, 'missing or ambiguous required instruction').toHaveLength(1);
    const substitute = (replacement) => clauses.map((clause) => clause === matches[0] ? replacement : clause).join('\n');
    expect(check(substitute('')), 'removal').toBe(false);
    for (const concept of concepts) {
      expect(check(substitute(matches[0].replace(new RegExp(concept.source, 'gi'), ''))), 'qualifier removal').toBe(false);
    }
    expect(matches[0]).toMatch(direction);
    expect(check(substitute(matches[0].replace(direction, inverse))), 'inversion').toBe(false);
    expect(check(substitute(`Do not ${matches[0].replace(/^\d+\.\s*/, '')}`)), 'negation').toBe(false);
    const rewritten = substitute(rewording);
    for (const sibling of rules) expect(accepts(sibling)(rewritten), sibling[0]).toBe(true);
    expect(rewording).toMatch(direction);
    expect(check(substitute(rewording.replace(direction, inverse))), 'reworded inversion').toBe(false);
  });
}

test('audit environment: pinned source and license', () => {
  const text = proposals();
  // Pinned provenance is an exact identifier contract, not semantic prose.
  const url = 'https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/retro/SKILL.md';
  const attribution = (source) => requires(source, /Matt Pocock/i, /retro/i, /MIT/i) && source.includes(url);
  expect(attribution(text)).toBe(true);
  expect(attribution(text.replace(url, ''))).toBe(false);
  expect(attribution(text.replace(/MIT/g, 'unverified'))).toBe(false);
  expect(attribution(`Environment ideas paraphrased from Matt Pocock's [retro](${url}) (MIT).`)).toBe(true);
});
