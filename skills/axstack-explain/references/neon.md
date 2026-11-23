# Neon design language

Follow this reference for Explain inline HTML, standalone HTML and Publish
articles under [design.md](design.md)'s precedence and hard rules. Anatomy keeps
its own kit. Explicit user themes take precedence over Neon defaults.

## Palette and roles

Use neon green, purple and blue accents with assigned roles on a near-black ground.
Neon green marks data and the primary series, blue marks links and interactive
cues, and purple marks comparison and emphasis. Keep white ink for body text
and a muted grey for secondary text.
Standalone HTML and published articles are dark-only with `color-scheme: dark`.
Never add a light theme or a `prefers-color-scheme` switch to them.
This bounded token example gives every text accent at least 4.5:1 contrast on
both ground and surface; check actual sizes, mixes and chart fills.
For an explicit user theme, emit its requested tokens while preserving role meaning.

```css
:root {
  color-scheme: dark;
  --neon-ground: #07080d;
  --neon-surface: #12141f;
  --neon-ink: #f4f6fb;
  --neon-muted: #a6adbf;
  --neon-data: #39ff88;
  --neon-link: #4cc2ff;
  --neon-emphasis: #c38bff;
}
body { background: var(--neon-ground); color: var(--neon-ink); }
a { color: var(--neon-link); }
```

## Art direction

Typography, layout, composition and art direction are left to the author under
[FRONTEND-DESIGN.md](frontend-design/FRONTEND-DESIGN.md). Design each article
and page for its content; the palette is the only fixed identity.

## Inline pages

Inline pages map the Neon roles to live T3 theme variables, so they follow
T3's light and dark themes under [design.md](design.md). Never copy Neon hex
values into inline pages as a theme override. Bind only page-owned tokens, for example:

```css
.explain {
  --neon-ink: var(--foreground);
  --neon-surface: color-mix(in srgb, var(--foreground) 6%, var(--background));
  --neon-data: var(--success, var(--chart-1, var(--foreground)));
  --neon-link: var(--info, var(--foreground));
  --neon-emphasis: var(--chart-2, var(--foreground));
  color: var(--neon-ink);
}
```

Verify these bindings against the live background in both T3 themes, mixing
accents toward foreground if needed. Keep the outer wrapper background unset
under [Embed fit](inline-pages.md#embed-fit). Never redefine T3 variables.

## Evidence graphics

Use direct labels, true scales, zero-baseline bars and text alternatives for charts.
State units, period, denominator and forecast/estimate status beside the figure.
Use a shared scale for comparisons and preserve source order and diagram edges.
Never use color as the sole encoding. Distinguish comparison with outlines or
line styles, and uncertainty with explicit wording and, where helpful, dashes.
Never visualize unknown counts as proportions. Use an honest text value such as
“Not disclosed” instead of a guessed bar, slice or pictorial ratio.
Keep quiet citations adjacent to claims and preserve dates and qualifications.
Use [Visual QA](visual-qa.md) for exact-byte review.
