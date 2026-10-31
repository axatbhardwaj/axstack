---
name: axstack-publish
description: When the user requests publication of an Explain HTML article, use axstack-publish to verify and publish that article in the explicitly authorized mode.
---

# Publish

Publish an existing Explain HTML article through the notes CLI on the configured publish host.
The current T3 driver owns publication; workers return checked artifacts.
Load [Standing contracts](../axstack/references/contracts.md) and follow its
lifecycle pointers. Keep page bytes, checks and receipts in private run evidence.

For explicit local non-repository work, apply
[Local artifacts](../axstack/references/local-artifacts.md) before native dispatch.
Preserve this phase's independent source/fact and exact-byte review requirements.

## 1. Bind the request

Read host-managed `~/.config/axstack/publish.json` containing string fields
`sshHost`, `publicOrigin` and `docsOrigin`.

```json
{"sshHost":"<publish host>","publicOrigin":"<public HTTPS origin>","docsOrigin":"<docs HTTPS origin>"}
```

Validate `sshHost` as `^[A-Za-z0-9][A-Za-z0-9.-]*$` and both origins as HTTPS
URL origins with no credentials, path, query or fragment.
Hold publication if the config is missing or invalid.
Never guess a publish host or either origin.
Keep these routing values host-managed; this config grants no publication authority.
Identify the Explain page by its exact bytes, byte count and SHA-256.
State the article, slug, mode (`private` or `public`) and target URL.
Public targets `<publicOrigin>/<slug>/`; private targets the
SlashDocs document URL at `docsOrigin` returned by the CLI.
For a new private document, state that origin and slug before publication and
record the allocated URL afterwards.
Require explicit authority for exactly one article and one mode per request.
Promotion, unpublish, reader changes and grant changes each need their own request.
Local creation or an earlier publication supplies no new publication authority.
If the request leaves the article or mode unclear, hold publication for clarification.

Before publishing, validate the slug as in §3 and read `ssh <publish host> notes status --slug <slug>`.
Before a republish, state the slug's current audience from status.
Public mode never asks about or takes an audience.
Before promoting a shared slug to public, warn that the article becomes world-readable.

In private mode, run `ssh <publish host> notes audience list` on the validated host
with no TTY and require one JSON line.
Validate its `audiences` array of `{name, title, reader, folder, disabled, pending}`.
If `audience list` fails, run `ssh <publish host> notes --help` with no TTY.
An `audience list` failure holds sharing and is reported unless `notes --help`
lacks a `notes audience list` usage entry.
If `notes --help` lacks the `notes audience list` entry, ask nothing new.
Other failures hold only sharing; publication may proceed under its existing authority.

In private mode only, ask once while binding the request, before publishing.
Ask only if enabled, complete audiences exist (`disabled: false`, `pending: null`)
and `notes status --slug <slug>` shows the slug unshared.
For an existing private document, treat the slug as unshared only when its private
status has both `private.audience: null` and `private.share: null`.
For a new slug, `private: null` counts as unshared.
Hold sharing if status is unreadable, ambiguous or shows a pending share.
For one audience ask “Is this for <title>?” and for several ask
“For which audience: <titles> or none?”.
For an already-published slug, the question states that the team will also see earlier versions.
The answer is the explicit grant request for exactly that slug and that audience.
Never infer an audience from a slug, title, repository or label.
A “no” never revokes access.
Removals and other readers still need their own request.

## 2. Prepare the final artifact

For public mode, run the [Explain redaction check](../axstack-explain/SKILL.md#3-verify-and-deliver)
to remove private paths, IDs, credentials, prompts, messages and internal records.
For public mode, run Explain's [self-contained asset check](../axstack-explain/references/inline-pages.md#check-the-exact-bytes).
Reuse Explain's [page rules](../axstack-explain/references/inline-pages.md#page-rules)
and [Visual QA](../axstack-explain/references/visual-qa.md) for checks and verifier routing.

Send the article adaptation, including art direction and standalone light/dark theme,
to `axstack-explainer` with a bounded brief.
The explainer loads and follows Explain's [design guidance](../axstack-explain/references/design.md)
and reads [frontend-design](../axstack-explain/references/frontend-design/FRONTEND-DESIGN.md).
Require inline defaults and `prefers-color-scheme` so the article works outside T3;
honor an explicit user theme request.
Theme adaptation changes bytes: save `final.html`, its byte count and SHA-256,
then rerun the referenced Explain page checks on these final bytes.
Before independent review, have `axstack-ui-verifier` preview these exact bytes with
Playwright MCP at 728px dark and 360px light plus 390px mobile and 1440px desktop,
covering all four widths in both themes, and record screenshots with paths,
their artifact SHA-256 and the Explain QA results.
Require a fresh independent `axstack-explainer-review` on the final bytes.
The driver forwards the verifier PNG paths and bound artifact SHA-256 for the
reviewer's design review against FRONTEND-DESIGN.md (calibration defaults, restraint
and quality floor) plus design.md's hard rules, alongside source-fidelity review.
A page failing to look decent is a blocking design finding, repaired by the same author within the two-round visual limit.
If only design findings remain after the second round, deliver the visual with each finding named and recorded in evidence.
Never describe a remaining finding as fixed or a clean pass.
Follow Explain's [Delivery](../axstack-explain/references/delivery.md) for normal holds
on hard-rule, fidelity, security, asset, theme, accessibility, layout-defect,
interaction and publication failures.
Any subsequent byte change invalidates checks and review: repeat this step.
Hold publication while any required check or review is missing or failed, except for
the design-only delivery after the second round above.
Unavailable, unreadable or stale renders leave design review unknown and hold publication.
Never treat unknown design review as a pass.

## 3. Publish from the driver

Publish only from the driver thread.
Use stdin only with no TTY and at most
5,000,000 bytes (5 MB) of final HTML:

```bash
ssh <publish host> notes publish --mode <mode> --slug <slug> < final.html
```

Use the validated `sshHost`, validate the slug as `^[a-z0-9][a-z0-9-]{0,63}$`
and select one literal mode (`private` or `public`).
Use safely quoted arguments, never interpolate unchecked input into a shell.
Require exit zero and one JSON line containing `url`, `doc`, `version`, `sha256`.
Compare its SHA with the final artifact; a mismatch or ambiguous result holds
success reporting until reconciled with `ssh <publish host> notes status --slug <slug>`.
Require the returned URL's origin to match the configured origin for that mode.
Retain phase errors and pending state as unresolved evidence.

## 4. Prove the live result and return

Verify the live URL in a real browser using Playwright MCP against the final SHA-256.
For public mode, verify an anonymous browser reads exact response bytes at
`<publicOrigin>/<slug>/` whose SHA-256 matches the final artifact.
Hash the response body bytes, rather than DOM serialization or rendered text.
For private mode, verify anonymous navigation reaches the SlashDocs sign-in page
leading to Dex and `notes status --slug <slug>` reports `published: true`, the
live version and SHA-256 that matches the final bytes.
Compare status's private version with the publish result; null live metadata
or a pending operation leaves verification unproven.
Reader-side reads are proven only by the separately authorized AC23 end-to-end
run; an anonymous redirect and CLI metadata do not prove a reader grant.
Return URL, version and SHA-256 with the live verification evidence or its hold.
Tell the user when `overwrote_external_edit` is true: publication replaced an
external edit, retained as an earlier SlashDocs version.

On a yes for one audience or an explicit selection among several audiences,
only after the verified private publish (§3 and §4), run
`ssh <publish host> notes grant add --slug <slug> --audience <audience>`.
Use the selected audience's `name` for `<audience>` and safely quote arguments.
Require exit zero and one secret-free JSON line for the grant, without a TTY.
Check grant JSON fields `slug`, `audience`, `doc` and `folder` match the requested
slug and audience, published doc and selected folder.
Report a failed or held share as incomplete while the private publish stays valid.
Never claim a failed or held share succeeded.

Agents never handle reader passwords.
Agents never run `notes reader show` or allocate a TTY (`-t` or `-tt` on SSH).
Reader and grant commands require their own request and secret-free non-TTY output.
The owner shares reader credentials separately from the article link.
