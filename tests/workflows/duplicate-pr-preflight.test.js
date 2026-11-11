import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const path = `${import.meta.dir}/../../skills/axstack-implement/SKILL.md`;
const source = sentences(readFileSync(path, 'utf8').replaceAll('`', '')).join('. ');

// The shipped dispatch instructions are the contract boundary. Mutations stay
// in memory; this bounded grammar proves neither arbitrary English nor live compliance.
const rules = [
  ['search before an issue/ticket author dispatch',
    [/before|prior to/i, /fresh|new/i, /author/i, /dispatch/i, /issue/i, /ticket/i, /\bid\b/i,
      /driver/i, /must|shall|require/i, /search|look for/i, /target repository/i,
      /open (?:PRs|pull requests)/i, /closing references/i, /\bbod(?:y|ies)\b/i],
    'Prior to a new author dispatch for work tied to an issue or ticket id, the driver shall look for open pull requests in the target repository for that id and inspect closing references and body.',
    [[/before|prior to/i, 'After'], [/must|shall|require/i, 'may']]],
  ['another run\'s match holds only its dispatch and reports the PR URL',
    [/match/i, /(?:outside|external to) (?:the )?(?:current|this) run/i,
      /hold|pause/i, /only|solely/i, /dispatch/i, /report|provide/i, /(?:PR|pull request) URL/i],
    'A match external to this run must pause only that dispatch and provide the pull request URL.',
    [[/hold\w*|pause/i, 'proceed with'], [/only|solely/i, 'the entire run including']]],
  ['the run\'s recorded repair/resume PR is exempt',
    [/exempt|allow/i, /(?:current|this) run/i, /recorded (?:PR|pull request)/i, /repair/i, /resume/i],
    'Allow this run\'s recorded pull request for resume and repair.',
    [[/exempt|allow/i, 'Hold']]],
  ['failed or incomplete lookup holds only its dispatch as unknown',
    [/fail(?:ed|ure)/i, /incomplete|partial/i, /lookup/i, /unknown|undetermined/i,
      /hold|pause/i, /only|solely/i, /dispatch/i],
    'A partial or failed lookup is undetermined and must pause only that dispatch.',
    [[/unknown|undetermined/i, 'no match'], [/hold\w*|pause/i, 'proceed with'],
      [/^.*$/i, 'Treat a failed or incomplete lookup as no match and proceed with that dispatch']]],
  ['unbound work is unaffected',
    [/work/i, /without|lacking/i, /issue/i, /ticket/i, /\bid\b/i, /unaffected|unchanged/i],
    'Work lacking an issue or ticket id remains unchanged.',
    [[/unaffected|unchanged/i, 'held']]],
];

for (const [name, concepts, rewording, inversions] of rules) {
  test(`duplicate PR preflight: ${name}`, () => {
    checkRule(source, (text) => requires(text, ...concepts), rewording, inversions, concepts);
  });
}

test('duplicate PR preflight: contradictory no-match instructions are rejected', () => {
  // Mask the expected negative result, not a directive's negation: "never
  // treat failure as no match" is safe; "treat failure as no match" is not.
  const contradicts = (text) => prohibits(text, /\b(?:no match|zero matches)\b/i,
    /lookup|search/i, /fail(?:ed|ure)|incomplete|partial/i, /treat|count|interpret|consider/i);
  expect(contradicts(source)).toBe(false);
  for (const instruction of ['Treat lookup failure as no match.',
    'Count a failed search as zero matches.', 'Consider an incomplete lookup as no match.']) {
    expect(contradicts(`${source}. ${instruction}`)).toBe(true);
    expect(contradicts(`${source}. Never ${instruction}`)).toBe(false);
  }
});
