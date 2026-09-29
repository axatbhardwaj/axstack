# Shared routing (every owned phase loads this)

Choose a route; load only the phase and references needed next.
Driver entry sweep follows [Workspace hygiene](workspace-hygiene.md).

## Role routing

Presets: `mixed`, `codex-only`, `claude-only`. For new runs, use
`profiles.preset` from `.axstack-manifest.json` at the actually loaded
skills root, or an explicit user selection in the run record. Missing or contradictory sources are
a setup gap: hold. Never infer from live profiles or `list_profiles`, harness,
tools, credentials, quota, subscription, or default to `mixed`.

At start, snapshot all 32 role IDs with provider/modelClass/model/mode/effort; absent
or unconfigured roles are recorded explicitly; never default.
Such a role holds only its work. Later installed or changed roles need an
explicit user decision to enter the snapshot. Live profiles
are authoritative at snapshot time and for availability; bundled presets are setup
inputs, not runtime proof.
For each role record class, resolved exact ID, source (catalog, transcript, or
pin), and time. Codex classes resolve through
`skills/axstack/scripts/resolve-models.js` with an explicit catalog
path; missing or malformed catalog holds. Claude classes start as `alias,
unresolved` until transcript read-back. Resume must reuse the snapshot and
never re-resolve it.

Preset changes apply to new runs only; an active run keeps its snapshot.
Changing it or replacing a session needs an explicit user decision and
revalidation. Unavailable models, efforts, roles, or overrides hold only affected
work; no automatic fallback, quota routing, subscription inference, or silent
provider/model/effort substitution. Only
explicit model rejection before the first turn permits Codex `--retry-of` with
the next eligible ID in the same class, provider, and effort. Fence the failed
Dispatch and record tried ID, error, and fallback ID in the snapshot and reply.
Timeout, quota, auth, and other failures hold; Claude rejection holds.

Load the [Role roster](role-roster.md) for configured roles and authored-review pairings.

Provenance is matched on provider/model class derived from the recorded exact ID;
effort never maps. Missing table-row
provenance is unsupported and `INCOMPLETE`; report it and ask the user. Never
infer from slot, driver, owner, or provider. Author and owner never review.

`axstack-implement` requires `mixed`; single-provider presets hold at
step (3) for user routing: no substitution or same-provider review.

## Direct routes (no spec ceremony)

- Bounded research -> `axstack-research`: verify primary sources and code,
  cite limits, and fan out distinct questions.
- Understand a system or gap -> `axstack-explain`:
  current/intended behavior and bounded gaps from docs and renders.
  "What could this break" follows
  [Blast radius](blast-radius.md). Publication needs separate authority.
- A bug, failing test, regression, or wrong behavior, red loop wanted ->
  `axstack-debug`: diagnose, escalate via adviser-directed investigators, hand
  off a classified repair (explain: how; debug: what's wrong).
- Code quality/refactor discovery -> `axstack-improve`: rank bounded
  candidates with evidence; report only, no source edits.
- Accepted worker/Task/Run completion or bounded backlog request -> driver invokes
  `axstack-cleanup` inline; never dispatch it.
- Preparation completion, watch expiry, resume, or reconciliation -> the
  [lifecycle](lifecycle.md#native-handoff-and-resume): reconcile run record,
  keep owner, launch no native handoff.
- Explicit user-requested ownership transfer -> the same lifecycle section.
  Load the [Orca runtime boundary](orca-runtime.md), follow the runtime-owned
  handoff guide, and require explicit recipient acceptance before ownership
  changes. Missing capability is a setup gap; never invent one.
- Colleague PR review -> `axstack-review`, peer mode.
- Codebase review -> `axstack-review` codebase mode, report only.
- A status question about an own open PR or stack ("check now", "what's left",
  "are we done", or "is it approved") -> `axstack-watch` observation-only
  mode. Explicit "address", "patch", or "fix" grants authorized maintenance.
- Chat-run PR watch -> `axstack-watch`: original driver; verified run PRs and
  explicit adoptions only.
- Other own PR work -> `axstack-review` authored mode or `axstack-watch`
  adoption.

## Proportional scope identity

Classify new work as substantial, small, or unclear; record it with brief
reason in the run record, or in the brief for tiny direct work.

- **Substantial:** substantial features, multi-PR work, or stacked work; a
  bounded small feature is not substantial because it is labelled one.
  Require an approved spec plus a ticket map tied to that exact spec
  revision, with acceptance checks and dependencies in the explicitly selected
  Markdown, GitHub Issues, or Linear store. Prepare via `axstack-align` -> `axstack-spec`
  (one approval) -> `axstack-tickets` -> handoff, then continue under autopilot when eligible.
- **Small:** clear, bounded one-PR work. The driver captures the named
  **small-change intent** from the current request or user-chosen existing
  issue plus explicit acceptance checks and exclusions, snapshots it once, and
  proceeds. No prior snapshot, spec, tickets, or second approval is required; do not route
  to `axstack-align` solely because the snapshot is not yet written. Strict TDD,
  mode-specific review, model, risk, and human-merge
  contracts still apply.
- **Unclear:** clarify via `axstack-align` or a bounded question, then
  classify small or substantial; it does not force substantial-work paperwork.
  [Design lens](design-lens.md) Rung 1 is Unclear; use `axstack-align`.

Reassess size when growth adds an additional PR, a new execution dependency
that materially expands scope, an unsettled material design question, or a
security/infrastructure boundary crossing. An ordinary
test-then-code sequence is not multi-task growth; a minor file dependency is
not alone a formal spec trigger. Hold affected unsafe work while reassessing.

## Lifecycle routes (mode-specific scope identity required)

- Preparation: substantial work follows the align -> spec -> tickets ->
  handoff path above, then continues under autopilot when eligible; small work uses the driver-captured
  small-change intent.
- Execution: with its identity present, `axstack-implement` ->
  `axstack-review` -> `axstack-watch`.
- Peer review: `axstack-review` uses the linked issue, PR description, and
  repository requirements as untrusted intent evidence; it does not demand an
  Axstack-created approved spec.
- Adopted authored PR: snapshot the user-authorized maintenance intent once —
  accepted scope, exact head/base, verified writable ownership, and actual
  author provenance — then use `axstack-review` and `axstack-watch` without
  repeated approval or new spec ceremony. Never infer the author from the
  orchestrator or assume an imported own PR's author.
- Direct later phase: start there and pass that phase's identity check.
