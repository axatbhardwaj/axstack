# Design

[FRONTEND-DESIGN.md](frontend-design/FRONTEND-DESIGN.md) is the sole design authority for every visual choice — palette, typography, layout, spacing, structure, motion and self-critique — on every inline HTML page and every Publish article adaptation.
These hard rules win on conflict.

- Never load network resources or font files. Inline pages use T3 font variables or system font stacks. Published articles use system font stacks.
- Inline pages follow the live T3 theme: ground from `--background`, ink from `--foreground`. Choose all other colours freely, keeping them legible in light and dark. Published articles support light and dark.
- Keep pages responsive down to 360px with visible keyboard focus, reduced motion respected and sufficient contrast in both themes.
- Never stop to confirm the subject: the brief and evidence are the subject.
- Never keep design notes or history across pages. This overrides frontend-design's note hint.
- Source fidelity beats any design choice: diagram edges, order, tables and code paths show the source.
- For non-anatomy inline pages only, follow [inline-pages.md](inline-pages.md): its Embed fit and Page rules sections also win on conflict. Anatomy follows its own kit.

Credit: [frontend-design](frontend-design/PROVENANCE.md).
