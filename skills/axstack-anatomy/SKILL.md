---
name: axstack-anatomy
description: When the user explicitly asks for an isometric, physical-object, or anatomy-style figure, use axstack-anatomy to build it with the vendored anatomy kit.
---

# Anatomy

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.
Before acting, load [Standing contracts](../axstack/references/contracts.md),
then follow its required lifecycle and audit pointers.

Direct `/axstack-anatomy` use follows [Explain](../axstack-explain/SKILL.md)
dispatch, review, preview and delivery. The driver thread never builds the figure.
The configured `axstack-explainer` authors it and `axstack-explainer-review`
reviews the exact final bytes; every interactive page also needs `axstack-ui-verifier`.
Follow [Delivery](../axstack-explain/references/delivery.md) for holds and repair limits.
The author returns size class and time estimate first, and the driver asks the
user before building above Figure. Figure is one mechanism, 40–80 parts,
SVG with at most one WebGL layer.

Read the vendored [Anatomy guidance](ANATOMY.md), [Craft](references/craft.md)
and [Kit](references/kit.md) for craft; this front door overrides upstream
automatic activation, agent setup, execution gates and delivery instructions.
Choose a physical object whose mechanism maps to the concept: the object is
the explanation. Write the concept and parts list before geometry.
Use the four-tone hierarchy with the subject as the lit part.
Paint back to front, bottom to top in painter's order.
Require lines to resolve onto a stroke, dot, or outline.
Verify truth, geometry, both themes and close-ups against inspected sources.

## Build in scratch

Copy kit/, scripts/inline-kit.mjs and the framework-free figure directory into
dispatch scratch with the same layout. Build with Bun from the vendored kit:
`bun <scratch>/examples/<name>/build.mjs` (add `--light` for light).
Builds write HTML beside build.mjs; prebuilt outputs are omitted.
Require the installed tree hash to remain unchanged.
Run `--audit` under Bun for audited parts and record result and time.
Mark Chrome-spawning capture, drive, lines, turn-check, any `node:child_process`
use and React examples (spot-plate, test-rig) unsupported.
Rendered checks use the configured verifier browser.
The upstream line-end check is an unproven gap covered by verifier close-ups.

Inject the exact [theme.js](theme.js) bytes into the built page as an inline
script after the kit script. Set `body[data-axstack-theme]` only for an explicit
user dark/light request. The marker wins over the build's `data-theme`.
Inside T3 the wrapper reads `--background` luminance on load and changes,
using the browser canvas for any CSS color syntax, then sets the kit palette
and removes page gutters/background. The inner figure card stays.
Standalone, it restores a self-contained page background and follows the
marker or live `prefers-color-scheme` when the T3 variable is absent.
Live T3 theme switching is unproven in this run; wrapper unit tests cover it.

## Exact-byte delivery

Keep one self-contained page. Never load network resources.
Count final UTF-8 page bytes against the cap of 512,000 (`maxLength`).
At or below 512,000 bytes, deliver inline under
[Inline pages](../axstack-explain/references/inline-pages.md).
Run `html_preview` at 728px dark and 360px light.
The driver publishes the exact checked bytes with `html_render` following Inline pages.
Author previews are optional self-checks; they replace neither driver gating
previews nor the interactive verifier pass.

Above 512,000 bytes, keep the author and reviewer bindings, exact-bytes network
scan and ui-verifier loopback pass. The verifier emulates `prefers-color-scheme`
dark and light at 728 and 360 in its configured browser, honoring user browser
policy. Apply all Inline pages rules, including its 700-word cap and theme,
except `html_preview`/`html_render`.
Save to `~/axstack-pages/<run>/<name>.html` on the driver host and give its
host-local path with a short chat summary.
Require the saved file SHA-256 to equal the reviewed SHA-256.
Keep saved files until the user removes them. No hosting or remote resources.
