---
name: axstack-docs
description: When source-backed prose or a visual explanation is requested, use axstack-docs to create and verify the artifact.
---

# Docs

Create the requested prose or visual artifact in its requested form, with
material claims traceable to inspected sources and each kind of verification
reported honestly. This route is independently callable and needs no spec or
ticket map. Deliver directly; no intermediate artifact is required.

Before acting, load [Standing contracts](../axstack/references/contracts.md),
then follow its required lifecycle and audit pointers. Docs work has no scope
baseline, but shared authority, model, run-record, and audit rules still apply
where their conditions are met.

## 1. Fix the deliverable boundary

Identify the requested artifact, audience, format, theme, and publication
boundary. An explicit user format or theme wins. For visuals without a stated
theme, use the dark default. Record the output shape and the claims or behavior
that need verification.

Producing a local file authorizes only that local artifact. Sharing, posting,
merging, or otherwise publishing it requires separate explicit authority.

## 2. Establish the source basis

Inspect the authoritative sources for every material factual claim. Keep
source correctness separate from presentation quality. Trace each material
claim to an inspected source, or mark it unverified and name the missing
evidence.

## 3. Produce through the matching route

- Prose uses `axstack-docs` (Opus low). Deliver Markdown, notes, or the other
  requested text format directly, with no HTML conversion.
- A requested visual uses `axstack-explainer` (Sonnet xhigh) and produces
  self-contained HTML or the suitable requested artifact. Use only the user's
  supplied theme or the default above; private theme configuration and
  upstream visual skills are outside this workflow.

These profile IDs are presets, not evidence of live availability. Ordinary
reading and writing in the current session needs no launch preflight. If an
actual dispatch is needed, read the [Paseo launch
sequence](../axstack/references/paseo-launch.md) immediately before dispatch;
its live checks decide whether the configured route can run, with no implicit
model fallback. Produce the final local artifact or report the exact
launch/setup gap.

## 4. Verify the artifact

For prose, confirm the requested format and source basis. For a visual, load
the [visual QA checklist](references/visual-qa.md) and inspect actual desktop
and mobile rendering, interaction, accessibility, and reduced-motion behavior
where relevant. If independent visual verification is warranted, use
`axstack-explainer-review` (Luna max) against the exact artifact identity.

Unavailable browser or accessibility evidence stays explicitly missing; it is
never inferred from source inspection. Any artifact change invalidates the
affected visual review and requires a fresh check. Bind the checks to the final
artifact identity and list every unavailable check.

## 5. Deliver the evidence-backed result

Return the artifact in the requested form. Report source verification,
rendered visual QA, independent review, and publication state as separate
claims, including limitations. Identify the final artifact and distinguish
what was verified from what remains unknown.
