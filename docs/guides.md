# Guides

These journeys start in your current T3 driver thread. Use `$skill` in Codex
or `/skill` in Claude. Replace example descriptions and PR URLs with your own.
[Concepts](concepts.md) explains the terms; [workflows](workflows.md) owns policy.

## Scope and build a feature

Ask `$axstack-align Help me scope account recovery.` The driver gathers facts,
settles material design questions and compares configured advisers' findings.
Invoke `$axstack-spec Write the agreed specification.` to record observable
acceptance, exclusions and a revision for your approval. After approval,
`$axstack-tickets Map the approved work into tasks.` prepares the dependency map.
`$axstack-implement Build the approved tasks.` carries it through authors,
exact-revision review and repairs. The driver publishes through `gh stack`
and records each candidate and its evidence.

## Small fix

For a clear one-PR repair, start with
`$axstack-implement Fix the empty-state message and verify the displayed result.`
The driver snapshots the request, acceptance checks and exclusions as the
small-change intent. It presents Release and host authority in that read-back.
A meaningful failing behavioral check precedes the implementation, then passes
with the fix. Accepted structure-preserving work instead keeps the same
characterization check green before and after.

Expect a candidate revision, targeted and full-suite results, and explicit
unverified boundaries. If scope or a prerequisite holds, the driver names the
gap and resume condition. You do not need separate planning artifacts solely
because a small change is new.

## Review a PR

Use `$axstack-review Review this pull request: <PR URL>`.
Peer review takes the PR description, linked issue and repository rules as intent
evidence. Configured reviewers inspect isolated checkouts at a pinned revision.
An authored candidate follows its provider-based review pairing. Findings bind
to the reviewed head; a changed head needs fresh evidence.

For report-only understanding, use
`$axstack-review Find issues in <paths> at <commit SHA>`.
A codebase report names coverage and unverified leads; it does not approve a PR.

## Watch own PRs

Use `$axstack-watch Watch this PR: <PR URL>` to authorize maintenance, or
`$axstack-watch Monitor this PR without making changes: <PR URL>` for observation.
To cover publications from this run, ask
`$axstack-watch Watch every PR raised by this chat until all merge or close.`
The owner reconciles checks, feedback, exact-head receipts and stack dependencies.
See [Chat-run PR watch](workflows.md#chat-run-pr-watch) and
[merge boundaries](workflows.md#automatic-merge-boundaries) for readiness and merge decisions.

## Debug

Use `$axstack-debug Diagnose this failure and establish a failing check: <symptom>`.
The driver builds a reproducible red loop, investigates the cause and hands off
a classified repair. Diagnosis alone does not land the change. An accepted
bounded repair returns to Implement with the original loop and minimized repro.

## Release

Record release and host-install authority with the driver, then follow the
[release procedure](../skills/axstack/references/autopilot.md#release-and-install-when-applicable).
It binds the version commit, tag-triggered publication and registry verification
to evidence. See [merge boundaries](workflows.md#automatic-merge-boundaries)
for approval gates and [host operations](host-operations.md) for authorized reinstall checks.
A local test result does not establish registry publication or host installation.
