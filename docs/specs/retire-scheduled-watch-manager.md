# Retire the scheduled watch and repair manager

Approved 2026-09-23. The authoritative specification is [GitHub issue #148](https://github.com/axatbhardwaj/axstack/issues/148) with body SHA-256 `645c303ecf80aacd1e869171bb9880e5b84995695906d44c618234857e84817a`. The user invoked `$axstack-implement` directly after the checkpoint for that exact body. This file is the repository counterpart; the issue body governs material scope questions.

## Outcome

Keep the scheduled peer-review manager. Retire the scheduled own-PR watch and repair manager from current skills, prompts, docs, and active tests. Own-PR babysitting and repair outside an active authorized implementation run are user-driven through `axstack-watch`. The `axstack-implement` author–review–repair loop remains intact.

## Delivery

- Make `skills/axstack/references/automations.md` review-manager-only and delete `watch-manager-prompt.md`.
- Remove scheduled-watch branches from `axstack-watch`, its runtime guidance, the shared lifecycle, the review skill, and candidate publication. Keep manual adopted-PR maintenance in `repair-publication.md`.
- For manual adopted-PR repair, pin remote head/base, prepare a local candidate, independently review that local SHA and reply bodies, revalidate, then publish through authorized `gh stack` and read back. Preserve the normal implementation publish-before-review loop.
- Update README and current workflow/installation docs. Migrate active workflow tests and the frozen manager fixture from v5 to v6 with a documented new hash, replacing only obsolete watch-lane cases.

## Acceptance

1. A meaningful contract check fails on the pinned base because scheduled watch/repair remains, then passes after implementation; structure-only checks may use an unchanged green characterization before and after.
2. Current skills, README, installation/workflow docs, and active tests no longer instruct scheduled own-PR watch/repair or reference the deleted prompt.
3. Manual `axstack-watch` preserves observation-only, peer, and authorized maintenance; one accountable owner; actual author/reviewer provenance; exact-head checks; quiet unchanged observations; task-owned expiry and cleanup; and the user chat/workspace.
4. Manual adopted-PR repair gets exact-local-SHA review before publication and remote readback. The normal `axstack-implement` publication and same-author repair loop remains intact.
5. Scheduled peer review retains eligible discovery, exact-head binding verdicts, human review blocks, measured-capacity admission, native recovery, evidence, cleanup, canary, and finite-session safeguards.
6. Focused workflow checks and the full `bun:test` suite pass at the candidate revision. Source and test results are reported separately from live runtime proof.

## Exclusions

This source change does not mutate the VPS automation, other host settings, installed home skills, private evidence, model presets, installer code paths, the review manager's live schedule, or human merge authority. Historical `docs/specs/` and `docs/plans/` files remain historical. Release, reinstall, and live verification are separate steps.

One cohesive PR with semantic commits is expected. The driver publishes via `gh stack`, independent authored review binds the candidate, and the human merges by default.
