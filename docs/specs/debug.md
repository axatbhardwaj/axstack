# Debug skill with adviser-directed investigator fan-out

Status: Approved revision 3 (2026-09-16); both advisers AGREE.
Authoritative store: repository Markdown, following this project's existing
specification convention. This supplements docs/specs/v1.md and
docs/specs/subscription-routing.md; it does not rewrite their approvals.

## Outcome

`axstack-debug` gives the driver a gated diagnosis discipline for bugs,
failing tests, regressions, and unexplained wrong behavior. It ends with a
diagnosis record and a classified hand-off; it never lands a product change.
Hard bugs escalate through a fixed ladder: the driver alone, then
adviser-directed independent investigators, then adviser-level architecture
review with the user.

Routing distinction: `axstack-explain` answers how a system works;
`axstack-debug` applies when something is wrong and a red loop is wanted.

## Method (synthesised, original prose)

Design references, not dependencies, pinned: Matt Pocock `diagnosing-bugs`
(mattpocock/skills `3216582`), obra/superpowers `systematic-debugging`
(`c74782e`), poteto/noodle `debugging` (`25d4aeb`). Axstack prose is original.

Phases, each with an observable completion criterion. Conditional steps sit
next to the constraint that governs them.

1. **Loop.** Produce one agent-runnable command that goes red on the user's
   exact symptom, fast and deterministic. Flaky bugs: pin sample count,
   observed failures, duration, seed and environment, and the comparison
   criterion; a bare "high reproduction rate" cannot support a later green
   claim. Narrow code reading needed to find the entry point is allowed;
   forming a theory before the loop exists is not. Redact secrets before
   showing any command or output. If no loop can be built, stop and ask for an
   environment, a redacted artifact, or instrumentation permission.
2. **Reproduce and minimise.** Confirm the loop reproduces the user's failure,
   not a neighbour. Remove elements one at a time within a stated budget until
   the repro is the smallest practical; keep the original loop as well.
3. **State and recent change.** Before reading code: persistent state,
   environment drift, caches, locks, config, and `git diff`/`git log` since the
   last known-good revision.
4. **Hypothesise.** Rank the falsifiable hypotheses the evidence supports, each
   with its prediction. One strongly supported hypothesis is enough; never
   invent alternatives to reach a quota. Show the ranking to the user and
   proceed without blocking; if the user re-ranks mid-wave, finish the wave and
   re-rank before the next.
5. **Probe.** One probe per prediction, one variable at a time, every debug
   log tagged with a unique prefix. Debugger or REPL before logs where
   available; bisection where history exists. For performance regressions,
   measure a baseline first. A failed probe is not a failed fix.
6. **Root cause and seam.** Trace the bad value to its origin. Name the
   regression-test seam, or record NONE as a finding. Sweep the codebase for
   the same pattern elsewhere.
7. **Record and hand off.** Emit the diagnosis record, classify the repair,
   remove or list tagged instrumentation and throwaway harnesses, and preserve
   the loop and minimal repro for the implementer.

Anti-patterns named in the skill: bypass flags, retry loops that mask
diagnosis (bounded repeated trials for flaky reproduction are not this),
shotgun changes, guards without a why, symptom fixes, theory before loop,
"one more attempt" after the ladder says escalate.

## Fix attempts and the ladder

A **fix attempt** is one coherent repair, predicted by the diagnosis record to
turn the loop green, evaluated by the driver against the original symptom loop
and the minimised repro. A change that failed because of an implementation
slip (wrong file, bad test, setup failure) returns to the author under the
existing repair contract and does not count. A diagnostic probe never counts.
The per-bug ledger (revision, hypothesis, loop result, regression result, new
failures introduced) carries across `axstack-debug`, `axstack-implement`, and
resume; a new invocation imports known attempts instead of resetting.

| Rung | Trigger | Who | Output |
| --- | --- | --- | --- |
| L0 | entry | driver alone | phases 1–7; at most one fix attempt through `axstack-implement` |
| L1 | the L0 fix attempt failed; or phases 1–3 complete plus at least one discriminating probe (or a recorded reason no safe probe exists) and no hypothesis ranks | the preset's configured advisers, independently, same evidence packet | each returns ranked hypotheses and one investigator brief per hypothesis |
| L1 fan-out | driver merges the adviser plans | `axstack-debug-investigator-1..4`, identical packet, distinct briefs, no cross-reading | one receipt per brief |
| L2 | the L1 fix attempt failed (second failure overall); or each fix reveals a new symptom elsewhere | the configured advisers on architecture, then the user | wrong-architecture finding, bounded refactor proposal, or one bounded next diagnostic action; the user decides before any third attempt |

L1 is inadmissible without a red loop. Ordinary diagnostic consultation is
not a high-stakes decision under the standing contracts: in `mixed` both
advisers are consulted and both receipts are required; a single-provider
preset consults its one configured adviser and records the other as an
intentional absence. This rule covers ordinary diagnosis only. Whenever a
debugging run exposes a high-stakes architecture choice, serious security,
downtime, or data-loss risk, the standing high-stakes and serious-risk
contracts override it, including the existing single-provider high-stakes
hold. An adviser that is configured but unavailable at launch holds L1 and
L2 without substitution; L0 continues. (The single-provider one-adviser rule
is a new policy amendment for explicit user confirmation at approval; the
alternative is single-provider presets stopping at L0.)

**Plan merge rule.** The driver de-duplicates the advisers' hypotheses, ranks
the union with reasons, drops hypotheses both advisers refute, assigns the top
N to the N live investigators (briefs ≤ seats per wave), and records the
remainder as untested (queued). A second wave on the same roles is allowed on
changed evidence; if every probe is refuted or inconclusive, one bounded
adviser replan on the new evidence, then hold for the user. Never unbounded.

**Fan-out floor and completion.** Launch floor: at least two configured
investigators must start with verified identity, or the fan-out is held (no
substitution); a single available seat may run safe fact work but does not
satisfy L1. Completion: L1 is satisfied only when at least two usable
independent investigator receipts exist and every decisive conclusion has
sufficient evidence. Every planned hypothesis is accounted for as confirmed,
refuted, inconclusive, blocked (probe could not run), or untested; accounting
is reporting, not investigation, and two peripheral receipts do not clear a
missing decisive probe. If a seat drops mid-wave, keep completed receipts and
hold only dependent conclusions. Held briefs may be run serially by the driver
at L0 authority, recorded as driver-run; driver-run probes supplement the
evidence but never replace the two independent receipts or clear the hold.
Contradictory receipts are reconciled by evidence or one discriminating
rerun, never by vote.

**Isolation.** Each investigator gets its own disposable worktree at the
pinned revision plus the recorded dirty patch and packet artifacts,
materialised and hash-verified there; it re-runs the original loop red (for a
flaky loop, meeting the phase 1 pinned sample criterion) before probing. It may edit that worktree for probes, never commits, pushes,
publishes, or creates children. Before driver-verified cleanup, the exact
probe diff or script, command and output, and the receipt are preserved as
redacted receipt artifacts under the run directory (the driver remains the
sole `progress.md` writer); only then is the worktree discarded. The loop must be
hermetic (worktree-local). A worktree isolates files, not shared or live
systems: if the loop touches shared state (database, port, cache, lock),
parameterise per investigator, or serialise the wave against an explicitly
authorised resource with recorded reset and restore steps between probes; if
neither is possible, hold that probe. The bundle's mode convention stays;
requested and effective settings are recorded separately, and an unsupported
requested mode holds.

## Evidence packet

One snapshot file under the run record, hashed, referenced by path from every
brief. Fields: user symptom verbatim (redacted); base and candidate SHA plus
dirty-patch or artifact hashes; cwd, runtime, dependency and config
prerequisites; redacted fixture, setup and reset steps; the loop command, its
exact assertion and original output; minimised repro; state and recent-change
findings; every prior attempt with diff summary, hypothesis, and why it was
judged failed; hypotheses already refuted; allowed reads, commands, scratch
location and excluded systems; probe budget. Each brief adds: hypothesis ID,
prediction, discriminating probe, falsification criterion, and stop criterion
("confirmed means", "inconclusive means"). Investigators may report one
credible alternative hypothesis without cross-reading.

## Diagnosis record

```text
Bug: <user symptom, verbatim, redacted>
Revision: <candidate SHA> base <SHA> dirty <patch hash | clean>
Loop: <one command> -> <red output excerpt>  Hermetic: <yes | shared: ...>
Minimised repro: <what remains load-bearing>
State/recent change: <findings or none>
Hypotheses: <ranked; each confirmed/refuted/inconclusive/blocked/untested + evidence>
Root cause: <origin of the bad value> | UNKNOWN + what was tried
Seam: <regression test location> | NONE (finding)
Pattern sweep: <other sites or none>
Rung reached: <L0 | L1 | L2>  Fixes tried: <n: change, why judged failed>
Adviser receipts: <ids or n/a>  Investigator receipts: <ids or n/a>
Cleanup: <tagged prefixes removed | listed for implementer>
Repair class: <bounded -> small-change intent | substantial -> spec route | unresolved -> investigation continues>
Lesson: <one line or none>
```

## Hand-off

A confirmed bounded repair supplies the existing small-change intent to
`axstack-implement`; a substantial repair takes the normal approved-spec and
ticket route; an unresolved diagnosis stays investigation. NONE seam is an
explicit TDD gap that needs a scoped decision, not permission to fix without a
meaningful red. The implementer verifies against both the original loop and
the minimised repro. Returning to a phase transfers no PR ownership and grants
no new mutation authority.

## Roles

Four slot IDs in every preset, ordered; provider/model/effort explicit per
preset and captured in the run's routing snapshot. Names denote the explicit
model IDs the bundle already uses. No adviser model fills an investigator
seat. Where a preset has fewer model families, a model repeats — independence
comes from brief isolation and no cross-reading, not from model diversity or
effort — and the role notes say so. Sonnet seats run at xhigh (user
direction 2026-09-16). No null rows, so
`isIntentionalAbsence` in `src/roles.js` is unchanged.

| Role | Mixed | Codex-only | Claude-only |
| --- | --- | --- | --- |
| `axstack-debug-investigator-1` | Opus medium | Sol medium | Opus medium |
| `axstack-debug-investigator-2` | Sol medium | Terra low | Sonnet xhigh |
| `axstack-debug-investigator-3` | Sonnet xhigh | Sol high | Opus high |
| `axstack-debug-investigator-4` | Terra low | Terra xhigh | Sonnet xhigh |

## Contracts and files touched

- `profiles/presets/{mixed,codex-only,claude-only}.json`: four rows, 17 → 21.
- `src/roles.js`: no readiness change; negative test that a null on a
  non-intentional row still fails.
- `skills/axstack-debug/SKILL.md` (new) with `references/packet.md` for the
  packet, brief, and record shapes.
- `skills/axstack/references/routing.md`: direct route "bug, failing test,
  regression, or wrong behavior with a red loop wanted -> `axstack-debug`";
  the explain/debug distinction; new IDs. Stays under the 7500-character cap
  enforced by `tests/workflows/owned-core.test.js` (8 characters of headroom
  today), so existing prose is condensed without semantic change and existing
  routing tests stay green; `review-modes.test.js:117` regex-matches the
  "all 17 role IDs" wording, which moves to 21 in the same PR.
- `skills/axstack/references/contracts.md`: debug consultation rule
  (ordinary diagnosis uses the configured advisers; the high-stakes and
  serious-risk contracts override it; a configured-but-unavailable adviser
  holds L1/L2; receipts reused while the packet is unchanged).
- `skills/axstack/references/orca-runtime.md`: "all 17 role rows" → 21.
- `skills/axstack-implement/SKILL.md`: accepts a diagnosis record with repair
  class `bounded` as the small-change intent source; implementation slips do
  not increment the fix ledger.
- `skills/axstack-audit/SKILL.md` and `references/record.md`: `Debug:` line
  (rung, loop command, attempts, adviser and investigator receipts, isolation).
- `docs/workflows.md`, `docs/installation.md` (two counts), `README.md`
  (count and skill list).
- Tests: `improve`, `orca-runtime`, `owned-support`, `owned-core`, `presets`,
  `review-modes` role counts; new `debug.test.js` structural assertions; new
  `debug-scenarios.json`.

## Acceptance evidence

- Structural: `axstack-debug/SKILL.md` is discoverable (`When ..., use
  axstack-debug`); names the seven phases, the loop completion criterion, the
  redaction rule, the fix-attempt definition, the three rungs and their
  triggers, the plan merge rule, the two-seat floor and briefs ≤ seats, the
  disposable-worktree isolation rule, the hermetic-loop requirement, every
  packet field, every diagnosis-record field, and the repair classes; states
  it never lands a product change.
- Presets: all three carry the four slot IDs in the same order; mixed rows are
  exactly Opus medium / Sol medium / Sonnet xhigh / Terra low; codex-only and
  claude-only rows match the table; readiness passes for every preset; no
  investigator row is null; scenario corpora agree with 21.
- `axstack-implement` names the diagnosis record as an accepted small-change
  intent source and excludes implementation slips from the ledger.
- Scenario corpus `tests/workflows/debug-scenarios.json`, each case with
  input, expected decision, and forbidden actions: easy bug resolved at L0
  with no adviser cost; loop unbuildable; probe failure vs fix failure;
  implementation slip vs diagnosis failure; first fix failed → adviser plans →
  merged briefs; advisers disagree on ranking; five hypotheses, four seats;
  0, 1, and 2 available investigators; decisive probe blocked; contradictory
  receipts; loop touches shared state; single-provider preset at L1; denied
  instrumentation permission; dirty revision on resume; second failure → L2;
  UNKNOWN root cause; NONE seam; flaky false-green.
- Behavioral evaluation receipts for the scenario corpus: a failing-first
  run against the pre-change skill set and a post-change run, each pinning
  the tested skill revision, input, expected decision, actual response,
  evaluator identity, and limitations. If a meaningful behavioral evaluation
  cannot run, that distinct gap is recorded and the existing scoped TDD
  decision is obtained before dependent implementation.
- `bun test` green on the exact integrated candidate before merge; a fixture
  install and check of the extracted package verifies the new skill files and
  the 21-row role snapshot per preset, not only the count.
- Live effective mode/model behavior is a separate gap not proven by these
  checks and is recorded as such.

## Exclusions

- No runtime, daemon, scheduler, or programmatic gate; the ladder is prompt
  contract.
- No change to author/reviewer routing, adviser models, owner, checker,
  watch, or audit models.
- `axstack-debug` never commits, pushes, or publishes a product change;
  temporary instrumentation is removed or listed before hand-off.
- No bisection or instrumentation tooling shipped; the skill names techniques.
- No automatic memory or skill edits from the lesson line.

## Preparation evidence

Sources pinned above; run packet hashes recorded in the run record. User
decisions 2026-09-15: ladder L0 → adviser-directed fan-out → L2 (Q1a
amended), four dedicated roles (Q2a), diagnose-and-hand-off (Q3a). Adviser
round 1 (2026-09-16): Astra DISAGREE (7 points), Fable DISAGREE (9 points);
both endorse slot IDs; rev 2 adopted their overlapping points, resolved
read-only-by-mode versus isolation-by-worktree in favour of isolation, filled
all four seats instead of null rows, and deferred the single-provider adviser
rule to user confirmation. Round 2: Fable AGREE (4 non-blocking notes), Astra
DISAGREE (4 blockers: high-stakes override, durable worktree evidence, L1
completion receipts, behavioral evaluation receipts); rev 3 adopts all eight.
Round 3: Astra AGREE, Fable AGREE (three non-blocking wording notes folded in).
