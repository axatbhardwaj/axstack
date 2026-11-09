import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const base = `${import.meta.dir}/../../skills/`;
const guide = 'axstack-explain/references/design.md';
const explain = 'axstack-explain/SKILL.md';
const qa = 'axstack-explain/references/visual-qa.md';
const delivery = 'axstack-explain/references/delivery.md';
const publish = 'axstack-publish/SKILL.md';
const aurora = 'axstack-explain/references/aurora.md';

// These contracts check operative instructions, including removal, reversal and
// equivalent wording. They do not claim that a seat has followed the prompt.
function rule(path, name, concepts, rewording, inversions, prohibition) {
  test(`design: ${name}`, () => {
    const text = existsSync(base + path) ? sentences(readFileSync(base + path, 'utf8')).join('. ') : '';
    checkRule(text, (source) => prohibition ? prohibits(source, prohibition, ...concepts) : requires(source, ...concepts),
      rewording, inversions, concepts);
  });
}

rule(guide, 'Aurora establishes shared identity on both page kinds',
  [/aurora\.md/i, /establishes|defines/i, /shared.*identity/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'For every Publish article adaptation and every inline HTML page, aurora.md defines the shared visual identity.',
  [[/establishes|defines/i, 'suggests'], [/every inline HTML page/i, 'some inline pages'], [/every Publish article adaptation/i, 'some Publish articles']]);
rule(guide, 'frontend craft stays subordinate to Aurora and hard rules',
  [/FRONTEND-DESIGN\.md/i, /content.specific craft/i, /subordinate to/i, /Aurora/i, /hard rules/i],
  'Use FRONTEND-DESIGN.md for content-specific craft subordinate to Aurora and the hard rules.',
  [[/subordinate to/i, 'overriding'], [/content.specific craft/i, 'sole authority']]);
for (const path of [explain, publish, qa, delivery]) {
  rule(path, `${path} follows shared Aurora identity`, [/follow/i, /aurora\.md/i, /shared identity/i],
    'Follow aurora.md for shared identity.', [[/follow/i, 'ignore'], [/shared identity/i, 'optional inspiration']]);
}
rule(aurora, 'explicit user themes take precedence', [/explicit user themes/i, /take precedence|override/i, /Aurora defaults/i],
  'Explicit user themes override Aurora defaults.', [[/take precedence|override/i, 'yield to']]);
rule(aurora, 'published defaults adapt to system theme',
  [/published articles/i, /default/i, /Aurora light and dark/i, /prefers-color-scheme/i, /custom tokens/i],
  'Published articles default to Aurora light and dark with custom tokens using prefers-color-scheme.',
  [[/default/i, 'ignore'], [/prefers-color-scheme/i, 'a fixed palette']]);
rule(aurora, 'inline shares grammar with live T3 colors',
  [/inline pages/i, /use/i, /live T3 theme variables/i, /colou?rs/i, /same type, layout and chart grammar/i],
  'Inline pages use live T3 theme variables for colors and the same type, layout and chart grammar.',
  [[/use/i, 'ignore'], [/live T3 theme variables/i, 'published hex values']]);
rule(aurora, 'typography establishes bounded editorial hierarchy',
  [/use/i, /system serif headings/i, /system sans body/i, /restrained hierarchy/i, /60.68ch/i, /body measure/i],
  'Use system serif headings, system sans body and a restrained hierarchy with a 60–68ch body measure.',
  [[/use/i, 'ignore'], [/system serif headings/i, 'display webfonts'], [/60.68ch/i, 'unbounded']]);
rule(aurora, 'composition avoids stranded margins',
  [/use/i, /centered or grid composition/i, /generous.*controlled spacing/i, /prevent/i, /stranded margins/i],
  'Use centered or grid composition with generous yet controlled spacing to prevent stranded margins.',
  [[/use/i, 'ignore'], [/prevent/i, 'create']]);
rule(aurora, 'compact Explain follows content shape',
  [/keep/i, /Explain/i, /compact and content.shaped/i, /rather than|instead of/i, /shrunken article/i],
  'Keep Explain compact and content-shaped instead of a shrunken article.',
  [[/keep/i, 'ignore'], [/rather than|instead of/i, 'as']]);
rule(aurora, 'citations preserve qualifications adjacent to claims',
  [/keep/i, /quiet citations/i, /adjacent to claims/i, /preserve/i, /dates and qualifications/i],
  'Keep quiet citations adjacent to claims and preserve dates and qualifications.',
  [[/keep/i, 'ignore'], [/preserve/i, 'discard']]);
rule(aurora, 'unknown counts stay out of proportions', [/unknown counts/i, /proportions/i],
  'Never visualize unknown counts as proportions.', [[/never/i, 'always']], /never visualize/i);
rule(aurora, 'truthful charts have labels scales and zero-baseline bars',
  [/use/i, /direct labels/i, /true scales/i, /zero.baseline bars/i, /text alternatives/i],
  'Use direct labels, true scales, zero-baseline bars and text alternatives for charts.',
  [[/use/i, 'ignore'], [/zero.baseline bars/i, 'truncated bars'], [/true scales/i, 'decorative scales']]);
rule(aurora, 'color carries no exclusive meaning', [/colou?r/i, /sole encoding/i],
  'Never use color as the sole encoding.', [[/never/i, 'always']], /never use/i);
rule(aurora, 'decoration and repetitive structures are excluded',
  [/decorative glow/i, /split.color headlines/i, /repetitive badge legends/i, /obligatory card grids/i, /repeated verdicts/i],
  'Avoid decorative glow, split-color headlines, repetitive badge legends, obligatory card grids and repeated verdicts.',
  [[/avoid/i, 'require']], /avoid/i);

test('design: published token example preserves Aurora dark identity and accessible accents', () => {
  const source = existsSync(base + aurora) ? readFileSync(base + aurora, 'utf8') : '';
  const css = source.match(/```css\n([\s\S]*?)```/)?.[1] ?? '';
  const [light, dark] = css.split('@media (prefers-color-scheme: dark)');
  const tokens = (text) => Object.fromEntries([...text.matchAll(/--aurora-([a-z]+):\s*(#[a-f\d]{6})/gi)]
    .map(([, role, hex]) => [role, hex.toLowerCase()]));
  const palettes = [tokens(light), tokens(dark ?? '')];
  // The selected palette is an exact public visual identity, not prose wording.
  expect(palettes[1]).toEqual({ ground: '#0a100d', surface: '#12221a', ink: '#fdfffd',
    data: '#62e2a4', link: '#7dd6c8', comparison: '#a8f0b3', uncertainty: '#e6d59a' });
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((byte) => {
      const value = Number.parseInt(byte, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const palette of palettes) {
    for (const background of ['ground', 'surface']) {
      for (const role of ['ink', 'data', 'link', 'comparison', 'uncertainty']) {
        expect(palette[role]).toMatch(/^#[a-f\d]{6}$/);
        const values = [luminance(palette[role]), luminance(palette[background])].sort((a, b) => b - a);
        expect((values[0] + 0.05) / (values[1] + 0.05), `${role} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});
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
test('design: published fonts use system stacks without T3 variables', () => {
  const text = sentences(readFileSync(base + guide, 'utf8')).join('. ');
  const concepts = [/published articles/i, /use/i, /system font stacks/i];
  const accepts = (source) => requires(source, ...concepts)
    && !sentences(source).some((sentence) => requires(sentence, /published articles/i, /T3 font variables/i));
  checkRule(text, accepts, 'Use system font stacks for published articles.',
    [[/use/i, 'ignore'], [/system font stacks/i, 'T3 font variables'],
      [/system font stacks/i, 'T3 font variables or system font stacks']], concepts);
});
rule(guide, 'inline embed-fit and page rules also win conflicts',
  [/non-anatomy inline pages only|only non-anatomy inline pages/i, /follow|consult/i, /inline-pages\.md/i, /Embed fit/i, /Page rules/i, /sections/i, /win|override/i, /conflict/i],
  'For only non-anatomy inline pages, consult inline-pages.md whose Embed fit and Page rules sections override design choices on conflict.',
  [[/non-anatomy inline pages only|only non-anatomy inline pages/i, 'all inline and published pages'], [/win|override/i, 'yield to'], [/follow|consult/i, 'ignore']]);
rule(guide, 'live T3 theme supplies inline ground and ink',
  [/inline pages/i, /follow/i, /live T3 theme/i, /ground/i, /--background/i, /ink/i, /--foreground/i],
  'Inline pages follow the live T3 theme with ground from --background and ink from --foreground.',
  [[/follow/i, 'ignore'], [/live T3 theme/i, 'fixed theme'], [/--background/i, '--ring']]);
rule(guide, 'every inline colour derives from T3 theme variables',
  [/inline pages/i, /derive every colou?r/i, /T3 theme variables/i, /all other colou?rs/i, /color-mix\(\).*with them/i, /or T3 semantic.chart variables/i],
  'For inline pages, derive every color from T3 theme variables: ground and ink supply all other colors via color-mix() with them or T3 semantic/chart variables.',
  [[/derive every colou?r/i, 'choose each colour freely'], [/color-mix\(\).*with them/i, 'fixed hex palettes'], [/or T3 semantic.chart variables/i, 'or arbitrary colours']]);
rule(guide, 'every colour stays legible in both themes',
  [/every colou?r/i, /legible/i, /light and dark/i],
  'Ensure every color stays legible in light and dark.',
  [[/legible/i, 'decorative'], [/light and dark/i, 'dark only']]);
rule(guide, 'inline palettes never switch on the system colour query',
  [/inline palettes/i, /prefers-color-scheme/i],
  'Never switch inline palettes using prefers-color-scheme.',
  [[/never/i, 'always'], [/inline palettes/i, 'published palettes']], /never switch/i);
rule(guide, 'inline pages preserve T3-owned variables',
  [/inline pages/i, /T3(?:'s own|.owned) variables/i],
  'In inline pages, never redefine T3-owned variables.',
  [[/never/i, 'always']], /never redefine/i);
rule(guide, 'standalone viewing allows variable fallbacks',
  [/var\(\)/i, /fallbacks/i, /allowed|permitted/i, /standalone viewing/i],
  'For standalone viewing, var() fallbacks are permitted.',
  [[/allowed|permitted/i, 'forbidden'], [/standalone viewing/i, 'T3 internals']]);
rule(guide, 'published articles support both themes outside T3 through the system query',
  [/published articles/i, /support/i, /light and dark/i, /prefers-color-scheme/i, /outside T3/i],
  'Outside T3, published articles support light and dark using prefers-color-scheme.',
  [[/support/i, 'ignore'], [/light and dark/i, 'light only'], [/prefers-color-scheme/i, 'the T3 class']]);
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
  expect(inline).not.toMatch(/Prefer diagrams and timelines|Avoid grids of bordered boxes|Keep borders minimal|for their named purposes/i);
});

// These constraints belong to T3's host frame, rather than art direction.
for (const [name, concepts, rewording, inversions, prohibition] of [
  ['host frame alignment', [/T3 frame/i, /borderless/i, /thread background/i, /left edge/i, /reply text/i],
    'The borderless T3 frame sits on the thread background with its left edge aligned to reply text.',
    [[/borderless/i, 'bordered'], [/reply text/i, 'viewport']]],
  ['outer width and padding', [/use|keep/i, /fluid width/i, /zero horizontal padding/i, /outermost element/i],
    'Keep the outermost element at fluid width with zero horizontal padding.',
    [[/fluid width/i, 'fixed width'], [/zero horizontal padding/i, '24px horizontal padding']]],
  ['outer framing', [/outer card/i, /border/i, /banner title/i],
    'Never use an outer card, border or banner title.',
    [[/never/i, 'always']], /never (?:add|use)/i],
  ['banner title scope', [/banner title/i, /means|denotes/i, /outer header block or band/i],
    'A banner title denotes an outer header block or band.',
    [[/outer header block or band/i, 'page heading']]],
  ['ordinary page headings', [/ordinary page heading/i, /allowed|permitted/i],
    'An ordinary page heading is permitted.',
    [[/allowed|permitted/i, 'forbidden']]],
  ['transparent page layers', [/keep|leave/i, /html/i, /body/i, /outermost element/i, /without a background colou?r/i],
    'Leave html, body and the outermost element without a background color.',
    [[/without a background colou?r/i, 'with a background color']]],
  ['anatomy wrapper stays flush and transparent', [/page wrapper/i, /zero gutters/i, /no background/i],
    'Keep zero gutters and no background on the page wrapper.',
    [[/zero gutters/i, '16px gutters'], [/no background/i, 'an opaque background']], /no background/i],
  ['inner box spacing and corners', [/give|set/i, /inner box/i, /own background/i, /at least 16px padding/i, /every side/i, /var\(--radius\)/i, /corners/i],
    'Set var(--radius) corners and at least 16px padding on every side for any inner box with its own background.',
    [[/at least 16px padding/i, '4px padding'], [/every side/i, 'the left side'], [/var\(--radius\)/i, '0px']]],
]) {
  test(`design: T3 embed fit ${name}`, () => {
    const page = readFileSync(`${base}axstack-explain/references/inline-pages.md`, 'utf8');
    const section = page.split('\n## Embed fit\n')[1]?.split('\n## ')[0] ?? '';
    const accepts = (source) => prohibition ? prohibits(source, prohibition, ...concepts) : requires(source, ...concepts);
    checkRule(sentences(section).join('. '), accepts, rewording, inversions, concepts);
  });
}
test('design: T3 embed fit permits the anatomy figure card as an inner panel', () => {
  const page = readFileSync(`${base}axstack-explain/references/inline-pages.md`, 'utf8');
  const section = sentences(page.split('\n## Embed fit\n')[1]?.split('\n## ')[0] ?? '').join('. ');
  const concepts = [/Anatomy/i, /(?:may|can) retain|can keep/i, /figure card/i, /inner panel/i, /at least 16px padding/i, /var\(--radius\)/i];
  // The affirmative-instruction helper treats may as optional; normalize this explicit permission.
  const accepts = (source) => requires(source.replace(/\bmay retain\b/gi, 'can retain'), ...concepts);
  checkRule(section, accepts,
    'Anatomy can keep its figure card as an inner panel with at least 16px padding and var(--radius).',
    [[/(?:may|can) retain|can keep/i, 'must remove'], [/inner panel/i, 'outer frame'],
      [/at least 16px padding/i, '4px padding'], [/var\(--radius\)/i, '0px']], concepts);
});

rule('axstack-explain/references/inline-pages.md', 'content mapping is refinable design guidance',
  [/content.shape mapping/i, /guidance/i, /frontend-design/i, /can refine/i],
  'Treat the content-shape mapping as guidance that frontend-design can refine.',
  [[/can refine/i, 'must preserve'], [/guidance/i, 'hard rules']]);

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
  [/frontend-design/i, /content.specific craft/i, /subordinate to/i, /Aurora/i, /design\.md's hard rules/i],
  "Use frontend-design for content-specific craft subordinate to Aurora and design.md's hard rules.",
  [[/subordinate to/i, 'overriding'], [/content.specific craft/i, 'sole authority']]);
rule(publish, 'publication hold excludes only second-round design delivery',
  [/hold/i, /publication/i, /required check or review/i, /missing or failed/i, /except for|apart from/i, /design.only delivery/i, /after the second round/i],
  'Apart from design-only delivery after the second round, hold publication when a required check or review is missing or failed.',
  [[/except for|apart from/i, 'including'], [/after the second round/i, 'before the first round'], [/design.only delivery/i, 'any delivery']]);
rule(explain, 'chat Mermaid and anatomy skip design references', [/load/i, /(?:either reference|any of these references)/i, /chat Mermaid/i, /anatomy/i],
  'Never load either reference for chat Mermaid or anatomy figures.', [[/never/i, 'always']], /never load/i);
rule(publish, 'Publish delegates article adaptation to explainer',
  [/send/i, /article adaptation/i, /art direction/i, /standalone light\/dark theme/i, /axstack-explainer/i, /bounded brief/i],
  'Send the article adaptation, including art direction and standalone light/dark theme, to axstack-explainer with a bounded brief.',
  [[/send/i, 'skip'], [/axstack-explainer/i, 'driver']]);

rule(qa, 'design review covers exactly inline and Publish pages',
  [/design review/i, /covers/i, /design\.md/i, /FRONTEND-DESIGN\.md/i, /calibration defaults/i, /restraint/i, /quality floor/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'Design review against design.md and FRONTEND-DESIGN.md covers every inline HTML page and every Publish article adaptation, including calibration defaults, restraint and quality floor.',
  [[/every inline HTML page/i, 'some inline pages'], [/every Publish article adaptation/i, 'some Publish articles'], [/covers/i, 'skips']]);
rule(qa, 'Explain reviewer inspects shared final-byte previews',
  [/non-anatomy Explain inline pages/i, /reviewer inspects/i, /driver/i, /final.byte/i, /html_preview.*screenshots/i, /728px dark/i, /360px light/i, /artifact SHA-256/i],
  "For non-anatomy Explain inline pages, the reviewer inspects the driver's final-byte html_preview screenshots at 728px dark and 360px light bound to the artifact SHA-256.",
  [[/inspects/i, 'ignores'], [/final.byte/i, 'draft'], [/artifact SHA-256/i, 'page title']]);
rule(qa, 'inadequate preview evidence requires fresh capture',
  [/missing/i, /stale/i, /unreadable/i, /inadequate/i, /preview evidence/i, /requires/i, /fresh capture/i, /before review/i],
  'Missing, stale, unreadable or inadequate preview evidence requires fresh capture before review.',
  [[/requires/i, 'waives'], [/before review/i, 'after delivery']]);
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
  rule(path, `${path} treats poor appearance as blocking with the same author`,
    [/fail(?:ing|s) to look decent/i, /blocking design finding/i, /same author/i],
    'A page that fails to look decent is a blocking design finding repaired by the same author.',
    [[/fail(?:ing|s) to look decent/i, 'looks decent'], [/blocking design finding/i, 'advisory observation'], [/same author/i, 'driver']]);
  if (path !== qa) rule(path, `${path} delivers remaining design findings after round two by name`,
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
