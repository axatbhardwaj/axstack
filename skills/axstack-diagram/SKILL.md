---
name: axstack-diagram
description: When an explanation needs a diagram, use axstack-diagram for inline SVG or CSS in pages, Mermaid in chat, GitHub, and docs, or archify only on an explicit viewer request.
---

# Diagram

Usage: `/axstack-diagram <question + destination>` or load this skill from explain.
Load [Standing contracts](../axstack/references/contracts.md) before acting.
Follow [Fidelity](references/fidelity.md) for every format.

Use archify HTML only on an explicit viewer request.
The configured `axstack-explainer` authors the viewer; follow [Archify](references/archify.md).
Use inline SVG or CSS inside inline pages.
Never use Mermaid in inline pages.
Use Mermaid for chat fallback, GitHub, and docs.
Include `accTitle` and `accDescr` in each Mermaid view.
Never use theme init in Mermaid.
Split large Mermaid diagrams into views.
T3 chat renders the Mermaid fence once the reply settles.

Explain owns evidence, claim labels, the word cap, dispatch, and delivery.
Diagram owns format and visual rules.
Never call explain.
For direct use, keep fidelity and rendered QA.

Ideas: [archify](https://github.com/tt-a1i/archify), [diagram-design](https://github.com/cathrynlavery/diagram-design), [visual-explainer](https://github.com/nicobailon/visual-explainer), [Matt Pocock](https://github.com/mattpocock/skills), and [poteto](https://github.com/poteto/how); guidance uses Axstack's own words.
