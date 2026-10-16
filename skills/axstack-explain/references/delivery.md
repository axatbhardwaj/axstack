# Delivery and holds

Use this single fallback rule for Explain and direct Anatomy delivery.
A whiteboard-defense explanation covers a whole system, PR, run or change
under [Whiteboard defense](whiteboard-defense.md).
If the reviewer is unavailable, hold the whiteboard-defense explanation and name the unavailable reviewer.
Hold a whiteboard-defense explanation still failing claim review after two repair rounds with
the same author, naming unresolved findings. Never deliver it unreviewed or as reviewed.
Visual-only findings follow the visual rule, and claim findings hold the whiteboard-defense explanation.

For a missing preview or render tool, unavailable verifier or check, or page
absent after ambiguous `html_render`, hold the page and answer in plain prose
naming the held page and the reason.
Whiteboard-defense plain prose still requires `axstack-explainer-review`.
If a required author or reviewer seat is unavailable, hold the visual and
answer in plain prose naming the held visual.
Except for design-only findings below, replace a visual still failing checks after
two repair rounds with the same author by plain prose with the reason.
For inline HTML pages and Publish article adaptations, judge the exact-byte renders
against [FRONTEND-DESIGN.md](frontend-design/FRONTEND-DESIGN.md), including its calibration defaults,
restraint and quality floor, plus [design.md](design.md)'s hard rules.
A page failing to look decent is a blocking design finding, repaired by the same author within the two-round visual limit.
If only design findings remain after the second round, deliver the visual with each finding named and recorded in evidence.
Never describe a remaining finding as fixed or a clean pass.
Hard-rule, fidelity, security, asset, theme, accessibility, layout-defect, interaction
and publication failures keep their normal holds and repair rules.
An unavailable, unreadable or stale render leaves design review unknown and holds
the visual or publication; inline delivery may use the plain-prose fallback above.

The driver never writes a substitute visual.
Each repair round returns findings to the same author and rechecks the exact final bytes.
An anatomy page above the size cap follows [Anatomy](../../axstack-anatomy/SKILL.md)
for oversized delivery, with the same author and reviewer bindings.
