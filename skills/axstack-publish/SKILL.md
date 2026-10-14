---
name: axstack-publish
description: When the user requests publication of an Explain HTML article, use axstack-publish to verify and publish that article in the explicitly authorized mode.
---

# Publish

Publish an existing Explain HTML article through the notes CLI on axat-vps.
The current T3 driver owns publication; workers return checked artifacts.
Load [Standing contracts](../axstack/references/contracts.md) and follow its
lifecycle pointers. Keep page bytes, checks and receipts in private run evidence.

## 1. Bind the request

Identify the Explain page by its exact bytes, byte count and SHA-256.
State the article, slug, mode (`private` or `public`) and target URL.
Public targets `https://notes.axatbhardwaj.xyz/<slug>/`; private targets the
SlashDocs document URL on `https://docs.axatbhardwaj.xyz` returned by the CLI.
For a new private document, state that origin and slug before publication and
record the allocated URL afterwards.
Require explicit authority for exactly one article and one mode per request.
Promotion, unpublish, reader changes and grant changes each need their own request.
Local creation or an earlier publication supplies no new publication authority.
If the request leaves the article or mode unclear, hold publication for clarification.

## 2. Prepare the final artifact

For public mode, run the [Explain redaction check](../axstack-explain/SKILL.md#3-verify-and-deliver)
to remove private paths, IDs, credentials, prompts, messages and internal records.
For public mode, run Explain's [self-contained asset check](../axstack-explain/references/inline-pages.md#check-the-exact-bytes).
Reuse Explain's [page rules](../axstack-explain/references/inline-pages.md#page-rules)
and [Visual QA](../axstack-explain/references/visual-qa.md) for checks and verifier routing.

Add a standalone light/dark theme with inline defaults and `prefers-color-scheme`
so the article works outside T3; honor an explicit user theme request.
Theme adaptation changes bytes: save `final.html`, its byte count and SHA-256,
then rerun the Explain page checks on these final bytes, including public
redaction and self-contained assets when applicable.
Require a fresh independent `axstack-explainer-review` on the final bytes.
Preview these exact bytes with Playwright MCP at 728px dark and 360px light;
record both screenshots and the Explain QA results.
Any subsequent byte change invalidates checks and review: repeat this step.
Hold publication while any required check or review is missing or failed.

## 3. Publish from the driver

Only the driver thread may publish, using stdin only with no TTY and at most
5,000,000 bytes (5 MB) of final HTML:

```bash
ssh axat-vps notes publish --mode <private|public> --slug <slug> < final.html
```

Validate the slug as `^[a-z0-9][a-z0-9-]{0,63}$` and select one literal mode.
Use safely quoted arguments, never interpolate unchecked input into a shell.
Require exit zero and one JSON line containing `url`, `doc`, `version`, `sha256`.
Compare its SHA with the final artifact; a mismatch or ambiguous result holds
success reporting until reconciled with `ssh axat-vps notes status --slug <slug>`.
Retain phase errors and pending state as unresolved evidence.

## 4. Prove the live result and return

Verify the live URL in a real browser using Playwright MCP against the final SHA-256.
For public mode, verify an anonymous browser reads exact response bytes at
`https://notes.axatbhardwaj.xyz/<slug>/` whose SHA-256 matches the final artifact.
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

Agents never handle reader passwords.
Agents never run `notes reader show` or allocate a TTY (`-t` or `-tt` on SSH).
Reader and grant commands require their own request and secret-free non-TTY output.
The owner shares reader credentials separately from the article link.
