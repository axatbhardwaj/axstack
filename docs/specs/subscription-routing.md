# Explicit routing presets and active progress tracking

Status: Draft revision 2 — awaiting specification approval.
Authoritative store: repository Markdown, following this project's existing
specification and plan convention. This supplements docs/specs/v1.md; it does
not rewrite its historical approval.

## Outcome

One shared Axstack skill set supports explicitly selected mixed, codex-only,
and claude-only routing. Skills express responsibilities and review rules;
installed Paseo profiles supply models and effort. The current chat stays the
driver. Preferred driver profiles never automatically replace it.

The driver actively reconciles execution progress so completed, reviewed work
does not wait indefinitely for a missed completion notification.

## Accepted routing

Names below denote the corresponding explicit model IDs already used by the
bundle. Opus means Opus 5; Fable means Fable 5.1. Availability and supported
efforts must be checked against the actual provider at launch.

| Role | Mixed | Codex-only | Claude-only |
| --- | --- | --- | --- |
| Preferred driver | Astra low | Sol high | Opus high |
| Advisor | Fable medium | Astra medium | Fable medium |
| PR owner | Opus medium | Sol high | Opus high |
| Author | Sol medium | Sol medium | Opus medium |
| Authored review | Sol author → Opus medium; Opus author → Sol medium | Sol author → Terra xhigh | Opus author → Sonnet xhigh |
| Peer review | Sol medium + Opus medium | Sol medium + Terra xhigh | Opus medium + Sonnet xhigh |
| Requirements research | Opus medium | Astra medium | Opus medium |
| Code research | Sol medium | Sol medium | Opus medium |
| Web research | Opus low | Terra low | Sonnet low |
| Explanation author | Sonnet xhigh | Sol high | Sonnet xhigh |
| Explanation reviewer | Luna max | Luna max | Sonnet high |
| Codebase exploration | Sonnet xhigh | Terra xhigh | Sonnet xhigh |
| Execution checks | Terra low | Terra low | Sonnet low |
| Auditor | Luna max | Luna max | Sonnet xhigh |
| Monitor and watchdog | Opus medium | Terra low | Sonnet low |
| Linear checker | Explicit user selection | Luna low | Sonnet low |

## Setup and routing contract

- Installation requires an explicit preset selection. No inference from the
  chat harness, installed binaries, credentials, or presumed subscription;
  omission fails before mutation with actionable choices. `--harness` remains
  the skill destination selector, separate from the routing preset.
- All presets expose the same role IDs. Existing model-neutral IDs remain.
  Reviewer IDs become `axstack-reviewer-primary` and
  `axstack-reviewer-secondary`, corresponding to the table's ordered peer
  pair. Authored routing selects the eligible slot using actual author
  provenance, not its owner or driver model.
- Migrate unchanged Axstack-owned legacy reviewer profiles safely; preserve
  custom profiles and user edits. Report collisions and incompatible overrides
  as setup gaps rather than overwriting them or claiming a usable preset.
- Explicit preset changes apply to new runs. Active runs retain a recorded
  profile/model/effort snapshot; never silently change an existing session or
  launch its replacement under a new preset. Deliberate changes to an active
  run require an explicit user decision and evidence revalidation.
- Profile customization remains supported within the selected provider bounds
  and review requirements. Unavailable models, unsupported efforts, missing
  roles, or incompatible overrides hold affected work. No automatic fallback,
  dynamic quota routing, or subscription entitlement inference.
- Installation preserves unrelated config, credentials, schedules and owned
  asset safeguards. Installation is not proof of live daemon reload or model
  compatibility. This work does not install into live home configuration.

## Claude Code native subagent default

When Claude Code is available, setup also manages the user-settings entry
`env.CLAUDE_CODE_SUBAGENT_MODEL = "opus"`. This applies to native Claude Code
subagents; it does not replace the explicit model selection of independent
Paseo role sessions or alter the main conversation model.

- Merge only this key into Claude Code's user settings, respecting its actual
  configuration directory. Preserve existing explicit values and unrelated
  settings; report preserved overrides. Missing Claude Code is a reported skip,
  not permission to install it. Codex-only routing still launches no Claude
  roles even if this local Claude setup preference is installed.
- Track ownership at the individual setting level. Repeated setup is
  idempotent; uninstall removes only the unchanged value Axstack introduced.
  Never delete pre-existing values or overwrite later user edits. Malformed
  settings and unsafe paths fail without mutation; use atomic writes and
  preserve rollback guarantees.
- Set only the requested variable, not `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`.
  Current Claude documentation describes this as a default when another source
  does not assign the subagent model; built-in or explicitly selected models
  can behave differently. Do not claim all subagents are forced onto Opus or
  infer usage savings without runtime evidence.
- Tests use temporary settings homes and injected Claude availability. Cover
  absent CLI, absent settings, unrelated env keys, existing equal/different
  values, malformed files, repeat setup and edited-value-safe uninstall.

Sources: [Claude native subagent model selection](https://code.claude.com/docs/en/sub-agents#choose-a-model)
and [settings scopes](https://code.claude.com/docs/en/settings).
This is installer behavior to implement, not authorization to edit live home
configuration during development.

## Review and advisor contract

- Peer review requires exactly two independent non-author/non-owner sessions
  with the configured pair, identical complete briefs, and isolated first
  passes. Authored review requires one eligible non-author/non-owner reviewer
  covering all six angles and acceptance against the exact SHA and base.
- The authored mappings above are explicit. Unknown or unsupported author
  provenance is INCOMPLETE pending user routing, never an invented reverse
  pairing. Owners that author code must be recorded as authors.
- Mixed retains cross-provider review. Single-provider code review uses the
  specified different models and does not claim cross-provider independence.
- Claude-only explanation review deliberately permits separate Sonnet author
  and reviewer sessions at xhigh and high respectively. This exception is
  session independence only and does not permit same-model code review.
- Advisor and audit requirements refer to configured roles rather than
  unconditionally requiring Fable or Luna. Their existing decision authority,
  high-stakes agreement, and report-only boundaries remain.
- Existing mixed high-stakes Opus high / Sol high routing remains. This change
  introduces no additional single-provider high-stakes mapping: an unmapped
  route pauses for an explicit decision rather than borrowing another provider
  or silently changing effort.

## Active execution tracking

- Establish one driver-owned native Paseo heartbeat per active execution run,
  every ten minutes by default. Completion notifications also trigger immediate
  reconciliation; neither mechanism alone is proof of completion.
- At a tracking tick, reconcile owners, authors, pending reviews, candidate
  revisions and acceptance evidence with the run record. Verify transitions,
  advance ready authorized dependent tasks, and record the next action.
- Detect completed-but-unadvanced work, failed sessions, unresolved launch
  receipts, and stalls. Report uncertainty and take bounded recovery actions
  under existing authority; never duplicate a writer or assume idle means
  complete. Healthy unchanged ticks need no user-facing update.
- Reconcile an existing heartbeat before creating one on resume. Persist its
  actual ID, handshake and deadline; ambiguous creation blocks duplicate
  creation until runtime state is known. Missing timer capability is an
  explicit tracking gap, not a claim that active tracking is enabled.
- Stop the execution heartbeat on pause, completion, or the existing fixed run
  deadline (24 hours by default). Resume only within applicable authority and
  remaining deadline; no silent extension. Existing PR watch roles retain
  their separate observation responsibilities and shared deadline rules.
- Tracking is prompt policy using Paseo, not a new scheduler, runtime engine,
  or tight polling loop. It does not grant merge, release, or expanded scope.

## Acceptance evidence

1. Meaningful installer tests fail before implementation for omitted/invalid
   presets, then pass for each explicit preset in temporary homes.
2. All presets have the same role IDs and exact accepted model/effort mappings;
   single-provider presets contain no other provider. Unconfigured mixed
   checker remains deferred, never launched with a provider default.
3. Installation, repeat installation, switching, migration and uninstall
   preserve custom profiles, credentials, unrelated fields and existing
   ownership protections. Conflicts are visible; no partial preset is reported
   as ready. Package smoke checks include all required assets.
4. Workflow scenarios cover each authored/peer route, owner-authored and
   unknown-provenance candidates, unavailable models, active-run preset
   switching, and the Sonnet explanation exception. Source/structural checks
   are reported separately from observed agent behavior.
5. Tracking scenarios cover missed notifications, reviewed tasks awaiting
   advancement, duplicate events, uncertain launches, stalls, restart, pause,
   completion and deadline expiry. Expected actions include advancing only
   eligible work and maintaining one owned heartbeat with no duplicate writer.
6. Documentation and all shipped phase references consistently use the routing
   contract. Strict TDD, independent review, one writer, human merge, and
   prompt-only serious-risk escalation remain intact.
7. Report fixture tests, behavioral evaluations, provider discovery and live
   execution as separate evidence. No end-to-end support claim without actual
   harness execution. Missing evidence remains explicitly unverified.

## Preparation evidence and exclusions

The user accepted the displayed routing table, explicit preset selection,
peer pairs and ten-minute tracking cadence in this conversation. Fable advised
on the initial independence question only. Later decisions and this draft are
driver-only because the user stopped all task subagents; no renewed advisor or
audit consultation is claimed.

Excluded: duplicated skill bundles, automatic provider fallback, a new runtime,
automatic subscription detection, live installation/configuration or schedules,
automatic migration of active runs, merge, release, and publication.

Implementation waits for approval of this exact specification and a matching
task map. Preparation ends with a resumable handoff; it does not dispatch work.
