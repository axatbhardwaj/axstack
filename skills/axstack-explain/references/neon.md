# Neon design language

Follow this reference for Explain inline HTML, non-anatomy standalone HTML and Publish
articles under [design.md](design.md)'s precedence and hard rules. Anatomy keeps
its own kit. Explicit user themes take precedence over Neon defaults.

## Palette and roles

Use neon green, purple and blue accents with assigned roles on a near-black ground.
Green marks data, blue marks links and interactive cues, and purple marks
comparison and emphasis.
Non-anatomy standalone HTML and published articles are dark-only by default with `color-scheme: dark`.
Without an explicit user theme, never add a light theme or a `prefers-color-scheme` switch to them.
An explicit user theme replaces the dark default, including Publish captures.
After any token adjustment, derivation or mix, every text accent keeps at least
4.5:1 contrast on ground and surface, as in this example.
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
[FRONTEND-DESIGN.md](frontend-design/FRONTEND-DESIGN.md).

## Inline pages

Inline pages map the Neon roles to live T3 theme variables, so they follow
T3's light and dark themes under [design.md](design.md). Never copy Neon hex
values into inline pages as a theme override. Bind only page-owned tokens, for example:

```css
.explain {
  --neon-ink: var(--foreground);
  --neon-data: var(--success, var(--chart-1, var(--foreground)));
  --neon-link: var(--info, var(--foreground));
  --neon-emphasis: var(--chart-2, var(--foreground));
  color: var(--neon-ink);
}
```

Verify these bindings against the live background in both T3 themes, mixing
accents toward foreground if needed.

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
