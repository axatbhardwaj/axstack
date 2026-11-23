import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';
import { bansLight, themeConflicts } from './theme-contract.js';

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

// Join the whole rule sets: an asset/security-only enumeration loses other obligations.
rule('Publish reuses the complete Explain page rules alongside Visual QA',
  [/reuse|follow|apply/i, /Explain's page rules and Visual QA|Visual QA and Explain's page rules/i,
    /checks/i, /verifier routing/i],
  "For verifier routing and checks, follow Visual QA and Explain's page rules.",
  [[/reuse|follow|apply/i, 'skip'],
    [/Explain's page rules and Visual QA|Visual QA and Explain's page rules/i,
      "Explain's page rules for self-contained bytes, semantics, accessibility and security, and Visual QA"]]);

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

// The captured page itself must be dark by default; a dark frame around a light
// page, or any unscoped light pass, inverts the rule.
const darkCapture = [/captur\w*|preview\w*/i, /these exact bytes|final (?:bytes|artifact)/i,
  /dark (?:Neon )?(?:mode|theme)/i, /360/i, /390/i, /728/i, /1,?440/i];
const capturesDark = (text) => requires(text, ...darkCapture) && themeConflicts(text).length === 0;
test('final bytes are captured as a dark page at all four widths by default', () => {
  checkRule(page, capturesDark,
    'Capture the final artifact in dark mode at 360px, 390px, 728px and 1,440px with Playwright MCP.',
    [[/dark (?:Neon )?(?:mode|theme)/i, 'light theme with a dark frame'], [/1,?440/i, '1024']], darkCapture);
});
const explicitCapture = [/when|if/i, /explicit (?:user )?theme/i, /captur\w*/i, /that theme/i, /same four widths/i];
rule('an explicit user theme is captured at the same four widths',
  explicitCapture,
  'If the user supplies an explicit theme, capture the page in that theme at the same four widths instead.',
  [[/that theme/i, 'the dark theme'], [/same four widths/i, '728px only']]);
const noLight = [/(?:without|unless|absent)\b.*explicit (?:user )?theme/i, /light/i];
test('no light capture without an explicit theme', () => checkRule(page, bansLight,
  'Omit all light-mode captures unless the user supplies an explicit theme.',
  [[/never (?:capture|add|get|take|render|record|request|produce|include)\w*|\b(?:omit|skip|drop|exclude)\w*(?: all| any| every)?/i, 'require']], noLight));
// In-suite mutation table: reviewer r2/r3 theme mutations plus adviser keyword-excuse
// cases. Targets are located semantically; each replay must change its target text.
const skillText = (path) => sentences(readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')).join('. ');
const briefs = skillText('axstack-publish/references/review-briefs.md');
const qaText = skillText('axstack-explain/references/visual-qa.md');
const mixedNotes = JSON.parse(readFileSync(`${import.meta.dir}/../../profiles/presets/mixed.json`, 'utf8'))
  .roles.find(({ id }) => id === 'axstack-explainer-review').notes;
const publishAccepts = (text) => capturesDark(text) && bansLight(text)
  && requires(text, ...explicitCapture);
const clean = (text) => themeConflicts(text).length === 0;
const at = (text, matches, transform) => {
  const list = sentences(text);
  const index = list.findIndex(matches);
  expect(index).toBeGreaterThanOrEqual(0);
  return list.map((sentence, position) => (position === index ? transform(sentence) : sentence)).join('. ');
};
const isCapture = (sentence) => requires(sentence, ...darkCapture);
const isBan = (sentence) => bansLight(sentence);
const isExplicit = (sentence) => requires(sentence, ...explicitCapture);
const isHandoff = (sentence) => /forwards the verifier PNG paths/i.test(sentence);
// The first alternative that differs from the current wording keeps each replay a real change.
const replaceWith = (...options) => (sentence) => options.find((option) => option !== sentence) ?? sentence;
const after = (extra) => (sentence) => `${sentence}. ${extra}`;
const themeMutations = [
  ['r2 light page in a dark frame', page, publishAccepts, isCapture,
    replaceWith('Capture these exact bytes with Playwright MCP light at 360, 390, 728 and 1440px with a dark frame around the capture'), false],
  ['r2 inverted light pass', page, publishAccepts, isBan, replaceWith('Never omit a light pass'), false],
  ['r2 contradicting light pass', page, publishAccepts, isBan, after('Never omit a light pass'), false],
  ['r2 removed explicit-theme capture', page, publishAccepts, isExplicit, replaceWith('Capture every page in the dark theme at the same four widths'), false],
  ['r2 valid omit-all reword', page, publishAccepts, isBan, replaceWith('Omit all light-mode captures unless the user supplies an explicit theme', 'Unless the user supplies an explicit theme, omit every light capture'), true],
  ['r3 valid skip-light reword', page, publishAccepts, isBan, replaceWith('Without an explicit user theme, skip light-mode screenshots', 'Without an explicit user theme, skip every light-mode screenshot'), true],
  ['r3 CSS light demand', briefs, clean, /explicit user theme/i.test.bind(/explicit user theme/i),
    after('Also capture the same article with `color-scheme: light` at every width'), false],
  ['r3 mis-scoped light demand', briefs, clean, /explicit user theme/i.test.bind(/explicit user theme/i),
    after('Regardless of whether the user supplies an explicit user theme, require a light theme capture of every Publish article'), false],
  ['r2 Visual QA lost explicit-theme scope', qaText, clean, (sentence) => /light.theme pass/i.test(sentence),
    replaceWith('Publish articles never get a light-theme pass'), false],
  ['contradiction at the review handoff', page, publishAccepts, isHandoff, after('The reviewer also requires a light theme capture of every article'), false],
  ['adviser inline keyword excuse', briefs, clean, /explicit user theme/i.test.bind(/explicit user theme/i),
    after('Like inline pages, Publish articles also get a light theme capture'), false],
  ['adviser T3 keyword excuse', briefs, clean, /explicit user theme/i.test.bind(/explicit user theme/i),
    after('As in T3, capture every article in light mode too'), false],
  ['adviser both colour schemes', briefs, clean, /explicit user theme/i.test.bind(/explicit user theme/i),
    after('Capture both colour schemes at every width'), false],
  ['adviser each theme', briefs, clean, /explicit user theme/i.test.bind(/explicit user theme/i),
    after('Capture each theme at all four widths'), false],
  ['adviser conditioned double negative', page, publishAccepts, isBan, replaceWith('Without an explicit theme, never skip the light theme capture'), false],
  ['adviser do-not-skip', page, publishAccepts, isBan, replaceWith('Without an explicit theme, do not skip light captures'), false],
  ['adviser preset dark to light', mixedNotes, clean, (sentence) => /all four widths dark/i.test(sentence),
    (sentence) => sentence.replace(/all four widths dark/i, 'all four widths light'), false],
  ['adviser valid unless reword', page, publishAccepts, isBan, replaceWith('Unless the user supplies an explicit theme, never capture a light theme', 'Unless the user supplies an explicit user theme, never capture light pages'), true],
  ['adviser valid drop reword', page, publishAccepts, isBan, replaceWith('Absent an explicit user theme, drop any light-theme capture', 'Absent an explicit user theme, drop every light capture'), true],
  ['valid dark-mode capture reword', page, publishAccepts, isCapture,
    replaceWith('Capture the final artifact in dark mode at 360px, 390px, 728px and 1,440px with Playwright MCP', 'Capture these exact bytes in dark mode at 360px, 390px, 728px and 1,440px with Playwright MCP'), true],
];
for (const [name, text, accepts, matches, transform, expected] of themeMutations) {
  test(`theme mutation: ${name}`, () => {
    expect(accepts(text)).toBe(true);
    const mutated = at(text, matches, transform);
    expect(mutated).not.toBe(text);
    expect(accepts(mutated)).toBe(expected);
  });
}

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
