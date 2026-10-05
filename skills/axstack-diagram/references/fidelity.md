# Fidelity

Map factual nodes and edges to an inspected source path at a recorded full revision.
Drop unsupported factual elements.
For uncommitted sources, use the content hash and mark their pins unknown.
Keep the source map outside the reader view.
Display the short SHA.

Give planned and unknown nodes a visible marker in the node label and their card, if any.
Use the literal marker `planned` or `unknown` for all five types.
Give planned and unknown edges a visible `planned` or `unknown` marker in the edge label.
For dashed styling, use only properties the pinned schema accepts and verify with `validate`.
This is an extra cue, such as a dashed relationship where supported.
The pinned node collections reject `variant`.
Add a planned or unknown legend entry only for sequence and dataflow.
Architecture, workflow, and lifecycle reject a `dashed` legend entry.
In Mermaid, use the same visible markers and a dashed cue where its syntax permits.

Treat about 9 core nodes as a signal to split.
This is a design signal rather than a hard gate.
Use 1–2 accent nodes.
Keep labels short and name each relationship's direction and meaning.
Provide a text alternative that describes nodes and edges.
Never load network assets in the HTML.
Write diagrams into repo docs only when the user asks.
