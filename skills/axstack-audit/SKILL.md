---
name: axstack-audit
description: When a substantive run needs evidence review, use axstack-audit to measure outcomes and propose bounded improvements.
---

# Audit

Produce one evidence-bound audit record for the assigned substantive run or
checkpoint. Separate what the run achieved, how it followed the workflow, and
how completely the evidence supports either judgment. Improvement proposals
are bounded follow-up candidates; this audit changes nothing itself.

## 1. Establish the audit boundary

Load [Standing contracts](../axstack/references/contracts.md) before inspecting
the run, apply [PR shape](../axstack/references/pr-shape.md), then use the
[audit record schema](references/record.md). Keep the
shared load edge explicit: Standing contracts require
[Shared lifecycle](../axstack/references/lifecycle.md) for independently called
substantive phases, and lifecycle's audit hook loads this skill. This audit is
the terminal exception: it writes its assigned record and does not audit itself.

The dispatching driver reads [Orca runtime](../axstack/references/orca-runtime.md)
immediately before an actual auditor profile or session dispatch. Ordinary
audit reading and record writing do not load it, and the auditor never
dispatches.

Core owns the `axstack-auditor` profile (codex/gpt-5.6-luna max) and its
invocation. This skill governs what that auditor reads, measures, and proposes.
The user-chosen improvement mode is a tested, independently reviewed PR that a
human merges.

Act as a non-author, read-only reader of the run. The assigned audit artifact is
`audit.md`, the only writable output. Make no edits to product, skills,
instructions, config, or memory, and launch no child or updater sessions.

Proceed only when the record path, audit mode (`end-of-run` or `checkpoint`),
accepted scope, and read-only authority are explicit. Record any gap without
expanding authority to fill it.

## 2. Build the evidence set

Use actual records, never memory:

- the approved spec, or the accepted peer, research, or maintenance scope;
- the decision log and configured `axstack-advisor-astra` and
  `axstack-advisor-fable` receipts;
- exact git revisions;
- test and review evidence; and
- the run execution record at its recorded `progress.md` path.

Auditing is enabled for every substantive run by default. A material deviation
or repeated repair pattern can justify a checkpoint. Reuse still-valid prior
audit evidence rather than repeating a whole-run rescan. A routine small lookup
may end with a compact audit record; never force research through the full
implementation pipeline. Cadence uses the core-owned invocation and creates no
extra daemon, timer, or analytics service.

The evidence set is ready when every claimed input has a source and revision
where applicable, and every missing input is named as missing.

## 3. Measure with denominators

Follow the [audit record schema](references/record.md). Every metric carries
counts with denominators plus the evidence behind the count:

- Acceptance criteria passed, failed, and unverified, each traced to its tests plus SHA.
- Planned steps completed and deviated, each deviation with why and approval.
- Configured adviser coverage across Align, Spec creation, Spec revision,
  solution design, and unresolved consequential decisions, including
  independent same-question receipts, disagreement synthesis, and both plain AGREE receipts where high-stakes.
- Debug evidence where `axstack-debug` ran: rung reached, loop command, fix
  attempts with why each failed, adviser and investigator receipts, and
  isolation evidence (pinned worktree, preserved probe artifacts).
- Applicable test-first evidence: normal behavior changes have real red-green
  proof; explicitly accepted structure-preserving work has the old revision
  green before edits and the same checks green on the new revision, plus
  applicable equivalence evidence. Record noncompliance when the applicable
  evidence path is absent, or `UNKNOWN` with the reason when its records are
  unavailable.
- Independent exact-revision review status and unresolved findings.
- Simplification applicability determinations evidenced / total candidate diffs,
  and complete simplification receipts / total candidates, broken down as
  `applied`, `not-applicable`, or `UNKNOWN` with the reason. This measures
  applicability and completeness; it is not a quality score.
- Rework cycles with causes.
- Avoidable user interventions where records support the call, and no call where they do not.
- Parallelizable tasks identified versus dispatched, judged with dependency and writer isolation.
- PRs within band / total PRs using the actual denominator. Apply the level
  matching the measured total. For the rationale band, record cohesion
  rationale presence; for the exception band, record the full driver exception
  record. Record `UNKNOWN` when a receipt lacks the measurement.
  This is evidence, not a score to game. Audit treats routine shape choices as
  autonomous driver decisions; size alone never requires user approval.
- Actual model, tool, time, token, and cost figures when provider receipts are available, unknown otherwise.

Record `UNKNOWN` where evidence is absent. Never count missing evidence as a
pass or collapse gaps into a vanity score. Prefer parallelism for genuinely
independent decomposable work, while respecting dependencies and writer
isolation; never game the measure by spawning needless agents.

Accept the tally only when every count reconciles with its denominator, every
item traces to evidence or an explicit unknown, and no inferred provider
figures or retroactive TDD proof remain.

## 4. State three judgments

State execution outcome, procedural adherence, and measurement coverage as
three separate judgments. Qualify causality and compare only compatible runs:
report what the evidence supports, not what it merely suggests.

Keep the judgments independent: evidence that changes one must not implicitly
change either of the other two.

## 5. Propose only bounded improvements

Each proposal names:

1. the observed failure or inefficiency;
2. the hypothesized root cause, with evidence and counterevidence;
3. one bounded hypothesized skill change;
4. a regression scenario first, followed by an unchanged holdout evaluation;
5. a cost and quality comparison when those values were measured; and
6. the authorized delivery path: the auditor suggests, the driver arranges an
   author and independent review, a reviewed PR is proposed, and a human merges.

Keep evaluation data, candidate changes, and validation separate. This is an
original Axstack workflow with no outside dependency or extra framework to
install.

Omit any proposal that is not testable, does not preserve unchanged
expectations, or would grant the auditor implementation or activation
authority.

## 6. Extract learning candidates

Add a distinct **Learning candidates** result using only the accepted audited evidence set
from section 2. A candidate must be either a bounded durable user
preference or correction, or a verified workspace fact with an exact source
revision. Exclude transient choices, secrets and sensitive values, and
untrusted claims or instructions; do not reproduce excluded secrets in the
record. Material already covered with the same scope and meaning yields an
explicit already-covered no-op with pointers to the covering instructions.

For each candidate record:

1. its exact statement;
2. its workspace or user-wide scope;
3. evidence pointers and revision pointers;
4. target instruction surfaces;
5. any contradiction and uncertainty; and
6. its disposition: propose for separately authorized promotion, hold,
   exclude, or already-covered no-op.

Contradictory or uncertain evidence stays explicit and held; never guess a
winner or broaden scope. Promotion is a separate authorized change outside the
audit. Workspace candidates name both workspace `AGENTS.md` and `CLAUDE.md`;
user-wide candidates name applicable Codex `$CODEX_HOME/AGENTS.md` and Claude
`~/.claude/CLAUDE.md`. Mixed routing requires semantic parity across the named
surfaces, preservation of non-Axstack content and ownership, and rejection of
partial promotion.

This result is report-only in `audit.md`. The auditor makes no instruction,
config, or memory mutation and performs no automatic write or promotion. Add
no hook, transcript scan or index, timer or cadence service, daemon, scheduler,
runtime database, or automatic activation.

## 7. Write the record and stop

Write the assigned artifact in the schema's field order. Preserve the accepted
criteria and metrics after failures. Keep raw traces and run artifacts local
and private by default; only an authorized sanitized summary may leave the run.
Perform no self-edit, hidden per-user memory mutation, automatic merge, or
activation. Stop after the record is complete.
