import { expect, test } from 'bun:test';
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

const assetConcepts = [/public/i, /\brun\b/i, /self.contained/i, /asset/i, /check/i, /explain/i];
rule('public assets reuse the self-contained Explain check', assetConcepts,
  'For public mode, run the self-contained asset check from Explain.',
  [[/run/i, 'skip'], [/self.contained/i, 'remote']]);

test('removing the primary asset check cannot be masked by a later recheck', () => {
  const primary = sentences(page).find((sentence) => requires(sentence, ...assetConcepts));
  expect(primary).toBeTruthy();
  expect(requires(page.replace(primary, ''), ...assetConcepts)).toBe(false);
});

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

rule('publication belongs only to the driver thread',
  [/only/i, /driver thread/i, /publish/i],
  'Only the driver thread publishes the checked article.',
  [[/only/i, 'any role including the'], [/driver thread/i, 'worker thread'], [/^/, 'Never ']]);

rule('external-edit overwrite warnings reach the user',
  [/tell|inform|notify/i, /user/i, /when/i, /overwrote_external_edit/i, /true/i],
  'Inform the user when overwrote_external_edit is true.',
  [[/tell|inform|notify/i, 'hide from'], [/true/i, 'false'], [/user/i, 'worker']]);

rule('final bytes are previewed in both required widths and themes',
  [/preview/i, /these exact bytes|final bytes/i, /728px dark/i, /360px light/i],
  'Preview the final bytes at 728px dark and 360px light.',
  [[/preview/i, 'skip'], [/these exact bytes|final bytes/i, 'draft bytes'],
    [/728px dark/i, '728px light'], [/360px light/i, '360px dark']]);

rule('publication receipt returns URL version and SHA',
  [/return|report/i, /URL/i, /\bversion\b/i, /SHA-256/i],
  'Report the article URL, version and SHA-256 to the user.',
  [[/return|report/i, 'omit'], [/URL/i, 'title'], [/\bversion\b/i, 'slug'], [/SHA-256/i, 'byte count']]);

rule('publish routing comes from the host-managed config',
  [/read/i, /host.managed/i, /~\/\.config\/axstack\/publish\.json/i,
    /sshHost/i, /publicOrigin/i, /docsOrigin/i],
  'Read the host-managed ~/.config/axstack/publish.json with sshHost, publicOrigin and docsOrigin fields.',
  [[/read/i, 'ignore'], [/host.managed/i, 'packaged']]);

rule('missing or invalid publish config holds publication',
  [/hold/i, /publication/i, /config/i, /missing/i, /invalid/i],
  'Hold publication if the config is missing or invalid.',
  [[/hold/i, 'continue'], [/missing/i, 'available'], [/invalid/i, 'valid']]);

rule('publish destinations are never guessed', [/guess/i, /publish host/i, /origin/i],
  'Never guess a publish host or either origin.', [[/never/i, 'always']], /never/i);
