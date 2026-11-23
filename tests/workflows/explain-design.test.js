import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';
import { themeConflicts } from './theme-contract.js';

const base = `${import.meta.dir}/../../skills/`;
const guide = 'axstack-explain/references/design.md';
const explain = 'axstack-explain/SKILL.md';
const qa = 'axstack-explain/references/visual-qa.md';
const delivery = 'axstack-explain/references/delivery.md';
const publish = 'axstack-publish/SKILL.md';
const neon = 'axstack-explain/references/neon.md';

// These contracts check operative instructions, including removal, reversal and
// equivalent wording. They do not claim that a seat has followed the prompt.
function rule(path, name, concepts, rewording, inversions, prohibition) {
  test(`design: ${name}`, () => {
    const text = existsSync(base + path) ? sentences(readFileSync(base + path, 'utf8')).join('. ') : '';
    checkRule(text, (source) => prohibition ? prohibits(source, prohibition, ...concepts) : requires(source, ...concepts),
      rewording, inversions, concepts);
  });
}

rule(guide, 'frontend-design leads design and craft on both page kinds',
  [/FRONTEND-DESIGN\.md/i, /lead/i, /design and craft authority/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'For every Publish article adaptation and every inline HTML page, FRONTEND-DESIGN.md is the lead design and craft authority.',
  [[/lead/i, 'subordinate'], [/every inline HTML page/i, 'some inline pages'], [/every Publish article adaptation/i, 'some Publish articles']]);
rule(guide, 'Neon establishes the palette on both page kinds',
  [/neon\.md/i, /establishes|defines/i, /Neon palette/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'For every Publish article adaptation and every inline HTML page, neon.md defines the required Neon palette.',
  [[/establishes|defines/i, 'suggests'], [/every inline HTML page/i, 'some inline pages'], [/every Publish article adaptation/i, 'some Publish articles']]);
rule(guide, 'only hard rules and the Neon palette win over frontend-design',
  [/only/i, /hard rules/i, /Neon palette/i, /win over|override/i, /frontend-design/i, /conflict/i],
  'On conflict, only the hard rules and the Neon palette requirement override frontend-design.',
  [[/win over|override/i, 'yield to']]);
for (const path of [explain, publish, qa, delivery]) {
  rule(path, `${path} follows the Neon palette`, [/follow/i, /neon\.md/i, /palette/i],
    'Follow neon.md for the palette.', [[/follow/i, 'ignore'], [/palette/i, 'optional inspiration']]);
  rule(path, `${path} keeps frontend-design as lead authority`, [/frontend-design/i, /lead/i, /design.*authority/i],
    'frontend-design is the lead design authority.', [[/lead/i, 'subordinate']]);
}
test('design: Aurora is retired from shipped guidance and presets', () => {
  expect(existsSync(base + 'axstack-explain/references/aurora.md')).toBe(false);
  for (const path of [guide, explain, qa, delivery, publish, 'axstack-publish/references/review-briefs.md', neon]) {
    expect(readFileSync(base + path, 'utf8'), path).not.toMatch(/aurora|subordinate to/i);
  }
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    expect(readFileSync(`${base}../profiles/presets/${preset}.json`, 'utf8'), preset).not.toMatch(/aurora|subordinate to/i);
  }
});
rule(neon, 'explicit user themes take precedence', [/explicit user themes/i, /take precedence|override/i, /Neon defaults/i],
  'Explicit user themes override Neon defaults.', [[/take precedence|override/i, 'yield to']]);
rule(neon, 'near-black ground carries neon green purple and blue accents',
  [/use/i, /near-black ground/i, /neon green/i, /purple/i, /blue/i, /accents/i, /assigned roles/i],
  'Use neon green, purple and blue accents with assigned roles on a near-black ground.',
  [[/use/i, 'ignore'], [/near-black ground/i, 'white ground']]);
rule(neon, 'published articles and standalone HTML are dark-only',
  [/published articles/i, /standalone HTML/i, /dark.only/i, /color-scheme: dark/i],
  'Standalone HTML and published articles are dark-only with color-scheme: dark.',
  [[/dark.only/i, 'light and dark'], [/color-scheme: dark/i, 'color-scheme: light dark']]);
rule(neon, 'published palettes add no light theme or system switching',
  [/light theme/i, /prefers-color-scheme/i], 'Never add a light theme or a prefers-color-scheme switch.',
  [[/never/i, 'always']], /never add/i);
rule(neon, 'art direction is left to frontend-design',
  [/leaves?|left/i, /typography/i, /layout/i, /composition/i, /art direction/i, /frontend-design/i],
  'Typography, layout, composition and art direction are left to the author under frontend-design.',
  [[/frontend-design/i, 'Neon presets']]);
test('design: Neon prescribes no fonts, measure or composition', () => {
  const source = existsSync(base + neon) ? readFileSync(base + neon, 'utf8') : 'missing';
  expect(source).not.toMatch(/serif|Georgia|Palatino|\d+.\d+ch|centered or grid|missing/i);
});
rule(neon, 'inline pages bind Neon roles to live T3 variables',
  [/inline pages/i, /bind|map/i, /roles/i, /live T3 theme variables/i],
  'Inline pages map the Neon roles to live T3 theme variables.',
  [[/bind|map/i, 'ignore'], [/live T3 theme variables/i, 'Neon hex values']]);
rule(neon, 'inline pages never copy Neon hex', [/Neon hex/i, /inline pages/i],
  'Never copy Neon hex values into inline pages.', [[/never/i, 'always']], /never copy/i);
rule(neon, 'citations preserve qualifications adjacent to claims',
  [/keep/i, /quiet citations/i, /adjacent to claims/i, /preserve/i, /dates and qualifications/i],
  'Keep quiet citations adjacent to claims and preserve dates and qualifications.',
  [[/keep/i, 'ignore'], [/preserve/i, 'discard']]);
rule(neon, 'unknown counts stay out of proportions', [/unknown counts/i, /proportions/i],
  'Never visualize unknown counts as proportions.', [[/never/i, 'always']], /never visualize/i);
rule(neon, 'truthful charts have labels scales and zero-baseline bars',
  [/use/i, /direct labels/i, /true scales/i, /zero.baseline bars/i, /text alternatives/i],
  'Use direct labels, true scales, zero-baseline bars and text alternatives for charts.',
  [[/use/i, 'ignore'], [/zero.baseline bars/i, 'truncated bars'], [/true scales/i, 'decorative scales']]);
rule(neon, 'color carries no exclusive meaning', [/colou?r/i, /sole encoding/i],
  'Never use color as the sole encoding.', [[/never/i, 'always']], /never use/i);

test('design: Neon token example is dark-only with accessible neon accents', () => {
  const source = existsSync(base + neon) ? readFileSync(base + neon, 'utf8') : '';
  const css = source.match(/```css\n([\s\S]*?)```/)?.[1] ?? '';
  expect(css).toMatch(/color-scheme:\s*dark\s*;/);
  expect(css).not.toMatch(/prefers-color-scheme|light/i);
  const palette = Object.fromEntries([...css.matchAll(/--neon-([a-z]+):\s*(#[a-f\d]{6})/gi)]
    .map(([, role, hex]) => [role, hex.toLowerCase()]));
  const rgb = (hex) => hex.slice(1).match(/../g).map((byte) => Number.parseInt(byte, 16));
  const luminance = (hex) => {
    const [r, g, b] = rgb(hex).map((byte) => {
      const value = byte / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  for (const role of ['ground', 'surface', 'ink', 'muted', 'data', 'link', 'emphasis']) expect(palette[role], role).toMatch(/^#[a-f\d]{6}$/);
  // Roles carry the requested hues: green data, blue links, purple emphasis.
  const [dr, dg, db] = rgb(palette.data); expect(dg).toBeGreaterThan(Math.max(dr, db));
  const [lr, lg, lb] = rgb(palette.link); expect(lb).toBeGreaterThan(Math.max(lr, lg));
  const [er, eg, eb] = rgb(palette.emphasis); expect(Math.min(er, eb)).toBeGreaterThan(eg);
  for (const background of ['ground', 'surface']) {
    expect(luminance(palette[background]), `${background} is near-black`).toBeLessThan(0.02);
    for (const role of ['ink', 'muted', 'data', 'link', 'emphasis']) {
      const values = [luminance(palette[role]), luminance(palette[background])].sort((a, b) => b - a);
      expect((values[0] + 0.05) / (values[1] + 0.05), `${role} on ${background}`).toBeGreaterThanOrEqual(4.5);
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
rule(guide, 'published articles are dark-only',
  [/published articles/i, /dark.only/i, /color-scheme: dark/i],
  'Published articles are dark-only and set color-scheme: dark.',
  [[/dark.only/i, 'light and dark'], [/color-scheme: dark/i, 'color-scheme: light dark']]);
rule(guide, 'published palettes never switch on the system colour query',
  [/published palettes/i, /prefers-color-scheme/i],
  'Never switch published palettes using prefers-color-scheme.',
  [[/never/i, 'always']], /never switch/i);
rule(guide, 'accessibility floor covers mobile focus motion and contrast',
  [/responsive/i, /360px/i, /visible keyboard focus/i, /reduced motion/i, /respected/i, /sufficient contrast/i, /every rendered theme/i],
  'Keep pages responsive down to 360px with visible keyboard focus, reduced motion respected and sufficient contrast in every rendered theme.',
  [[/360px/i, '728px'], [/visible keyboard focus/i, 'hidden focus'], [/respected/i, 'ignored'], [/every rendered theme/i, 'one theme']]);
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

rule(explain, 'driver or specialist loads both references for both page kinds',
  [/driver/i, /axstack-explainer/i, /load/i, /design\.md/i, /read/i, /FRONTEND-DESIGN\.md/i, /every inline HTML page/i, /every Publish article adaptation/i],
  'The author, whether driver or axstack-explainer, loads design.md and reads FRONTEND-DESIGN.md for every inline HTML page and every Publish article adaptation.',
  [[/driver/i, 'specialist'], [/loads?/i, 'skips'], [/reads?/i, 'skips'], [/every inline HTML page/i, 'some inline HTML pages'], [/every Publish article adaptation/i, 'some Publish articles']]);
rule(explain, 'frontend-design leads within hard rules and the Neon palette',
  [/frontend-design/i, /lead design and craft authority/i, /only/i, /design\.md's hard rules/i, /Neon palette/i],
  "frontend-design is the lead design and craft authority, bound only by design.md's hard rules and the Neon palette.",
  [[/lead/i, 'subordinate']]);
rule(publish, 'publication hold excludes only second-round design delivery',
  [/hold/i, /publication/i, /required check or review/i, /missing or failed/i, /except for|apart from/i, /design.only delivery/i, /after the second round/i],
  'Apart from design-only delivery after the second round, hold publication when a required check or review is missing or failed.',
  [[/except for|apart from/i, 'including'], [/after the second round/i, 'before the first round'], [/design.only delivery/i, 'any delivery']]);
rule(explain, 'standalone HTML loads all three design references',
  [/load/i, /design\.md/i, /neon\.md/i, /read/i, /FRONTEND-DESIGN\.md/i, /every non-anatomy standalone HTML file/i],
  'For every non-anatomy standalone HTML file, the author loads design.md and neon.md and reads FRONTEND-DESIGN.md.',
  [[/loads?/i, 'skips'], [/every non-anatomy standalone HTML file/i, 'some standalone files'], [/non-anatomy /i, '']]);
rule(explain, 'standalone anatomy files skip design references', [/anatomy/i, /standalone/i],
  'Never load these references for standalone anatomy files.', [[/never/i, 'always']], /never load/i);
for (const [path, label] of [[explain, 'Explain'], [qa, 'Visual QA']]) {
  rule(path, `${label} gives standalone HTML exact-byte design review in dark Neon by default`,
    [/non-anatomy standalone HTML files/i, /exact.byte design review/i, /dark Neon theme/i, /explicit user theme/i],
    'Non-anatomy standalone HTML files get exact-byte design review in the dark Neon theme or an explicit user theme.',
    [[/exact.byte design review/i, 'source review only'], [/dark Neon theme/i, 'light theme'], [/non-anatomy /i, '']]);
}
rule(qa, 'design review covers standalone HTML', [/design review/i, /covers/i, /every non-anatomy standalone HTML file/i],
  'Design review covers every non-anatomy standalone HTML file.',
  [[/covers/i, 'skips'], [/every non-anatomy standalone HTML file/i, 'some standalone files'], [/non-anatomy /i, '']]);
for (const [concept, label] of [[/lead design and craft authority/i, 'lead authority'], [/required Neon palette/i, 'Neon palette']]) {
  rule(guide, `${label} covers non-anatomy standalone HTML`, [concept, /every non-anatomy standalone HTML file/i],
    `The ${label} applies to every non-anatomy standalone HTML file: lead design and craft authority, required Neon palette.`,
    [[/non-anatomy /i, '']]);
}
rule(qa, 'Publish review uses explicit theme captures', [/explicit user theme/i, /PNGs/i, /that theme/i, /same four widths/i],
  'With an explicit user theme, the PNGs show that theme at the same four widths.',
  [[/that theme/i, 'the dark theme']]);
rule(neon, 'explicit theme replaces the dark default', [/explicit user theme/i, /replaces/i, /dark default/i, /captures/i],
  'An explicit user theme replaces the dark default, including captures.',
  [[/replaces/i, 'keeps']]);
const briefs = 'axstack-publish/references/review-briefs.md';
const pageRules = 'axstack-explain/references/inline-pages.md';
// Publish loads all of these; a two-theme or light demand outside inline T3 or an
// explicit user theme contradicts the dark Neon default.
test('design: loaded guidance has no unscoped light or two-theme demand', () => {
  for (const path of [guide, explain, qa, delivery, publish, neon, briefs, pageRules]) {
    expect(themeConflicts(readFileSync(base + path, 'utf8')), path).toEqual([]);
  }
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const notes = JSON.parse(readFileSync(`${base}../profiles/presets/${preset}.json`, 'utf8'))
      .roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    expect(themeConflicts(notes), preset).toEqual([]);
  }
  // Reviewer mutation: dropping Visual QA's explicit-theme scope must conflict.
  const list = sentences(readFileSync(base + qa, 'utf8'));
  const target = list.findIndex((sentence) => /light.theme pass/i.test(sentence));
  expect(target).toBeGreaterThanOrEqual(0);
  const unscoped = list.map((sentence, at) => at === target ? 'Publish articles never get a light-theme pass' : sentence);
  expect(themeConflicts(unscoped.join('. ')).length).toBeGreaterThan(0);
  expect(themeConflicts(`${readFileSync(base + publish, 'utf8')}\nNever omit a light pass.`).length).toBeGreaterThan(0);
});
rule(briefs, 'Publish review brief reviews the selected theme at four widths',
  [/review/i, /dark Neon theme/i, /explicit user theme/i, /all four widths/i],
  'Review the dark Neon theme at all four widths, or the explicit user theme when one is supplied.',
  [[/all four widths/i, '728px only'], [/review/i, 'skip']]);
for (const [path, label] of [[neon, 'Neon'], [qa, 'Visual QA']]) {
  rule(path, `${label} keeps every text accent at 4.5:1 after adjustments`,
    [/every text accent/i, /at least 4\.5:1/i, /ground and surface/i, /after any token adjustment, derivation or mix/i],
    'After any token adjustment, derivation or mix, every text accent keeps at least 4.5:1 contrast on ground and surface.',
    [[/at least 4\.5:1/i, 'about 3:1'], [/every text accent/i, 'the example accents']]);
}
rule(explain, 'reviewer handoff includes standalone HTML design review',
  [/inline HTML pages/i, /non-anatomy standalone HTML files/i, /Publish article adaptations/i, /include/i, /design review/i],
  'Include the design review for inline HTML pages, non-anatomy standalone HTML files and Publish article adaptations.',
  [[/include/i, 'omit'], [/non-anatomy standalone HTML files/i, 'no standalone files'], [/non-anatomy /i, '']]);
rule(delivery, 'delivery judges standalone HTML renders',
  [/inline HTML pages/i, /non-anatomy standalone HTML files/i, /Publish article adaptations/i, /judge/i, /exact.byte renders/i],
  'Judge the exact-byte renders of inline HTML pages, non-anatomy standalone HTML files and Publish article adaptations.',
  [[/judge/i, 'ignore'], [/non-anatomy standalone HTML files/i, 'no standalone files'], [/non-anatomy /i, '']]);
rule(qa, 'Neon default theme is scoped to Publish and non-anatomy standalone HTML',
  [/Publish articles/i, /non-anatomy standalone HTML/i, /explicit user theme/i, /dark Neon theme/i],
  'For Publish articles and non-anatomy standalone HTML, use the explicit user theme, otherwise the dark Neon theme.',
  [[/non-anatomy standalone HTML/i, 'every non-inline visual']]);
rule(qa, 'anatomy keeps its own kit themes', [/anatomy/i, /Neon default/i],
  'Anatomy figures never take the Neon default.', [[/never/i, 'always']], /never take/i);
for (const path of [guide, neon]) {
  rule(path, `${path} scopes the dark default to non-anatomy standalone HTML`,
    [/non-anatomy standalone HTML/i, /dark.only by default/i],
    'Non-anatomy standalone HTML is dark-only by default.', [[/non-anatomy standalone HTML/i, 'all standalone figures']]);
}
rule(explain, 'chat Mermaid and anatomy skip design references', [/load/i, /(?:either reference|any of these references)/i, /chat Mermaid/i, /anatomy/i],
  'Never load either reference for chat Mermaid or anatomy figures.', [[/never/i, 'always']], /never load/i);
rule(publish, 'Publish delegates article adaptation to explainer',
  [/send/i, /article adaptation/i, /art direction/i, /dark Neon theme/i, /axstack-explainer/i, /bounded brief/i],
  'Send the article adaptation, including art direction and the dark Neon theme, to axstack-explainer with a bounded brief.',
  [[/send/i, 'skip'], [/axstack-explainer/i, 'driver'], [/dark Neon theme/i, 'light/dark theme']]);
rule(publish, 'the author seat produces the article adaptation',
  [/axstack-explainer/i, /author seat/i, /produces/i, /article adaptation/i],
  'The axstack-explainer author seat produces the article adaptation.',
  [[/axstack-explainer/i, 'driver'], [/produces/i, 'reviews']]);

rule(qa, 'Publish review adds no light pass', [/Publish/i, /light.theme pass/i],
  'Publish never gets a light-theme pass.', [[/never/i, 'always']], /never|no/i);
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
  [/Publish/i, /reviewer/i, /opens?/i, /axstack-ui-verifier/i, /PNG/i, /360px/i,
    /390px mobile/i, /728px/i, /1440px desktop/i, /all four widths dark/i, /artifact SHA-256/i, /before review/i],
  'For Publish, the reviewer opens axstack-ui-verifier PNGs at 360px, 390px mobile, 728px and 1440px desktop, all four widths dark, with paths bound to the artifact SHA-256 before review.',
  [[/opens?/i, 'skips'], [/axstack-ui-verifier/i, 'author'], [/before review/i, 'after review'],
    [/artifact SHA-256/i, 'draft title'], [/1440px desktop/i, '728px intermediate'],
    [/all four widths dark/i, 'one width dark']]);
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
