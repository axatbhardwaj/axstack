# Merge escalation execution map

Spec: `docs/specs/merge-escalation.md` Approved rev 5 (content SHA-256
d9bf2750c868173d6d8cc2c6ed3dec3075c66979ad9ebb0eef507fa39a294c4a).
Store: repo Markdown. Writers: `axstack-author` (codex, sol class, high), one
writer per task. M1 and M2 form one `gh stack` in order. The user approved
D1, D3, D4 as written and the post-release update of the global
Notifications text.

Implementation clarifications (non-blocking adviser notes on rev 5):
- A `comment:` clock starts only once the reviewer rates the item `above low`;
  an unrated or `uncertain` item waits on the reviewer, not on a person.
- Notifications for peer PRs are unchanged.
- The run's Notification policy records the blocked ping and D9.

Capability: M1. Review receipts carry the evidence that proves verification
Internal task: M1 -> axstack-author -> worktree `merge-m1` (base main)
Theme: `skills/axstack-review/SKILL.md` authored receipt template and brief
Size est: small-medium (template, brief, prose-contract tests)
Acceptance: spec 8; the comment-rating parts of 7; 10 and 11 for the review surface
Depends: none

Capability: M2. Watch merges own PRs unless blocked, risky or unproven
Internal task: M2 -> axstack-author -> worktree `merge-m2` (stacked on M1)
Theme: `skills/axstack-watch/SKILL.md` §4-§5, `skills/axstack-relay/SKILL.md`, `docs/workflows.md`, merge-rule tests
Size est: medium (rule replacement, mirrored docs, retargeted tests)
Acceptance: spec 1-7, 9, 10, 11
Depends: M1

Internal task: G1 -> driver -> no PR
Theme: after release, update the Notifications text in the user's global instruction files on io, iobook, iobox and vps, with receipts
Acceptance: each host's files name the blocked ping, the verification decision hold and D9
Depends: M2 merged and released
