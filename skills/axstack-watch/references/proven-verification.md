### Proven verification

Proven verification is required for every own PR. Use the authored receipt:

- Verification requires `Verdict: APPROVE`, `Coverage: COMPLETE`, and
  `Escalate to user: no`.
- Verification requires a `Safety fact` about the change that is not `unproven`.
- Verification requires diligence `PASS` at the exact head and base.
- Verification requires `Final-head check: <command> -> <log path>` for a check
  the reviewer ran at the final head, with its log kept in the run's evidence folder.
- Each acceptance check requires passing evidence from the ticket or spec
  criteria, or the PR body for adopted and ticketless PRs.
  Earlier-head red-to-green evidence in the PR's patch lineage counts only when
  the reviewer records that it still applies to the final change.
  An applicable `verify-<app>` passing result is required for the changed behavior.
  The passing result must come from the reviewer's or `axstack-ui-verifier`'s local drive at that head.
  The author's log alone never satisfies this requirement.
  A preview URL never satisfies this requirement.
- Verification requires no limitation tagged `changed-behavior: unproven`.
  The reviewer tags every limitation leaving changed behavior unexercised or
  unverified, in whatever words, `changed-behavior: unproven`.
  Other limitations do not hold.
- When the PR removes or weakens a check, test-runner setting or ruleset that
  gates its own merge, verification requires the reviewer ran the base's checks
  against the head.

The driver first closes a verification gap itself: run the check, re-dispatch
review, or return the work to the author. Only a gap the driver cannot close
becomes a `verification not proven` card bound to head and base.
The card names what is unproven, why, and the action that would settle it.

Raise `verification not proven` in the T3 driver thread and end the turn parked
on the decision, bound to the exact PR head and base.
A changed PR head or base must supersede its open verification decision card,
reissuing only if a decision is still needed.

The user's reply in the driver thread or on the forge clears only that
verification cause. Record `user-accepted unproven: <item>`, never as a pass.
Treat the accepted item as settled for this head and base and merge when every
other gate and hold permits it. A reply never waives `APPROVE`, diligence `PASS`
or green CI. A new head or base voids the acceptance.
Settle an `Escalate to user` for the user-accepted verification cause at its
accepted head and base while other escalation holds still apply.
In a work repository a reply never replaces counted collaborator approval.

