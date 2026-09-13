---
name: axstack-spec
description: Produce a spec with observable acceptance criteria and exclusions; approved revision is the baseline.
---

# Spec

Produce the specification the user approves. Keep it observable.

## Required sections

- Capabilities with acceptance checks that can be observed (commands, outputs, states).
- Explicit exclusions (what is out of scope).
- Approved-spec identity block (template below). The approved revision is the execution baseline; preserve it while any change is resolved.

## Material change rule

If the approved spec changes materially: identify affected work, propose the
revised scope and plan, hold affected code changes until the user accepts,
preserve the previous baseline. Unrelated work may continue.

## Template: approved-spec identity

```text
Approved spec: <title> rev <id> (<date>)
Authoritative store: <Linear document URL | repo Markdown path>
Baseline preserved at: <ref>
Material change: <none | description + affected PRs/tasks + hold state>
```
