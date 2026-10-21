## Review the candidate

This section applies to peer and authored PR modes.

1. **Pin the brief.** For an implementation candidate, verify remote confirmation
   of the candidate SHA before reviewer dispatch under the
   [candidate-publication boundary](../../axstack/references/candidate-publication.md).
   For manual adopted-PR maintenance under
   [Repair and publication](../../axstack-watch/references/repair-publication.md),
   confirm the exact local candidate SHA with `git rev-parse` in the owned
   worktree, pin the remote pre-repair head and current base, and review code and
   reply bodies before publication. Record the PR URL, exact candidate SHA,
   current base, applicable intent or spec/ticket identity and acceptance,
   exclusions, authority, and all six angles. In authored mode, record the
   author's actual provider and model from the T3 launch receipt in the
   dispatch brief; a `Claude-Session` trailer is attribution, not provenance.
2. **Materialize the mode-required review.** Immediately before dispatch, read
   [T3 runtime](../../axstack/references/t3-runtime.md), then apply exactly one
   branch below. For every reviewer, apply
   [Reviewer workspaces and evidence](../../axstack/references/t3-runtime.md#role-dispatch-by-permitted-writes)
   before async `delegate_task`; report-only scope does not waive checkout isolation or
   private per-dispatch artifacts. Each reviewer uses a separate driver-made disposable detached checkout;
   preserve its private evidence before removal.
   - **Peer:** mixed first peer review requires three receipts from
     `axstack-reviewer-primary` (Sol high), `axstack-reviewer-peer` (Opus medium),
     and `axstack-reviewer-muse`, or two with verified Muse absence, at the exact SHA
     and base after an isolated first pass. Send each the identical six-angle brief
     with no cross-read or children. The Sol/Opus pair stays cross-provider and
     independently isolated. In mixed first peer review, the Sol high and Opus
     medium cross-provider pair and Muse get independence from separate sessions,
     the identical brief, and an isolated first pass.
     Single-provider first review keeps exactly two
     configured reviewers and never dispatches Muse.
     Use [Role roster](../../axstack/references/role-roster.md#role-roster) for
     verified Muse absence; a launched Muse seat remains outstanding.
     Peer follow-up requires exactly one `axstack-reviewer-primary` receipt on
     the bounded brief in [Peer mode](../SKILL.md#peer-mode-colleague-pr).
   - **Authored:** dispatch exactly the mode-required eligible independent reviewers from this complete
     mapping:

     | Preset | Actual author provider/class | Reviewer role (configured class/effort) |
     | --- | --- | --- |
     | `mixed` | `codex/sol` | `axstack-reviewer-secondary` (`claude/opus` high) |
     | `mixed` | `claude/opus` | `axstack-reviewer-primary` (`codex/sol` high) |
     | `codex-only` | `codex/sol` | `axstack-reviewer-secondary` (`codex/luna` xhigh) |
     | `claude-only` | `claude/opus` | `axstack-reviewer-secondary` (`claude/sonnet` high) |

     Mixed Sol-authored review requires two receipts from `axstack-reviewer-secondary`
     and `axstack-reviewer-muse`, or one with verified Muse absence.
     Either seat's validated medium/high finding blocks approval; record one
     `repairs` increment per round regardless of seat count.
     Mixed Opus-authored review keeps one `axstack-reviewer-primary` receipt
     and no Muse seat. Single-provider presets keep one authored reviewer;
     Muse seats are never dispatched.
     The diligence receipt is separate and does not count as a reviewer receipt.

     From the recorded exact model ID, derive its class and match provenance
     on provider/class; record effort, but never use effort to create a mapping.
     An ID with no class is `INCOMPLETE`. Any other author provenance for the
     selected preset is unsupported and `INCOMPLETE`, including its secondary
     reviewer model, Astra, Luna, or Fable. Report the exact provenance gap and
     ask the user. Never derive a reverse pairing from slot position.
     Each required reviewer covers the complete brief alone. No author or owner
     session may review, even if its role or provider label changes.

   Mixed authored review is cross-provider. Single-provider review uses different
   models, not cross-provider independence. The claude-only Sonnet explanation
   exception is session independence only: separate `axstack-explainer` and
   `axstack-explainer-review` at high. It never permits same-model code review.

   For the existing high-stakes Opus high author / Sol high checkpoint route,
   an eligible current non-author, non-owner checkpoint can satisfy the authored
   final review after revalidation against the pinned brief. Preserve Sol high
   effort and spawn no redundant final reviewer. If a required reviewer is
   unavailable, report that exact model gap, mark review `INCOMPLETE`, and ask
   the user; do not lower effort or choose any automatic fallback.
   Rejection, timeout, quota and auth failures hold affected work without substitution.

   Continue only when session receipts prove the required models, non-author
   independence, actual author provenance where applicable, and exact brief.
   In authored PR review rounds, dispatch `axstack-diligence`
   independently alongside the configured reviewer(s) on the same exact revision
   and base. Follow [Diligence](../../axstack/references/diligence.md). A diligence
   `FINDINGS` receipt returns validated findings to the same author in the same
   round; it is not an extra `REQUEST_CHANGES` round.
3. **Inspect all six angles.** In the first peer review each reviewer covers every angle;
   in authored mode each required reviewer covers all six angles. Peer follow-ups use
   only the bounded checks in Peer mode instead of this full inspection:
   1. Security and trust boundaries.
   2. Correctness, failures, and edge cases.
   3. Integration and regressions: load [Blast radius](../../axstack/references/blast-radius.md),
      find what the change breaks beyond the diff, and grade the one fact it
      is safe because of on the evidence ladder; below "ran it" is unproven.
   4. Requirements, acceptance, and user behavior.
   5. Architecture and solution design, including SOLID and credible simpler
      alternatives. Only when the scope identity carries a sketch, compare
      the architecture with the [design lens](../../axstack/references/design-lens.md)
      sketch and red flags. A deviation from a `Binding` line without an
      accepted spec revision is a finding.
   6. Simplicity and maintainability: KISS, YAGNI, and cyclomatic complexity
      where measurement is useful. Never invent a metric or demand an
      abstraction merely to satisfy a principle.

   Before claiming a test is missing from CI inspect the complete file and actual CI step result.
   Under the existing angles, check added, changed, and removed test hunks
   against [Test value](../../axstack/references/test-value.md). For removed tests,
   inspect the named keepers. Removing a test without a named keeper or
   vacuity/obsolescence evidence is a finding. Peer mode remains report-only.

   The authored reviewer checks the `Revert` line against the diff.
   Follow [Revert line](../../axstack/references/candidate-publication.md#revert-line)
   for its format and classification.
   Record the `Revert` line in the review receipt.
   Rate a wrong or missing `Revert` line at least `medium` under [Finding severity](../SKILL.md#finding-severity).

   In authored mode under angle 6, verify the recorded shape against the pinned head and base.
   A mismatch between the recorded and measured total is a finding.
   Verify full totals and bulk buckets with their reproducible command.
   Treat size flags as informational only.
   Size alone must never block review, reject a PR, require split attempts or
   cohesion/exception rationale, or hold approval.
   Review the actual footprint, complexity, and required context, incrementally when needed.
   Approval requires sufficient review coverage.
   Report INCOMPLETE when required coverage is missing.
   Routine shape decisions remain autonomous driver decisions; size alone
   never requires user approval. Escalate only when that work exposes an
   existing material-scope, security, downtime,
   data-loss, major-design-risk, or unavailable-model hold.

   In authored mode also under angle 6, independently classify the pinned diff. When it contains
   code or agent-instruction changes, load
   [Simplify the diff](../../axstack/references/simplify-diff.md) and independently
   verify both the simplification receipt and the relevant diff; for excluded
   prose, verify the receipt's `not-applicable` evidence without loading the
   reference. A simplification finding names the concrete location, consequence,
   and simpler behavior-preserving alternative. Preserve trust boundaries,
   accessibility, meaningful why-comments, uncertainty, and authority; do not
   turn this judgment into a deletion quota or score.

   In authored mode, verify the applicable spec, ticket, or intent acceptance, executable
   evidence, exact candidate SHA, current base, and affected integration
   boundary, plus rendered interaction evidence for relevant UI work through
   [UI verification](../../axstack/references/ui-verification.md). A
   passing test is insufficient when it checks the wrong behavior. Call out
   seeded regressions, inadequate checks, and every unverified boundary. Every
   mode-required receipt records concrete evidence and consequences, coverage,
   limitations, and findings without a finding quota.

   If a `verify-<app>` skill covers affected behavior, the authored reviewer runs its base-revision Launch and Doctor against the pinned final head in its detached checkout.
   For an `axstack-verify create` PR, the reviewer drives the candidate's recipe because the base has none.
   The author never performs this review drive.
   The reviewer drives each affected feature and records that drive as the `Final-head check`.
   Delegate browser drives to `axstack-ui-verifier` with the feature file path.
   Running the applicable surface counts as spin-up; a CLI run qualifies.
   Use loopback and isolated instances under [axstack-verify](../../axstack-verify/SKILL.md#isolate-every-attempt).

   In authored mode, and for peer blockers in the first review or the
   single-reviewer full-diff fallback, name each finding's defect class and list every
   instance of that class in the pinned diff and dependent surfaces: callers, sibling docs,
   README, and tests. A later instance of an already-named class is a coverage
   miss; record it as such rather than treating it as a new kind of defect.
   Never apply the defect-class sweep to ordinary peer notes after disposition validation.

   In authored mode, for an accepted scope explicitly marked structure-preserving, verify its
   preserved contract, listed files, old-revision green characterization, and
   the same checks green on the new revision, plus applicable artifact or
   equivalence evidence. Do not demand a fabricated red. Bugs or new behavior
   require separately accepted scope and the normal strict red-green path.

   Example: `Ticket criterion: an expired invite returns 410. Observed: the
   handler returns 200 and creates a session. Consequence: expired links remain
   usable.`
4. **Reconcile findings without voting.** The owner verifies findings and uses
   focused checks to resolve contradictions. Unresolved material disagreement
   leaves peer review incomplete; reviewer votes never settle correctness.
   Accepted fixes return to the actual author. Account for each finding as
   validated, rejected with evidence, fixed, or explicitly unresolved.
5. **Bind the current revision and base.** Peer follow-ups apply Peer mode,
   including author replies and closed-point finality. The following refresh
   rules apply to authored mode. Any authoring change makes prior
   receipts stale. Refresh each mode-required receipt for the new exact SHA and
   current base. Reuse unchanged evidence and inspect the delta plus affected
   behavior when sufficient; broaden review after a larger scope, base, or
   behavior change. A checkpoint receipt is reusable only after revalidation
   proves its reviewer remains eligible and its scope, evidence, all six angles,
   and acceptance cover the current brief. Otherwise obtain a new eligible
   receipt, without adding reviewers beyond the selected mode.

