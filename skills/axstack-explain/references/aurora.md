# Aurora shared design language

Follow this reference for Explain inline HTML and Publish articles under
[design.md](design.md)'s precedence and hard rules. Anatomy keeps its own kit.
Explicit user themes take precedence over Aurora defaults.

## Identity and composition

Use system serif headings, system sans body and a restrained hierarchy with a
60–68ch body measure. Use local stacks such as Georgia, Palatino, serif and
system-ui, sans-serif; inline T3 font variables can supply equivalent roles.
Use centered or grid composition with generous yet controlled spacing to
prevent stranded margins. Center the reading column within a purposeful page
width; let a useful figure span wider than prose when its labels need room.
Collapse columns with content at narrow widths, keeping children shrinkable.
Vary section rhythm by the explanation's needs rather than filling a template.

Keep Explain compact and content-shaped rather than a shrunken article.
Use the same type, layout and chart grammar at the scale of the question.
Keep T3's outer layers transparent and flush under [Embed fit](inline-pages.md#embed-fit);
centering belongs inside that fluid frame, never in a padded outer card.
Make diagrams and charts explain relationships or evidence rather than decorate.
Avoid decorative glow, split-color headlines, repetitive badge legends,
obligatory card grids and repeated verdicts.
Keep quiet citations adjacent to claims and preserve dates and qualifications.

## Color roles and contexts

Published articles default to Aurora light and dark via `prefers-color-scheme`
using custom tokens. Use near-black forest ground and surface, white ink,
green data, teal links, pale green comparison and warm uncertainty in dark mode.
Use darker accessible accents on pale forest grounds in light mode.
This bounded published token example gives each text accent at least 4.5:1
contrast on both ground and surface; check actual sizes, mixes and chart fills.
For an explicit theme, emit its requested token set directly and omit the system
query. Customize tokens for an explicit user theme while preserving role meaning.

```css
:root {
  color-scheme: light dark;
  --aurora-ground: #f6fbf7;
  --aurora-surface: #e7f1e9;
  --aurora-ink: #14271c;
  --aurora-data: #146c43;
  --aurora-link: #11685e;
  --aurora-comparison: #376c3e;
  --aurora-uncertainty: #715b17;
}
@media (prefers-color-scheme: dark) {
  :root {
    --aurora-ground: #0a100d;
    --aurora-surface: #12221a;
    --aurora-ink: #fdfffd;
    --aurora-data: #62e2a4;
    --aurora-link: #7dd6c8;
    --aurora-comparison: #a8f0b3;
    --aurora-uncertainty: #e6d59a;
  }
}
body { background: var(--aurora-ground); color: var(--aurora-ink); }
a { color: var(--aurora-link); text-underline-offset: .18em; }
```

Inline pages use live T3 theme variables for colors and the same type, layout
and chart grammar. Never copy published hex values or its system query into
inline pages as a theme override. Bind only page-owned tokens, for example:

```css
.explain {
  --aurora-ground: var(--background);
  --aurora-surface: color-mix(in srgb, var(--foreground) 6%, var(--background));
  --aurora-ink: var(--foreground);
  --aurora-data: var(--chart-1, var(--foreground));
  --aurora-link: var(--info, var(--foreground));
  --aurora-comparison: var(--chart-2, var(--foreground));
  --aurora-uncertainty: var(--warning, var(--foreground));
  color: var(--aurora-ink);
}
```

These inline bindings are starting points: verify contrast against the live
background in both themes, mixing semantic accents toward foreground if needed.
Keep the outer wrapper background unset; use surface only for useful inner
panels under Embed fit. Never redefine T3 variables. Color roles need labels,
patterns or line styles when live theme hues differ from the published palette.

## Evidence graphics

Use direct labels, true scales, zero-baseline bars and text alternatives for charts.
State units, period, denominator and forecast/estimate status beside the figure.
Use a shared scale for comparisons and preserve source order and diagram edges.
Never use color as the sole encoding. Distinguish comparison with outlines or
line styles, and uncertainty with explicit wording and, where helpful, dashes.
Never visualize unknown counts as proportions. Use an honest text value such as
“Not disclosed” instead of a guessed bar, slice or pictorial ratio.
Keep citations quiet but readable and linked; preserve the source's precision.
Use [Visual QA](visual-qa.md) for exact-byte review in both contexts.
