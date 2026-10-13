# Fidelity

Map factual nodes and edges to an inspected source path at a recorded full revision.
Drop unsupported factual elements.
For uncommitted sources, use the content hash and mark their pins unknown.
Keep the source map outside the reader view.
Display the short SHA.

Give planned and unknown nodes a visible marker in the node label.
Give planned and unknown edges a visible `planned` or `unknown` marker in the edge label.
In Mermaid, use the same visible markers and a dashed cue where its syntax permits.

Treat about 9 core nodes as a signal to split.
This is a design signal rather than a hard gate.
Use 1–2 accent nodes.
Keep labels short and name each relationship's direction and meaning.
Provide a text alternative that describes nodes and edges.
Never load network assets in the HTML.
Write diagrams into repo docs only when the user asks.
