# Design

[FRONTEND-DESIGN.md](frontend-design/FRONTEND-DESIGN.md) is the sole design authority for every visual choice — palette, typography, layout, spacing, structure, motion and self-critique — on every inline HTML page and every Publish article adaptation.
These hard rules win on conflict.

- Never load network resources or font files. For inline pages and published articles, fonts are T3 font variables or system font stacks, both allowed.
- Inline pages follow the live T3 theme: ground from `--background`, ink from `--foreground`. Choose all other colours freely, keeping them legible in light and dark. Published articles support light and dark.
- Keep pages responsive down to 360px with visible keyboard focus, reduced motion respected and sufficient contrast in both themes.
- Never stop to confirm the subject: the brief and evidence are the subject.
- Never keep design notes or history across pages. This overrides frontend-design's note hint.
- Source fidelity beats any design choice: diagram edges, order, tables and code paths show the source.

Credit: [frontend-design](frontend-design/PROVENANCE.md).
