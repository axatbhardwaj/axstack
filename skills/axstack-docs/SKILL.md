---
name: axstack-docs
description: When source-backed prose or a visual explanation is requested, use axstack-docs to create and verify the artifact.
---

# Docs

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Visual QA](references/visual-qa.md)

Independently callable. Source-check material claims against inspected
sources, then deliver the requested format. No mandatory intermediate artifact sits between the request and delivery.

## Prose

Ordinary prose runs on the `axstack-docs` route (Opus low). No mandatory HTML for prose: if the user asked for Markdown, notes, or another text
shape, deliver exactly that. Verify material claims against sources;
mark what could not be verified.

## Requested visuals

A requested visual runs on the `axstack-explainer` route (Sonnet xhigh).
Send it to `axstack-explainer-review` (Luna max) only where independent
visual verification is warranted. These routes are data presets;
capability checks and live settings follow the shared launch sequence,
which alone decides what can actually run.

Visual output is self-contained HTML or the suitable requested artifact.
The explicit user theme wins; otherwise use a dark default. Never
require an upstream visual skill and never read private theme config.

## Rendered inspection

Inspect actual desktop and mobile rendered behavior, plus interaction,
accessibility, and reduced-motion handling where relevant. Steps live in
the [visual QA checklist](references/visual-qa.md). Source correctness
and visual QA are different claims: report each separately.

## Honest evidence

Unavailable browser evidence is reported as missing, never fabricated.
Review names the exact artifact identity it verified; any change to that
artifact invalidates the affected review and needs a fresh check.

## Local output vs publish authority

Producing a local output file never authorizes publication. Publishing —
sharing, posting, or merging the artifact anywhere — requires its own
explicit authority.
