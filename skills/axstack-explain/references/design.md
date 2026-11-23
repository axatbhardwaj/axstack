# Design

[FRONTEND-DESIGN.md](frontend-design/FRONTEND-DESIGN.md) is the lead design and craft authority for every inline HTML page and every Publish article adaptation: typography, layout, composition and art direction.
[neon.md](neon.md) defines the required Neon palette for every inline HTML page and every Publish article adaptation.
On conflict, only these hard rules and the Neon palette requirement win over frontend-design.

- Never load network resources or font files. Inline pages use T3 font variables or system font stacks. Published articles use system font stacks.
- Inline pages follow the live T3 theme: derive every colour from T3 theme variables — ground from `--background`, ink from `--foreground`, all other colours via `color-mix()` with them or T3 semantic/chart variables (`--muted-foreground`, `--accent`, `--success`, `--warning`, `--destructive`, `--info`, `--chart-1`…`--chart-6`). Keep every colour legible in light and dark. `var()` fallbacks are allowed for standalone viewing. Never switch inline palettes on `prefers-color-scheme`; T3's theme leaves that query unchanged. Never redefine T3's own variables in inline pages. Published articles are dark-only and set `color-scheme: dark`. Never switch published palettes on `prefers-color-scheme`.
- Keep pages responsive down to 360px with visible keyboard focus, reduced motion respected and sufficient contrast in every rendered theme.
- Never stop to confirm the subject: the brief and evidence are the subject.
- Never keep design notes or history across pages. This overrides frontend-design's note hint.
- Source fidelity beats any design choice: diagram edges, order, tables and code paths show the source.
- For non-anatomy inline pages only, follow [inline-pages.md](inline-pages.md): its Embed fit and Page rules sections also win on conflict. Anatomy follows its own kit.

Credit: [frontend-design](frontend-design/PROVENANCE.md).
