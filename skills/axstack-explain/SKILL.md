---
name: axstack-explain
description: When understanding a system, change, or implementation gap, use axstack-explain to show how it works and what exists, is missing, or remains unverified.
---

# Explain

Explain a system, change, current behavior, intended behavior, or implementation
gap from inspected evidence. This direct route needs no spec ceremony. Use
project documentation as evidence where relevant. It supersedes `axstack-docs`; if a stale install
exposes both skills, route the request here only.

Before acting, load [Standing contracts](../axstack/references/contracts.md),
then follow its required lifecycle and audit pointers. Explanation work has no
scope baseline. Ordinary work in the current chat needs no launch preflight;
load the [Orca runtime boundary](../axstack/references/orca-runtime.md) only
immediately before an actual profile dispatch.

## 1. Bound the question and evidence

1. Identify the audience, question, requested format, theme, and publication
   boundary.
2. Record the inspected paths. Use an exact revision for Git sources; for a
   non-versioned file, screenshot, or exported snippet, use a stable source
   identity or content hash. Record any live target and observation method.
   Record the history window when available; unavailable history is a named
   limitation, never an invented window. Trace the relevant flow, boundaries,
   dependencies, and actual behavior before comparing current versus intended
   behavior.
3. Mark material claims independently as **source implemented**, **tested**,
   **live observed**, **planned/proposed**, or **unknown**. These dimensions can
   coexist; none implies another.
4. For every gap, cite its inspected scope and applicable revision, stable
   source identity, or content hash. “Not found” never means app-wide missing
   without app-wide evidence; anything outside the inspected scope is unknown.
5. For "what could this break" or "blast radius of X", follow
   [Blast radius](../axstack/references/blast-radius.md): find the breakage
   beyond the diff and prove the one safety fact by running real code, or
   mark it unproven.
6. For "show me your work" on existing work (a run, PR, branch, or change),
   reconstruct the decision trail rather than re-describing the diff: read the
   run record's `Decisions` and `Learnings`
   ([run record](../axstack/references/run-record.md)), then the commits, PR
   body, review receipts, and ADRs. Present each consequential choice as what
   was chosen, why, the evidence pointer, and its result; separate what the
   record proves from what is inferred, and list choices with no recorded
   reason as open rather than inventing one.

## 2. Choose proportional output

1. For a simple request, answer concisely in the current chat. Use a compact
   diagram when useful. This needs no mandatory agent or intermediate artifact.
2. For a complex visual, use the configured `axstack-explainer` role to create
   self-contained HTML, or use the requested artifact format. An explicit user
   theme wins; otherwise use the dark default.
3. Profile IDs are presets, not availability proof. Before dispatch, follow the
   launch sequence and preserve the configured model, mode, and effort. Report
   an unavailable route; never substitute a model.

## 3. Verify and deliver

1. Any HTML explanation requires the full [visual QA
   checklist](references/visual-qa.md): actual desktop and mobile rendering,
   interaction, accessibility, and reduced-motion checks where relevant.
2. Use the configured independent `axstack-explainer-review` role when
   warranted, bound to the exact artifact identity. Any byte change invalidates
   that review and requires a fresh check. In `claude-only`, separate Sonnet
   author xhigh and reviewer high sessions are allowed for explanations as
   session independence only. This exception never permits same-model code
   review or a cross-provider-independence claim.
3. Report source, tests, rendered observations, independent review, and
   publication as separate evidence. Name every missing or unavailable check.
4. For a public artifact, remove private paths, identifiers, prompts,
   credentials, messages, and internal records. Local creation does not grant
   authority to publish.
5. Deliver the smallest useful explanation. Explanation causes no automatic
   design and no automatic implementation; route later change work separately
   only when the user requests it.
