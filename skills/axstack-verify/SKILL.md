---
name: axstack-verify
description: When creating or maintaining a repository verification skill, use axstack-verify to build and prove its recipes through Implement.
---

# Verification skills

Usage: `/axstack-verify create` or `/axstack-verify maintain`

Route single-behavior requests to an existing `verify-<app>` skill or
[UI verification](../axstack/references/ui-verification.md) delegation.
Never use create for single-behavior requests.
Deliver create through `axstack-implement` with one writer and one PR.
The driver owns scope and dispatch under Implement's standing contracts.

## Create

### Read the repository

Read the repository for surface, run, drive, observe and isolate facts:

- Surface: identify the primary user interface and record other surfaces.
- Run: find documented start commands, readiness signals, ports and fixtures.
- Drive: find stable selectors, commands or endpoints in existing harnesses.
- Observe: identify action logs, resulting state and side-effect evidence.
- Isolate: determine how separate instances avoid shared data and port conflicts.

Reuse existing harnesses before choosing new tools.
Ground commands and selectors in this repository.
For a failing build, report it and hold generation.
Never edit product code or fix the build.
If isolation is unavailable, report the gap and hold live driving.

### Write the recipe and map

Preserve existing skills.
Resolve name collisions explicitly before writing.
Choose a distinct name or return the collision to the driver.
Write `.agents/skills/verify-<app>/SKILL.md` with Launch, Doctor, Drive, Evidence, Cleanup and Helpers sections.
Use only `name` and `description` as frontmatter keys.
Name the app, surface and invocation conditions in the description.

- Launch: give exact commands, readiness signals and instance ownership checks.
- Doctor: give read-only checks for process, version, port ownership and test auth.
- Drive: give the real user path with stable handles and observable end states.
  Keep browser recipes tool-neutral.
- Evidence: follow the proof standards in
  [UI verification](../axstack/references/ui-verification.md#proof-standards).
- Cleanup: stop only processes started by this run and remove owned scratch.
- Helpers: explain each helper's purpose and working directory.

Write `.agents/skills/verify-<app>/features/README.md` as an index of the top 3-5 user features.
Write per-feature files in `.agents/skills/verify-<app>/features/` and link them from the index.
Give each feature file its entry points, prerequisites, drive steps and observable proof.
Record gotchas and uncovered surfaces in the map.
Commit a relative symlink from `.claude/skills/verify-<app>` to `.agents/skills/verify-<app>`.
Use `../../.agents/skills/verify-<app>` as its target from `.claude/skills/`.
Make helpers executable and show each invocation in the skill body.
Resolve helper paths from the discovered skill directory so the Claude symlink works.
Test helper logic red/green before implementation.

### Isolate every attempt

Launch with an owned 0700 TMPDIR outside HOME for data, home and port bookkeeping.
Listen on loopback only.
Never use production secrets.
Keep evidence in the private evidence folder after cleanup.
Keep that folder outside scratch selected for deletion.
Clean up owned resources by literal absolute paths.
Follow [Safe deletion](../axstack/references/workspace-hygiene.md#safe-deletion).

For a peer PR, read the Launch recipe and helpers from the base revision and execute against the pinned candidate.
Keep trusted base helpers separate from the candidate's recipe files.
Bind evidence to the served SHA.
Report an unavailable candidate run as unverified.

### Prove the generated skill

Execute launch, doctor, drive one mapped feature, capture evidence, clean up and confirm evidence survives.
Run doctor before each drive.
The author drives only non-browser surfaces.
Delegate browser drives through
[UI verification](../axstack/references/ui-verification.md) to `axstack-ui-verifier`
with the feature file path in the brief.
Give the verifier the pinned candidate, isolated instance and private evidence path.
Clean up after every failed attempt.
Retry once after a drift fix.
If the retry fails, report the failure and hold acceptance.
Check discovery and relative-helper execution in both Claude Code and Codex.
If either harness is unavailable, report its checks unverified and hold acceptance.
Return proof commands, observed outputs, evidence paths and cleanup confirmation.
Record the bounded exception for generated-skill content on the implement §5 `TDD:` line.
Keep `axstack-verify` prose-contract red/green tests.
The exception covers the generated content's executed proof only.

## Maintain

Maintain mode is reserved for the next delivery task.
Report this mode unavailable until its procedure is implemented.

Ideas paraphrased from pstack's
[create-verification-skill](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/create-verification-skill/SKILL.md) (MIT).
