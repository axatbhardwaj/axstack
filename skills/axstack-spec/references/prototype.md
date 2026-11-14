# Spec 3a: prototype a deferred question

Use only for `Open (prototype):` questions under
[Align's delivery gate](../../axstack-align/SKILL.md#bound-the-interview),
before the first draft adviser round. This is a bounded step, not a new phase
or standalone skill. Brainstorm stays report-only: when its question overlaps,
run Brainstorm first, then test the chosen candidate with the user.

Before dispatch, write one sentence naming the question. Put it at the top of
the prototype. One prototype answers one question. Choose the smallest
presentation that answers it; if kind is unclear, match the surrounding code
(page/component: UI; module: logic) and state the assumption at the top.

## Kinds and shared constraints

- **UI:** include about three variants (at most five), differing in structure
  rather than colour, in the real page. UI variants require a switcher, such
  as `?variant=` or a floating bar.
- Run the documented start command first. If the start command fails, use
  tier 2 in the same dispatch. Also use tier 2 when the user must interact and
  cannot reach the app: one self-contained HTML mock with a variant switcher,
  shown inline with fidelity limits at the top. Never re-route the run.
  If neither real page nor mock answers the question, take tier 3: no verdict.
- **Logic:** show one self-contained HTML file inline under
  [Inline pages](../../axstack-explain/references/inline-pages.md), using its
  prototype-page rules. Include visible state, controls and useful examples.
  Keep logic in a small pure module without DOM code, in its own script block.
- Label it "prototype" and place it next to the code it informs. Start it
  with one command or double-click. Keep state in memory; for a persistence
  question only, use a local scratch file/database named `PROTOTYPE-wipe-me`.
  Inline copies never use storage. Add no automated test suite or speculative
  reusable framework; runnable and interaction checks below still apply.
- Keep variants read-only and stub every mutation. Use only repository-
  documented dev or test data sources, never production secrets. Prototype
  status grants no production data, credential, transaction or infrastructure
  authority.

## Authority and build

The pre-baseline exception applies only in delivery runs: one author per
question, only named files from the brief and one create-only push of a
never-merged ref. Bind the dispatch to the deferred question and current draft
revision in place of an approved identity. The driver records this exception
on the run record's `Authority:` line.

```text
Authority: Spec 3a prototype | question: <deferred item> | draft: <revision> | author: <attempt> | files: <exclusive paths> | one create-only never-merged ref push
```

The driver dispatches `axstack-author` via `delegate_task` with
`isolation:"worktree"`, on its encoded branch from a pinned base SHA. The author
commits with `[skip ci]`. Only the driver pushes the author SHA. The author
never pushes. Record sends and rounds per question, including the caps below
in the brief.

Only prototype authors skip red/green logs. For completion require terminal
checks, non-empty diff, clean tree and run evidence of the start command and
observed output. This exemption changes no other author completion rule.

## Show and review

For static look, dispatch `axstack-ui-verifier` on a detached checkout of the
prototype SHA: capture one screenshot per variant at both 390x844 and
1440x900 and show them inline. For observed behaviour, add a short GIF.
For interaction, use a reachable real app directly; otherwise show the tier 2
mock or logic page inline under the linked prototype-page rules. Those rules
retain their checks and exactly their four exemptions; repair other failures
within these caps. A check still failing at a cap holds the inline page after
the cap question below; take a no-verdict exit.

Present each decision, including the cap question, as one Qn under Align's
focused-round rule with a driver recommendation, reason and trade-off.
Prototype review is not an advised hold. Keep `Autopilot: on`, record the wait
in `Next:`, and use `paused` only when no other authorized work can advance.

Per question allow one author, at most 3 review rounds and at most 3
build-or-revise sends, each with at most one verification repair. Per spec
allow at most 2 prototyped questions. Stop before spending the last Qn of 20
or the justified 35. At any cap ask once, as a Qn if budget remains: extend by
one bounded round, settle by discussion or drop. Record the user's choice
and the bounded extension before advancing.

Tier 3, abandonment, drop, a spent budget or a held inline page take a
no-verdict exit to discussion as an ordinary Qn. With the budget spent put the
question under "Decisions needed from the user" so spec approval settles it.
A no-verdict question never appears settled. Abandoned prototypes are not pushed.

Later deferred questions found in drafting or adviser review re-enter 3a within
the same caps. A verdict changing draft meaning refreshes adviser and diligence
receipts under Spec's existing rules. A verdict never approves the spec.
After approval, questions follow Material revisions.

## Capture

Normalise the slug as for encoded branch segments. Before the push scan the
diff for secrets and personal data. A failed scan holds the push.
At the verdict, the driver pushes once, create-only:

```bash
git push --force-with-lease=refs/heads/prototype-axstack-<slug>: origin <sha>:refs/heads/prototype-axstack-<slug>
```

Create an absent ref; never change an existing ref. If rejection says the ref
exists, use the next suffix (`-2`, `-3`). An identical existing tip reporting
up to date is also insufficient: use the next suffix. Require `[new branch]`
in the output to prove creation, rather than the exit code. Then read the
remote ref back and confirm it equals the author head. A protected or
ambiguous result holds capture only; record `Prototype: capture held (<reason>)`
and inspect remote state before any retry. Never open a PR or merge.

Only the never-merged prototype ref push skips candidate-publication diligence,
review and PR rules. This is not candidate publication; the exception exists
only because the ref never merges. Never base a candidate on the prototype SHA.

Record: per question, in the spec's `Design` or Evidence and history if there
is no sketch, write the [prototype record line](format.md#evidence-and-history):
branch (never-merge), pinned GitHub `tree/<sha>` URL, entry point, question and
verdict with its Qn. Each verdict's `Decisions` row cites its Qn; the rows bind,
the prototype illustrates.

The author worktree is removable when remote readback matches the author head,
or when the prototype is abandoned and its tree is clean. Keep the local
branch. Apply existing terminal, ownership and evidence guards in
[Workspace hygiene](../../axstack/references/workspace-hygiene.md); this step
grants no prototype-branch cleanup authority.
