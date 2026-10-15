# Design

Apply precedence in this order: 1) Axstack page rules plus this file's subject, colour, motion, font and no-notes rules, 2) source fidelity, 3) named tells, 4) frontend-design for approach and everything else.
Inline pages favour restraint; published articles may vary boldly within levels 1–3.

Named tells:
- Eyebrow labels or tiny tracked caps.
- A single styled accent word.
- Gradients, glass or resting shadows.
- Emoji or decorative blobs.
- Rows of identical cards or bordered boxes.
- More than two typefaces or five sizes.
- Body text outside full ink or default left alignment.

Diagram edges and arrows, timeline order, tables and code paths are content, not ornament.
Anatomy follows its kit.
A behaviour required by a higher-priority rule is never a tell.

The actual subject and question determine structure.
Never stop to confirm the subject.
Inline colour: `--background` is ground, `--foreground` is ink, `--muted-foreground` serves only secondary text, `--ring` is the single accent.
Published articles may use a small named palette checked in light and dark.
Motion is static by default; any animation is CSS-only and respects reduced motion.
Inline pages use only T3 font variables.
Published articles use system font stacks.
Never use font files or network requests.
Never keep design notes or history across pages; frontend-design's note-keeping hint does not apply.

Credit: [taste-skill](https://github.com/Leonxlnx/taste-skill/tree/f624f37a) (MIT, `Leonxlnx/taste-skill` at `f624f37a`) and [frontend-design](frontend-design/PROVENANCE.md).
