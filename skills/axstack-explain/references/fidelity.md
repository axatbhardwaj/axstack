# Fidelity

Map factual nodes and edges to an inspected source path at a recorded full revision.
Drop unsupported factual elements.
For uncommitted sources, use the content hash and mark their pins unknown.
Keep the source map outside the reader view.
Display the short SHA.

Give planned and unknown nodes a visible marker in the node label.
Give planned and unknown edges a visible `planned` or `unknown` marker in the edge label.
Follow [Mermaid](mermaid.md) for status markers that preserve each diagram type’s syntax.

Use Mermaid density warnings as an advisory to split and legibility as a gate.
Use at most two accent nodes per flowchart.
Keep labels short and name each relationship's direction and meaning.
Provide a text alternative that describes nodes and edges.
Never load network assets in the HTML.
Write diagrams into repo docs only when the user asks.
