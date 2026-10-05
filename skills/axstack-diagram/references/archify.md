# Archify

Archify turns a typed JSON intermediate representation (IR) into an HTML viewer.
Follow [Fidelity](fidelity.md) before authoring.

## Bind the tool

Read `archify.json` beside the skill entrypoint for its `{path, sha}` record.
Verify that `git -C <path> rev-parse HEAD` equals the recorded SHA.
If the record or copy is missing, HEAD mismatches the recorded SHA, or Chrome is missing, hold and ask the user.
Honor `ARCHIFY_CHROME` when set.
Otherwise find Chrome or Chromium on `PATH`.
Set `ARCHIFY_UPDATE_CHECK_DISABLED=1` on every archify call.
Never substitute Mermaid or unverified HTML when the viewer is required.

## Author the IR

Read `<path>/archify/schemas/<type>.schema.json` and its shared definitions.
Read one matching shipped example in `<path>/archify/examples/`.
Write your own IR with the schema's version and `diagram_type`.

| Type | Use | Main collections |
|---|---|---|
| architecture | Components and boundaries | `components`, `connections`, `boundaries` |
| workflow | Decisions and paths through lanes | `lanes`, `nodes`, `edges` |
| sequence | Ordered messages between participants | `participants`, `messages` |
| dataflow | Data movement through stages | `stages`, `nodes`, `flows` |
| lifecycle | States and transitions | `lanes`, `states`, `transitions` |

Set `meta.title` and a portable relative HTML filename in `meta.output`.
Use `meta.quality_profile: "showcase"`.
Set `meta.animation: "none"`.
Keep trace motion, exports, share cards, and brand marks off unless the user asks.
Deliver and open the viewer with `?theme=dark` unless the user names a theme.
Theme is viewer state rather than an IR field; without the query, localStorage and `prefers-color-scheme` determine it.
Preserve explain's claim labels in `meta.subtitle` or the companion explanation.
Set `meta.repository` to the inspected repository URL and full `revision`.
Keep per-node source pins in each node's `sources` entries for inspected paths and line ranges.
Keep the private source map for relationships that have no source field.
Keep proposed sources distinct from factual pins.
Use [Fidelity](fidelity.md) for visible planned and unknown markers.
Before relying on an extra dashed cue, run `bun <path>/archify/bin/archify.mjs validate <type> <ir.json> --json`.
For sequence and dataflow, a schema-valid legend cue is `meta.legend.entries.dashed: {"label":"Planned or unknown"}`.

Use one top-level `cards[]` entry with `{dot, title, items[]}` per key node as its node detail card.
Each node detail card has at most 40 words and cites its source.
Count the title plus all items toward each card's 40-word cap.
Cite each card's source inline as `file:lines` in its `items[]`.
Node detail cards are exempt from explain's 700-word cap.
Count node labels, headings, captions, and all non-card text.

## Build and hold

Write the IR, HTML, and receipt only inside the private evidence folder.
For direct invocation, create a private run evidence folder first.
Run `bun <path>/archify/bin/archify.mjs finalize <type> <ir.json> <out.html> --quality showcase --json --out-dir <evidence dir> --repo-root <repo>`.
This is the author's headless build gate.
Read the saved receipt named by the JSON result's `evidence.receipt`.
Accept only receipt `status: "pass"` as success.
Never trust exit codes as proof of a pass.
When a receipt is missing or remains non-pass after two repair rounds, hold delivery and ask the user.
If Chrome is missing, report "viewer not verified: Chrome missing".
Chrome absence yields `status: "skipped"` and exit 2.
For repairable defects, use the receipt's diagnostics and `supportedFixes`.
For viewport or readability conflicts, prefer fewer nodes, merged lanes, and shorter sublabels before changing `meta.viewBox`.
A `meta.viewBox` fix can trade one composition rule for another.
Run at most two repair rounds, then hold with remaining defects for the user's decision.

## Rendered and source checks

Follow [UI verification](../../axstack/references/ui-verification.md) for dispatch.
Require `axstack-ui-verifier` checks of the receipt's `artifact.sha256` bytes on desktop, 390px mobile, keyboard, reduced motion, and the text alternative.
Include theme, search or focus, and directional reach interactions.
Require `axstack-ui-verifier` checks with the theme set explicitly.
Require `explainer-review` of every node and edge against source for archify output.
Every byte change requires fresh checks.
Keep these independent verdicts with the build receipt before delivery.
