import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const page = sentences(readFileSync(`${import.meta.dir}/../../skills/axstack-publish/SKILL.md`, 'utf8')).join('. ');

// Declared publication safeguards, not proof of deployment or agent compliance.
function rule(name, concepts, rewording, inversions, prohibition) {
  test(name, () => checkRule(page,
    (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
    rewording, inversions, concepts));
}

rule('publish authority covers exactly one article and one mode',
  [/require/i, /explicit/i, /authority/i, /exactly one article/i, /one mode/i],
  'Require explicit authority covering exactly one article in one mode per publication request.',
  [[/require/i, 'skip'], [/explicit/i, 'implicit'], [/exactly one article/i, 'all articles'], [/one mode/i, 'both modes']]);

rule('promotion, unpublish, reader and grant mutations need separate requests',
  [/promotion/i, /unpublish/i, /reader/i, /grant/i, /each/i, /own request|separate request/i],
  'Promotion, unpublish, reader mutations and grant changes each require a separate request.',
  [[/own request|separate request/i, 'inferred consent'], [/each/i, 'collectively'], [/^/, 'Never ']]);

rule('public redaction reuses Explain and removes all private material',
  [/public/i, /run/i, /explain/i, /redaction/i, /remove/i, /private paths/i, /IDs|identifiers/i,
    /credentials/i, /prompts/i, /messages/i, /internal records/i],
  'For public articles, run the Explain redaction check to remove private paths, identifiers, credentials, prompts, messages and internal records.',
  [[/run/i, 'skip'], [/remove/i, 'retain']]);

rule('public assets reuse the self-contained Explain check',
  [/public/i, /run/i, /self.contained/i, /asset/i, /check/i, /explain/i],
  'For public mode, run the self-contained asset check from Explain.',
  [[/run/i, 'skip'], [/self.contained/i, 'remote']]);

rule('changed bytes require fresh independent explainer review on final bytes',
  [/require/i, /fresh/i, /independent/i, /axstack-explainer-review/i, /final bytes/i],
  'Require a fresh independent axstack-explainer-review of the final bytes after adapting the page.',
  [[/require/i, 'skip'], [/fresh/i, 'previous'], [/final bytes/i, 'original draft'], [/independent/i, 'author-only']]);

rule('agents never handle reader passwords', [/agents/i, /handle/i, /reader passwords/i],
  'Agents never handle reader passwords.', [[/never/i, 'always']], /never/i);

rule('agents never run reader show or allocate an SSH TTY',
  [/agents/i, /run/i, /reader show/i, /SSH/i, /-t\b/i, /-tt\b/i],
  'Agents never run reader show or allocate an SSH TTY with -t or -tt.',
  [[/never/i, 'always']], /never/i);

rule('live URL requires Playwright browser verification against final SHA',
  [/verify/i, /live URL/i, /real browser/i, /Playwright MCP/i, /final SHA-256/i],
  'Verify the live URL with Playwright MCP in a real browser against the final SHA-256.',
  [[/verify/i, 'skip'], [/real browser/i, 'CLI only'], [/final SHA-256/i, 'draft checksum']]);

rule('public proof hashes anonymously read response bytes',
  [/public/i, /anonymous/i, /exact response bytes/i, /SHA-256/i, /matches/i, /final/i],
  'For public mode, an anonymous browser reads exact response bytes whose SHA-256 matches the final artifact.',
  [[/anonymous/i, 'authenticated'], [/exact response bytes/i, 'rendered text'], [/matches/i, 'ignores']]);

rule('private proof combines anonymous sign-in redirect and live metadata',
  [/private/i, /verify/i, /anonymous/i, /SlashDocs sign.in/i, /Dex/i, /notes status/i,
    /\bpublished\b/i, /live version/i, /SHA-256/i, /matches/i, /final bytes/i],
  'For private mode, verify anonymous navigation reaches SlashDocs sign-in leading to Dex and notes status reports published with the live version and SHA-256 that matches the final bytes.',
  [[/verify/i, 'skip'], [/anonymous/i, 'owner'], [/matches/i, 'ignores'], [/published/i, 'unpublished']]);
