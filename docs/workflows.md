# Axstack workflows

Chat drives execution; the CLI installs and checks assets. Paseo owns
sessions, workspaces, delegation, notifications, schedules, and heartbeats.
No Axstack daemon, multi-host scheduler, or upstream skill dependency.

## Phase skills

Progressive loading: invoke only the phase needed.

- `axstack` — entry router: lifecycle, holds, one host, two PRs, one owner per PR.
- `axstack-align` — interview and resolve factual questions.
- `axstack-spec` — observable acceptance criteria, exclusions, approved revision baseline.
- `axstack-tickets` — Linear native document preflight per session (missing access is a setup gap), explicit Markdown fallback, capability to task map, report-only checker, driver-owned updates. Reviewed-but-unmerged stays **In Review**; Done needs all required PRs merged plus acceptance checks passing.
- `axstack-implement` — strict red-green-refactor with revision-tied evidence; exclusive writers; `gh stack` coordination; restart reconciliation (ambiguity never authorizes a duplicate writer).
- `axstack-review` — exactly two independent Sol and Opus final reviewers, same six-angle brief, no cross-reading, no votes. Prompt-only urgent escalation holds approval, merge-ready declarations, and dependent dangerous actions; Hermes relay is optional with Paseo chat fallback.
- `axstack-watch` — bounded monitoring (default 24h) ending early on full merge; resumable handoff carries PR, revision, owner, spec, CI/review states, remaining actions, and resume refs. No silent renewal.

## Role profiles

`profiles/paseo.json` (`version: 1`, `agentProfiles` array, `axstack-*`
IDs) covers driver, Fable advisor, Opus owner, Sol author, independent Opus
and Sol reviewers, and the report-only checker. The checker model stays
unset until user setup. Validate model availability at launch; an
unavailable model pauses affected work pending user decision — never
automatic substitution. Configure permissions explicitly and validate
capability (including Linear MCP access) per session.

## Compatibility

A compatibility claim requires evidence for the actual adapter, model
configuration, skill loading, and tools. An installable skill alone is not
proof of end-to-end support.
