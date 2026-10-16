import { test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const base = `${import.meta.dir}/../../skills/`;
const guide = 'axstack-explain/references/design.md';
const explain = 'axstack-explain/SKILL.md';
const qa = 'axstack-explain/references/visual-qa.md';
const delivery = 'axstack-explain/references/delivery.md';
const publish = 'axstack-publish/SKILL.md';

// These contracts check operative instructions, including removal, reversal and
// equivalent wording. They do not claim that a seat has followed the prompt.
function rule(path, name, concepts, rewording, inversions, prohibition) {
  test(`design: ${name}`, () => {
    const text = existsSync(base + path) ? sentences(readFileSync(base + path, 'utf8')).join('. ') : '';
    checkRule(text, (source) => prohibition ? prohibits(source, prohibition, ...concepts) : requires(source, ...concepts),
      rewording, inversions, concepts);
  });
}

rule(guide, 'precedence preserves all four levels in order',
  [/order/i, /1\).*page rules.*subject.*colour.*motion.*font.*no.notes.*2\).*source fidelity.*3\).*named tells.*4\).*frontend-design/i],
  'Use this order: 1) page rules plus subject, colour, motion, font and no-notes rules, 2) source fidelity, 3) named tells, 4) frontend-design.',
  [[/1\)/, '4)'], [/2\)/, '3)'], [/3\)/, '2)'], [/4\)/, '1)'], [/order/i, 'optional order']], /no.notes/i);
rule(guide, 'content shapes are exempt from ornament tells',
  [/diagram edges.*arrows.*timeline order.*tables.*code paths/i, /content/i, /ornament/i],
  'Diagram edges and arrows, timeline order, tables and code paths are content, never ornament.',
  [[/content/i, 'decoration'], [/not|never/i, 'always']], /(?:not|never) ornament/i);
rule(guide, 'anatomy follows its kit', [/anatomy/i, /follows|uses/i, /kit/i],
  'Anatomy uses its kit.', [[/follows|uses/i, 'skips']]);
rule(guide, 'required higher-rule behaviour is exempt', [/higher.priority rule/i, /behaviour/i, /tell/i],
  'A behaviour required by a higher-priority rule is never a tell.', [[/never/i, 'always']], /never a tell/i);
rule(guide, 'subject determines structure without confirmation', [/subject.*question/i, /structure/i],
  'The actual subject and question determine structure.', [[/determine|drives?/i, 'never determines']]);
rule(guide, 'subject confirmation never blocks authoring', [/confirm/i, /subject/i],
  'Never stop to confirm the subject.', [[/never/i, 'always']], /never stop/i);
rule(guide, 'inline fonts come only from T3 variables', [/inline/i, /only/i, /T3 font variables/i],
  'Inline pages use only T3 font variables.', [[/only/i, 'optional'], [/T3 font variables/i, 'web fonts']]);
rule(guide, 'published fonts use system stacks', [/published/i, /use/i, /system font stacks/i],
  'Published articles use system font stacks.', [[/use/i, 'skip'], [/system font stacks/i, 'downloaded fonts']]);
rule(guide, 'standalone composition has mobile gutters and balanced desktop margins',
  [/standalone Publish articles/i, /mobile gutters/i, /bounded prose measure/i, /intentional horizontal margins/i, /balanced desktop composition/i],
  'For balanced desktop composition, give standalone Publish articles intentional horizontal margins and a bounded prose measure, plus mobile gutters.',
  [[/mobile gutters/i, 'edge-to-edge mobile text'], [/bounded prose measure/i, 'unlimited prose width'],
    [/intentional horizontal margins/i, 'zero horizontal margins'], [/balanced desktop composition/i, 'inline embed geometry']]);
rule(guide, 'standalone typography and rhythm support reading',
  [/standalone articles/i, /readable body typography/i, /line height/i, /heading hierarchy/i, /generous section spacing/i],
  'For standalone articles, set generous section spacing and heading hierarchy with readable body typography and line height.',
  [[/readable body typography/i, 'tiny body typography'], [/line height/i, 'cramped lines'],
    [/heading hierarchy/i, 'uniform headings'], [/generous section spacing/i, 'zero section spacing']]);
rule(guide, 'chart legibility spans widths and themes',
  [/chart/i, /labels/i, /values/i, /units/i, /spacing/i, /legibility/i, /mobile and desktop/i, /both themes/i],
  'Ensure chart legibility with labels, values, units and spacing suited to mobile and desktop widths in both themes.',
  [[/legibility/i, 'decoration'], [/mobile and desktop/i, 'desktop only'], [/both themes/i, 'one theme']]);
rule(guide, 'font files and network are prohibited', [/font files/i, /network/i],
  'Never use font files or network requests.', [[/never/i, 'always']], /never use/i);
rule(guide, 'design history is not kept across pages', [/design notes/i, /history/i, /across pages/i],
  'Never keep design notes or history across pages.', [[/never/i, 'always']], /never keep/i);

rule(explain, 'explainer loads both references for both page kinds',
  [/axstack-explainer/i, /load/i, /design\.md/i, /read/i, /FRONTEND-DESIGN\.md/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'The axstack-explainer loads design.md and reads FRONTEND-DESIGN.md for every inline HTML page and every Publish article adaptation.',
  [[/loads?/i, 'skips'], [/reads?/i, 'skips'], [/every inline HTML page/i, 'some inline HTML pages'], [/every Publish article adaptation/i, 'some Publish articles']]);
rule(explain, 'chat Mermaid and anatomy skip design references', [/load/i, /either reference/i, /chat Mermaid/i, /anatomy/i],
  'Never load either reference for chat Mermaid or anatomy figures.', [[/never/i, 'always']], /never load/i);
rule(publish, 'Publish delegates article adaptation to explainer',
  [/send/i, /article adaptation/i, /art direction/i, /standalone light\/dark theme/i, /axstack-explainer/i, /bounded brief/i],
  'Send the article adaptation, including art direction and standalone light/dark theme, to axstack-explainer with a bounded brief.',
  [[/send/i, 'skip'], [/axstack-explainer/i, 'driver']]);

rule(qa, 'design review covers exactly inline and Publish pages',
  [/design review/i, /covers/i, /design\.md/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'Design review against design.md covers every inline HTML page and every Publish article adaptation.',
  [[/every inline HTML page/i, 'some inline pages'], [/every Publish article adaptation/i, 'some Publish articles'], [/covers/i, 'skips']]);
rule(qa, 'inline reviewer renders exact bytes itself',
  [/inline/i, /reviewer/i, /itself/i, /renders?/i, /exact bytes/i, /html_preview/i, /728px dark/i, /360px light/i, /non-publishing self-check/i],
  'For inline pages, the reviewer itself renders exact bytes with html_preview at 728px dark and 360px light as a non-publishing self-check.',
  [[/renders?/i, 'skips'], [/itself/i, 'via the author'], [/exact bytes/i, 'earlier bytes'], [/html_preview/i, 'html_render']]);
rule(qa, 'Publish reviewer opens verifier PNGs bound to final bytes',
  [/Publish/i, /reviewer/i, /opens?/i, /axstack-ui-verifier/i, /PNG/i, /728px dark/i, /360px light/i,
    /390px mobile/i, /1440px desktop/i, /all four widths in both themes/i, /artifact SHA-256/i, /before review/i],
  'For Publish, the reviewer opens axstack-ui-verifier PNGs at 728px dark and 360px light plus 390px mobile and 1440px desktop, covering all four widths in both themes with paths bound to the artifact SHA-256 before review.',
  [[/opens?/i, 'skips'], [/axstack-ui-verifier/i, 'author'], [/before review/i, 'after review'],
    [/artifact SHA-256/i, 'draft title'], [/1440px desktop/i, '728px intermediate'],
    [/all four widths in both themes/i, 'one theme per width']]);
rule(qa, 'desktop screenshot inspection checks composition beyond absence of overflow',
  [/inspect/i, /1440px desktop screenshot/i, /balanced composition/i, /horizontal margins/i,
    /prose measure/i, /typography/i, /section spacing/i, /chart legibility/i],
  'Inspect typography, section spacing and chart legibility alongside prose measure, horizontal margins and balanced composition in the 1440px desktop screenshot.',
  [[/inspect/i, 'skip'], [/1440px desktop screenshot/i, '728px screenshot'],
    [/balanced composition/i, 'overflow only'], [/chart legibility/i, 'chart presence']]);
rule(qa, 'mobile screenshot inspection checks gutters and readable content',
  [/inspect/i, /360px and 390px mobile screenshots/i, /gutters/i, /readable text/i, /chart labels/i],
  'Inspect gutters, readable text and chart labels in the 360px and 390px mobile screenshots.',
  [[/inspect/i, 'skip'], [/gutters/i, 'edge-to-edge text'], [/readable text/i, 'text presence'],
    [/chart labels/i, 'chart presence']]);
rule(publish, 'Publish screenshots precede independent review',
  [/before.*review/i, /records?/i, /axstack-ui-verifier/i, /Playwright MCP/i, /screenshots/i, /paths/i, /SHA-256/i],
  'Before independent review, axstack-ui-verifier runs Playwright MCP checks and records screenshots with paths and their artifact SHA-256.',
  [[/before/i, 'after'], [/axstack-ui-verifier/i, 'author'], [/records?/i, 'skips']]);

rule(delivery, 'one design repair counts within the visual limit',
  [/named tell/i, /blocking/i, /one design-only repair round/i, /same author/i, /within/i, /two-round/i],
  'A named tell is blocking for one design-only repair round with the same author, counting within the two-round visual limit.',
  [[/one design-only repair round/i, 'two design-only repair rounds'], [/within/i, 'outside'], [/blocking/i, 'optional']]);
rule(delivery, 'there is no second design repair round', [/second design-only round/i],
  'Never start a second design-only round.', [[/never/i, 'always']], /never start/i);
rule(delivery, 'remaining cosmetic tells are disclosed exceptions',
  [/cosmetic tell/i, /fresh.*exact.byte renders/i, /disclosed/i, /non-blocking design exception/i, /evidence/i, /delivery/i],
  'A cosmetic tell remaining in fresh exact-byte renders becomes a disclosed non-blocking design exception, recorded in evidence and named in delivery.',
  [[/disclosed/i, 'hidden'], [/non-blocking/i, 'blocking'], [/fresh/i, 'stale']]);
rule(delivery, 'exception never claims fixed or clean', [/fixed/i, /clean design pass/i],
  'Never describe the exception as fixed or a clean design pass.', [[/never/i, 'always']], /never describe/i);
rule(delivery, 'exception cannot waive other requirements',
  [/exception/i, /source.fidelity/i, /security/i, /asset/i, /theme/i, /layout/i, /accessibility/i, /interaction/i, /publication/i, /requirements/i],
  'This exception never waives source-fidelity, security, asset, theme, layout, accessibility, interaction or publication requirements.',
  [[/never waives/i, 'waives']], /never waives/i);
rule(delivery, 'unavailable unreadable or stale render holds unknown',
  [/unavailable/i, /unreadable/i, /stale/i, /render/i, /unknown/i, /hold/i, /visual/i, /publication/i],
  'An unavailable, unreadable or stale render leaves design review unknown and holds the visual or publication.',
  [[/unknown/i, 'passed'], [/holds?/i, 'permits']]);
rule(delivery, 'unknown check cannot expire as a tell', [/unknown check/i, /tell/i, /expires/i],
  'An unknown check is never a tell that expires after one round.', [[/never/i, 'always']], /never a tell/i);

rule(publish, 'Publish render gaps hold publication with unknown design review',
  [/unavailable/i, /unreadable/i, /stale/i, /renders?/i, /unknown/i, /hold/i, /publication/i],
  'An unreadable or stale render, or one that is unavailable, keeps publication on hold and design review unknown.',
  [[/unknown/i, 'passed'], [/hold/i, 'release']]);
rule(publish, 'Publish cannot treat unknown as a pass or cosmetic exception',
  [/unknown/i, /passed|approval/i, /cosmetic exception/i],
  'A cosmetic exception or approval must never be inferred from unknown design review.',
  [[/never/i, 'always']], /never (?:passed|be inferred)/i);
rule(publish, 'Publish cosmetic exception preserves every other requirement',
  [/exception/i, /all other requirements|every other requirement/i, /binding|mandatory/i],
  'Every other requirement stays mandatory when recording a cosmetic exception.',
  [[/binding|mandatory/i, 'waived'], [/all other requirements|every other requirement/i, 'selected requirements']]);
rule(delivery, 'a tell causing a defect retains its normal hold and repair',
  [/tell/i, /caus/i, /defect/i, /keeps|retain/i, /normal|ordinary/i, /hold/i, /repair/i, /rules/i],
  'For any such defect caused by a tell, retain its ordinary repair rules and hold.',
  [[/keeps|retain/i, 'waive'], [/hold/i, 'release'], [/repair/i, 'exception']]);
rule(publish, 'Publish explainer applies both design references',
  [/explainer/i, /follows|apply/i, /design guidance|design rules/i, /reads?/i, /frontend-design/i],
  'Read frontend-design and apply the design rules from Explain when the explainer adapts an article.',
  [[/follows|apply/i, 'ignores'], [/reads?/i, 'ignores']]);
for (const [path, label] of [[explain, 'Explain'], [qa, 'Visual QA']]) {
  rule(path, `${label} preserves standalone HTML review and Visual QA`,
    [/standalone HTML files/i, /explicitly requested/i, /keep|preserve/i, /existing|current/i, /review/i, /Visual QA/i],
    'Preserve current review and Visual QA when standalone HTML files are explicitly requested.',
    [[/keep|preserve/i, 'discard'], [/existing|current/i, 'new'], [/Visual QA/i, 'source checks only']]);
}
rule(delivery, 'overall look remains advisory', [/overall look/i, /advisory|advice only/i],
  'The overall look serves as advice only.', [[/advisory|advice only/i, 'blocking']]);
