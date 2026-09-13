---
name: axstack-research
description: When one bounded question needs verified answers, use axstack-research to produce a source-linked note with limitations.
---

# Research

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Source checklist](references/checklist.md)

Independently callable. A research-only run never requires a spec
baseline, ticket mapping, or author pipeline, and never writes product
code or publishes anything unless requested.

## Bounded question

Restate the bounded question and its edges before fetching: what is in
scope, what is excluded, and which claims would change the answer. One
bounded question stays one run; split only genuinely independent
questions.

## Source-first evidence

Fetch the actual primary sources — docs, code, or tool output — instead
of reasoning from memory. Date and pin claims when needed: record source
versions, revisions, and access dates so a later reader can recheck.
Detail steps live in the [source checklist](references/checklist.md).

## Verdicts, not vibes

Tag every material claim as verified (inspected source cited), inference
(explicit reasoning from verified claims), or unverified (boundary the
run could not check). Never present inference or unverified material as
verified. End with explicit limitations.

## Direct first, fan out only when useful

A single direct factual lookup stays direct in the current chat. Launch
subagents only when bounded independent work is useful — for example
parallel distinct questions — never as an automatic research team, and
never as implementation.

## Routes (data presets, not readiness claims)

Core provides these routes as profiles; pick the smallest useful set,
and do not require all of them. Confirm live availability per the shared
launch sequence; nothing here claims live model readiness:

- `axstack-research-requirements` (Opus medium): requirement and intent questions.
- `axstack-research-code` (Sol medium): code-behavior questions.
- `axstack-research-web` (Opus low): web and external-source questions.
- `axstack-explore-codebase` (Sonnet xhigh): broad codebase mapping.
- `axstack-explore-execution` (Terra low): execution and runtime traces.

## Output

Deliver a source-linked Markdown artifact for the requested research:
question, bounds, each claim with its source link and verified /
inference / unverified tag, then limitations. No code changes.
