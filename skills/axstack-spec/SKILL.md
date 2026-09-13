---
name: axstack-spec
description: Resolve the source store with preflight, write the Linear document, snapshot the approval baseline.
---

# Spec

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)

## 1. Resolve the source store first

Default is the Linear native document; repository Markdown is an explicit
alternative. Record the resolution before any write. Never silently switch
stores.

## 2. Preflight before writing (Linear mode)

Check the actual session's required MCP tools and access for document
read, create, and update — before creating or updating the document.
Missing access is an actionable setup gap: report it, do not write, do not
switch stores silently. The tickets-phase check is too late; it never
substitutes for this one.

## 3. Write the spec

Produce the specification the user approves, with observable acceptance
criteria and explicit exclusions. In Linear mode the authoritative spec is
the native Linear document; in Markdown mode it is the agreed repo path.

## 4. Approval baseline snapshot

On user approval, snapshot the approved revision identity and its explicit
Markdown counterpart (a concise repo copy of the approved revision for
reference; the Linear document stays authoritative):

```text
Approved spec: <title> rev <id> (<date>)
Authoritative store: <Linear document URL | repo Markdown path>
Markdown counterpart: <repo path + ref>
Baseline preserved at: <ref>
Material change: <none | description + affected PRs/tasks + hold state>
```

## Material change rule

If the approved spec changes materially: identify affected work, propose the
revised scope and plan, hold affected code changes until the user accepts,
preserve the previous baseline. Unrelated work may continue.
