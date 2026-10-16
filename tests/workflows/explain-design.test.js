import { expect, test } from 'bun:test';
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

rule(guide, 'frontend-design is the sole authority for every visual choice on both page kinds',
  [/FRONTEND-DESIGN\.md/i, /(?:sole|only|exclusive) design authority/i, /every inline HTML page/i, /every Publish article adaptation/i,
    /palette/i, /typography/i, /layout/i, /spacing/i, /structure/i, /motion/i, /self-critique/i],
  'For every Publish article adaptation and every inline HTML page, FRONTEND-DESIGN.md is the only design authority for palette, typography, layout, spacing, structure, motion and self-critique.',
  [[/(?:sole|only|exclusive) design authority/i, 'optional inspiration'], [/every inline HTML page/i, 'some inline pages'], [/every Publish article adaptation/i, 'some Publish articles']]);
rule(guide, 'hard rules win conflicts', [/hard rules/i, /win|override/i, /conflict/i],
  'On conflict, the hard rules override design choices.', [[/win|override/i, 'yield to']]);
rule(guide, 'source fidelity wins design choices', [/source fidelity/i, /beats|overrides/i, /design choice/i, /diagram edges/i, /order/i, /tables/i, /code paths/i, /show the source/i],
  'Source fidelity overrides every design choice: diagram edges, order, tables and code paths show the source.',
  [[/beats|overrides/i, 'yields to'], [/show/i, 'ignore']]);
rule(guide, 'subject confirmation never blocks authoring', [/confirm/i, /subject/i],
  'Never stop to confirm the subject.', [[/never/i, 'always']], /never stop/i);
rule(guide, 'inline fonts use T3 variables or system stacks',
  [/inline pages/i, /use/i, /T3 font variables or system font stacks/i],
  'Use T3 font variables or system font stacks for inline pages.',
  [[/use/i, 'ignore'], [/or system font stacks/i, 'only']]);
rule(guide, 'published fonts use system stacks',
  [/published articles/i, /use/i, /system font stacks/i],
  'Use system font stacks for published articles.',
  [[/use/i, 'ignore'], [/system font stacks/i, 'T3 font variables']]);
rule(guide, 'inline embed-fit and page rules also win conflicts',
  [/non-anatomy inline pages only|only non-anatomy inline pages/i, /follow|consult/i, /inline-pages\.md/i, /embed.fit/i, /page rules/i, /win|override/i, /conflict/i],
  'For only non-anatomy inline pages, consult inline-pages.md whose embed-fit and page rules override design choices on conflict.',
  [[/non-anatomy inline pages only|only non-anatomy inline pages/i, 'all inline and published pages'], [/win|override/i, 'yield to'], [/follow|consult/i, 'ignore']]);
rule(guide, 'live T3 theme supplies inline ground and ink',
  [/inline pages/i, /follow/i, /live T3 theme/i, /ground/i, /--background/i, /ink/i, /--foreground/i],
  'Inline pages follow the live T3 theme with ground from --background and ink from --foreground.',
  [[/follow/i, 'ignore'], [/live T3 theme/i, 'fixed theme'], [/--background/i, '--ring']]);
rule(guide, 'other colours are free within light and dark legibility',
  [/choose/i, /all other colou?rs/i, /freely/i, /legible/i, /light and dark/i],
  'Keeping all other colors legible in light and dark, choose them freely.',
  [[/freely/i, 'from one accent'], [/legible/i, 'decorative'], [/light and dark/i, 'dark only']]);
rule(guide, 'published articles support both themes', [/published articles/i, /support/i, /light and dark/i],
  'Support light and dark in published articles.', [[/support/i, 'ignore'], [/light and dark/i, 'light only']]);
rule(guide, 'accessibility floor covers mobile focus motion and contrast',
  [/responsive/i, /360px/i, /visible keyboard focus/i, /reduced motion/i, /respected/i, /sufficient contrast/i, /both themes/i],
  'Keep pages responsive down to 360px with visible keyboard focus, reduced motion respected and sufficient contrast in both themes.',
  [[/360px/i, '728px'], [/visible keyboard focus/i, 'hidden focus'], [/respected/i, 'ignored'], [/both themes/i, 'one theme']]);
rule(guide, 'font files and network are prohibited', [/font files/i, /network resources/i],
  'Never load font files or network resources.', [[/never/i, 'always']], /never load/i);
rule(guide, 'design history is not kept across pages', [/design notes/i, /history/i, /across pages/i],
  'Never keep design notes or history across pages.', [[/never/i, 'always']], /never keep/i);

test('design freedom removes the old Axstack style restrictions', () => {
  const design = readFileSync(base + guide, 'utf8');
  const inline = readFileSync(`${base}axstack-explain/references/inline-pages.md`, 'utf8');
  expect(design).not.toMatch(/named tells|single accent|muted.only|taste-skill|Standalone Publish layout/i);
  expect(readFileSync(base + publish, 'utf8')).not.toMatch(/zero.padding embed rules/i);
  expect(inline).not.toMatch(/zero (?:outer horizontal padding|gutters)|never use an outer frame|Prefer diagrams and timelines|Avoid grids of bordered boxes|Keep borders minimal|for their named purposes/i);
});

rule('axstack-explain/references/inline-pages.md', 'inline design authority excludes anatomy',
  [/inline pages (?:other than|except) anatomy|non-anatomy inline pages/i, /follow|consult/i, /design\.md/i, /theme rule/i, /visual design authority/i],
  'For non-anatomy inline pages, consult design.md for visual design authority and the theme rule.',
  [[/inline pages (?:other than|except) anatomy|non-anatomy inline pages/i, 'all inline pages including anatomy'],
    [/follow|consult/i, 'ignore']]);

rule('axstack-explain/references/inline-pages.md', 'anatomy follows its kit', [/anatomy/i, /follows|uses/i, /kit/i],
  'Anatomy uses its kit.', [[/follows|uses/i, 'skips']]);

rule(explain, 'explainer loads both references for both page kinds',
  [/axstack-explainer/i, /load/i, /design\.md/i, /read/i, /FRONTEND-DESIGN\.md/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'The axstack-explainer loads design.md and reads FRONTEND-DESIGN.md for every inline HTML page and every Publish article adaptation.',
  [[/loads?/i, 'skips'], [/reads?/i, 'skips'], [/every inline HTML page/i, 'some inline HTML pages'], [/every Publish article adaptation/i, 'some Publish articles']]);
rule(explain, 'explainer authority stays bound by hard rules',
  [/frontend-design/i, /(?:sole|only|exclusive) design authority/i, /subject to|bound by/i, /design\.md's hard rules/i],
  "Use frontend-design as the only design authority, bound by design.md's hard rules.",
  [[/(?:sole|only|exclusive) design authority/i, 'optional inspiration'], [/subject to|bound by/i, 'free from']]);
rule(delivery, 'two-round prose fallback excludes design-only findings',
  [/except for|apart from/i, /design.only findings/i, /replace/i, /visual/i, /two repair rounds/i, /same author/i, /plain prose/i],
  'Apart from design-only findings, replace a visual still failing checks after two repair rounds with the same author by plain prose.',
  [[/except for|apart from/i, 'including'], [/design.only findings/i, 'all failures']]);
rule(publish, 'publication hold excludes only second-round design delivery',
  [/hold/i, /publication/i, /required check or review/i, /missing or failed/i, /except for|apart from/i, /design.only delivery/i, /after the second round/i],
  'Apart from design-only delivery after the second round, hold publication when a required check or review is missing or failed.',
  [[/except for|apart from/i, 'including'], [/after the second round/i, 'before the first round'], [/design.only delivery/i, 'any delivery']]);
rule(explain, 'chat Mermaid and anatomy skip design references', [/load/i, /either reference/i, /chat Mermaid/i, /anatomy/i],
  'Never load either reference for chat Mermaid or anatomy figures.', [[/never/i, 'always']], /never load/i);
rule(publish, 'Publish delegates article adaptation to explainer',
  [/send/i, /article adaptation/i, /art direction/i, /standalone light\/dark theme/i, /axstack-explainer/i, /bounded brief/i],
  'Send the article adaptation, including art direction and standalone light/dark theme, to axstack-explainer with a bounded brief.',
  [[/send/i, 'skip'], [/axstack-explainer/i, 'driver']]);

rule(qa, 'design review covers exactly inline and Publish pages',
  [/design review/i, /covers/i, /design\.md/i, /FRONTEND-DESIGN\.md/i, /calibration defaults/i, /restraint/i, /quality floor/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'Design review against design.md and FRONTEND-DESIGN.md covers every inline HTML page and every Publish article adaptation, including calibration defaults, restraint and quality floor.',
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

for (const path of [qa, delivery, publish]) {
  rule(path, `${path} treats poor appearance as blocking within two rounds`,
    [/fail(?:ing|s) to look decent/i, /blocking design finding/i, /same author/i, /within/i, /two.round/i],
    'Within the two-round visual limit, the same author repairs a blocking design finding for a page that fails to look decent.',
    [[/fail(?:ing|s) to look decent/i, 'looks decent'], [/blocking design finding/i, 'advisory observation'], [/same author/i, 'driver'], [/within/i, 'outside']]);
  rule(path, `${path} delivers remaining design findings after round two by name`,
    [/only design findings remain/i, /after/i, /second round/i, /deliver/i, /visual/i, /finding/i, /named/i],
    'Deliver the visual with each finding named if only design findings remain after the second round.',
    [[/only design findings remain/i, 'any failures remain'], [/second round/i, 'first round'], [/named/i, 'hidden']]);
  rule(path, `${path} remaining findings cannot be called fixed or clean`, [/finding/i, /fixed/i, /clean pass/i],
    'Never describe any remaining finding as a clean pass or fixed.', [[/never/i, 'always']], /never describe/i);
}
rule(delivery, 'other failures keep normal holds',
  [/hard.rule/i, /fidelity/i, /security/i, /theme/i, /accessibility/i, /layout.defect/i, /interaction/i, /failures/i, /keep|retain/i, /normal holds/i],
  'Hard-rule, fidelity, security, theme, accessibility, layout-defect and interaction failures retain their normal holds.',
  [[/keep|retain/i, 'waive'], [/normal holds/i, 'design-only treatment']]);
rule(delivery, 'unavailable unreadable or stale render holds unknown',
  [/unavailable/i, /unreadable/i, /stale/i, /render/i, /unknown/i, /hold/i, /visual/i, /publication/i],
  'An unavailable, unreadable or stale render leaves design review unknown and holds the visual or publication.',
  [[/unknown/i, 'passed'], [/holds?/i, 'permits']]);
rule(publish, 'Publish render gaps hold publication with unknown design review',
  [/unavailable/i, /unreadable/i, /stale/i, /renders?/i, /unknown/i, /hold/i, /publication/i],
  'An unreadable or stale render, or one that is unavailable, keeps publication on hold and design review unknown.',
  [[/unknown/i, 'passed'], [/hold/i, 'release']]);
rule(publish, 'Publish cannot treat unknown as a pass', [/unknown/i, /pass/i],
  'Never treat unknown design review as a pass.', [[/never/i, 'always']], /never treat/i);
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
