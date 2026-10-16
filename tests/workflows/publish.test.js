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
    /\bpublished(?:`?\s*:\s*|\s+is\s+)true\b/i, /live version/i, /SHA-256/i, /matches/i, /final bytes/i],
  'For private mode, verify anonymous navigation reaches SlashDocs sign-in leading to Dex and notes status reports published is true with the live version and SHA-256 that matches the final bytes.',
  [[/verify/i, 'skip'], [/anonymous/i, 'owner'], [/matches/i, 'ignores'],
    [/published/i, 'unpublished'], [/\btrue\b/i, 'false']]);

rule('private version is compared with the publish result',
  [/compare/i, /status/i, /private version/i, /publish result/i],
  'Compare the private version from notes status with the publish result.',
  [[/compare/i, 'ignore'], [/private version/i, 'public version'], [/publish result/i, 'local draft']]);

rule('null metadata or pending publication leaves verification unproven',
  [/null (?:live )?metadata/i, /\bor\b/i, /pending operation/i, /verification/i, /unproven|unverified/i],
  'Null metadata or a pending operation leaves verification unverified.',
  [[/unproven|unverified/i, 'still counts as verified'], [/\bor\b/i, 'and']]);

rule('earlier publication and local creation supply no new authority',
  [/local creation/i, /earlier publication/i, /publication authority/i],
  'Local creation or an earlier publication grants no new publication authority.',
  [[/(supplies|grants) no new publication authority/i, '$1 publication authority']],
  /(?:supplies|grants) no new publication authority/i);

rule('Explain checks are rerun on final theme-adapted bytes',
  [/theme adaptation/i, /\b(?:rerun|repeat|recheck)\b/i, /Explain page checks/i, /final bytes/i],
  'After theme adaptation, repeat the Explain page checks on the final bytes.',
  [[/\b(?:rerun|repeat|recheck)\b/i, 'skip'], [/final bytes/i, 'original bytes']]);

rule('publish input is stdin only without a TTY and limited to 5 MB',
  [/stdin only/i, /at most/i, /\b5,000,000 bytes\b/i, /final HTML/i],
  'Send final HTML on stdin only with no TTY and at most 5,000,000 bytes.',
  [[/no TTY/i, 'an allocated TTY'], [/stdin only/i, 'file arguments or stdin'],
    [/at most/i, 'at least'], [/\b5,000,000 bytes\b/i, '50,000,000 bytes']], /no TTY/i);

rule('publish output SHA is compared with the final artifact',
  [/compare/i, /\b(?:its|publish result's) SHA(?:-256)?\b/i, /final artifact/i],
  "Compare the publish result's SHA-256 with the final artifact.",
  [[/compare/i, 'ignore'], [/final artifact/i, 'original draft']]);

rule('returned URL origin matches the configured mode origin',
  [/require/i, /returned URL(?:'s)? origin/i, /match/i, /configured origin/i, /mode/i],
  "Require the returned URL origin to match the configured origin for the selected mode.",
  [[/require/i, 'skip'], [/match/i, 'ignore'], [/configured origin/i, 'arbitrary origin']]);

rule('missing or failed required checks and reviews hold publication',
  [/hold/i, /publication/i, /required/i, /check/i, /review/i, /missing/i, /failed/i],
  'Hold publication when a required check or review is missing or failed.',
  [[/hold/i, 'continue'], [/missing/i, 'completed'], [/failed/i, 'passed']]);

rule('publication belongs only to the driver thread',
  [/only/i, /driver thread/i, /publish/i],
  'Only the driver thread publishes the checked article.',
  [[/only/i, 'any role including the'], [/driver thread/i, 'worker thread'], [/^/, 'Never ']]);

rule('external-edit overwrite warnings reach the user',
  [/tell|inform|notify/i, /user/i, /when/i, /overwrote_external_edit/i, /true/i],
  'Inform the user when overwrote_external_edit is true.',
  [[/tell|inform|notify/i, 'hide from'], [/true/i, 'false'], [/user/i, 'worker']]);

rule('final bytes get mobile, intermediate and real desktop previews in both themes',
  [/preview/i, /these exact bytes|final bytes/i, /728px dark/i, /360px light/i,
    /390px mobile/i, /1440px desktop/i, /all four widths in both themes/i],
  'Preview final bytes at 728px dark and 360px light plus 390px mobile and 1440px desktop, covering all four widths in both themes.',
  [[/preview/i, 'skip'], [/these exact bytes|final bytes/i, 'draft bytes'],
    [/728px dark/i, '728px light'], [/360px light/i, '360px dark'],
    [/1440px desktop/i, '728px intermediate'], [/all four widths in both themes/i, 'one theme per width']]);

rule('zero-padding embed geometry is scoped to inline T3 frames',
  [/inline/i, /zero.padding/i, /embed/i, /rules/i, /apply/i, /only/i, /T3 frames/i],
  'Only T3 frames apply the inline zero-padding embed rules.',
  [[/only/i, 'also'], [/T3 frames/i, 'standalone articles'], [/apply/i, 'ignore']]);

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
