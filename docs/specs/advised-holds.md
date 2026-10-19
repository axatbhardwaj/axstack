<!-- Markdown counterpart of GitHub issue #488 rev 5; body SHA-256 932c56b02ef710323300d3cf5ebfd9b0cd367351602756a8813c77957e0b492d. -->
# Advised holds, round-3 step-back and Pre-existing findings

**Status:** Approved rev 5 (2026-10-19, user approval in chat). **Repository:** `axatbhardwaj/axstack`. **Source baseline:** `70a52b7` (v0.45.0). **Align record:** private run `20261019-advised-holds` (Q1–Q4, one Align adviser round, spec adviser rounds 1–4, diligence on rev 4). **External input:** https://claude.dev/blog/solving-code-review-at-anthropic/ (review rounds capped at three, Pre-existing tag, "what would the checks miss").

## Outcome

When an Axstack run parks on a decision only the user can make, the card already carries a recommended resolution from the configured advisers. The user approves or picks a numbered option instead of working out the path.

A PR that fails three review rounds gets one adviser step-back and one advised repair round before it reaches the user.

A bug that already existed before the work began is labelled `Pre-existing`. It no longer blocks the PR or loops through repairs, but it is still tracked:

- On own PRs, the owner files it in the follow-up issue.
- On colleague PRs, the bot asks the author to file it and link it.

## Delivery

Ordinary PR chain with commits of about 200 lines. Each rule gets a prose-contract test under `tests/workflows/`. Acceptance 4 states the test rules.

- **A. Advised holds.** Add one `Advised holds` contract to `skills/axstack/references/contracts.md`, with a carve-out pointer at the Fable rule. Commit this spec's Markdown counterpart `docs/specs/advised-holds.md`. Point to it from:
  - watch (§4 holds, verification card, merge card);
  - implement (step 4 `held`);
  - review (urgent escalation);
  - autopilot (advance and hold).
- **C. Pre-existing.** Update review (finding severity, authored rules, peer mode, receipt), diligence and watch §5. Independent of A; can run in parallel. A and C both edit review and watch, so the later one rebases.
- **B. Step-back.** Update implement step 4 and the run-record `PR membership` field. Depends on A (round-4 card) and C (advisers may propose `Pre-existing`).
- **D. Release.** `chore(release): v0.46.0` under the standing release authority in `AGENTS.md`.

## Scope

### 1. Advised holds (PR A)

1. **When to advise.**
   - **Criterion.** Advise when a hold reaches the user and the reply picks between two or more paths an agent could then carry out.
   - **The criterion governs.** The in-scope list below is illustrative. The never-advised list is exhaustive and is judged by the hold's cause, not by the wording of a reply option.
   - **In scope (examples):**
     - `verification not proven`;
     - merge cards on a provenance cause or an unclosable verification gap;
     - a blocked operation, after bounded recovery, that needs the user to choose a path;
     - implement's hold for a scoped decision when no test-first check can be established;
     - the round-4 step-back hold (scope 2);
     - authored or codebase urgent escalation of a major design concern;
     - a reviewer `Escalate to user` on security, a permanent on-chain state change, or an architectural change in approach.
   - **Driver dispositions stay with the driver.** Diligence `UNKNOWN` and a run-record `Learning` contradiction are advised only if they reach the user as a hold.
   - **Never advised.** These holds only a human act can resolve:
     - spec approval, npm stage approval, collaborator approval;
     - access or credentials;
     - forge merges by the user;
     - `Auto-merge: off`;
     - work-promotion, deploying-base and unknown-base report cards;
     - the report-only comment-rating card;
     - model unavailability or substitution;
     - denied actions and explicit user stops;
     - peer-review holds (peer mode keeps its cap panel and sends no other human ping);
     - review-manager pass holds (the manager keeps its flagged-thread path).
2. **Steps.** Before parking:
   1. The driver closes the gap itself where it can, under the existing rules.
   2. It forms its own assessment.
   3. It consults the preset's configured advisers independently, without cross-reading, with the same bounded evidence packet and question:
      - `mixed`: `axstack-advisor-astra` and `axstack-advisor-opus`;
      - single-provider presets: the one configured adviser, with the other recorded as an intentional absence.
3. **Precedence.**
   - **High stakes.** A hold that involves a high-stakes decision follows the existing high-stakes contract (`axstack-advisor-astra` and `axstack-escalation-fable` plain AGREE) instead of these seats, including the single-provider high-stakes hold.
     - Only the seats and the handling of disagreement follow that contract: bounded checks first.
     - If Astra and Fable still disagree, the card shows both options with the driver's pick first and marks `high-stakes: no AGREE`.
     - The card lines, wait and authority rules here still apply.
   - **Serious risk** follows scope 1.9.
4. **Card.** Add these lines to the existing card. This is not a new card kind.
   ```text
   Recommended: <option n> (<advisers agree | advisers split | one adviser | advice pending: <seat> | advice unavailable: <seat>>)
   Trade-off: <one line>
   Checks would miss: <one line: what tests and review would not catch on this path | n/a for a non-code hold>
   Reply: 1. <option> 2. <option> ...
   ```
   - **On a split:**
     - list both options with one-line reasons, the driver's pick first;
     - run no reconciliation round and call no `axstack-escalation-fable`.

     `contracts.md`'s Fable rule gains this carve-out: "At an advised hold or step-back that is not high-stakes, an adviser split goes to the user with no reconciliation and no Fable." High-stakes holds keep the Fable seat (scope 1.3).
   - **Replies:**
     - With more than one card open, each reply names its PR. A hold without a PR uses its hold key.
     - An ambiguous reply clears nothing; the driver asks once.
5. **Authority unchanged.**
   - Advice never clears a hold. It never grants approval, merge or `user-accepted unproven`.
   - Silence never applies the recommendation.
   - A user reply clears only its bound cause, as today.
6. **Availability and wait.**
   - **One attempt per seat.** No automatic retry and no substitution.
   - **Bounded wait:**
     - With a run watch armed, the driver waits at most until the next bound watch wake, then posts the card.
     - With no watch armed, the driver posts the card at once.
   - **Seat labels.** A seat still running shows `advice pending: <seat>`; a failed or unavailable seat shows `advice unavailable: <seat>`.
   - **Late advice** is an addendum in the driver thread. It is not a new hold and sends no second alert.
   - **Pending dispatches** stay in the run record and settle when they terminate.
   - **Recorded gap.** An unavailable seat is recorded as a model gap for any later work that needs that seat. The card itself needs no advice, so the gap never blocks the card or the user's reply to it.
7. **Reuse.**
   - Reuse an advice receipt while its cause and evidence packet (including patch-id) are unchanged; the round-4 card reuses the step-back advisers with a delta-only brief.
   - Changed evidence, authority or question needs fresh advice.
   - The card itself still rebinds to the current head and base under the existing supersede rules.
8. **No loops.**
   - Per PR and cause kind, the driver may act once on advice to close the cause itself, only within its existing authority and only when the advisers agree. In a single-provider preset, the one adviser must agree with the driver. On a split, it posts the card.
   - If that cause recurs, or the action raises a new hold, the driver raises the card.
9. **Serious risk.**
   - Outside peer mode, every serious-risk hold is raised immediately, whichever skill raises it (watch, implement, review, autopilot, debug): security, downtime, data loss, major design.
   - The driver dispatches advisers only after the prompt is raised. Their advice follows as an addendum, with no second alert.
   - Peer serious-risk holds stay never advised.

### 2. Round-3 step-back (PR B)

1. **Trigger.** A PR's third failing review round. A round fails on reviewer `REQUEST_CHANGES` and/or diligence `FINDINGS`, counted once together as today. The driver steps back instead of holding.
   - Failed checks and post-readiness feedback still increment `repairs`, but do not count as failing review rounds.
2. **Seats.**
   - Implement already requires `mixed`, so the step-back always uses both `axstack-advisor-astra` and `axstack-advisor-opus`.
   - An unavailable seat counts as no agreement.
3. **Adviser brief.** Each adviser gets, independently:
   - the open findings and the author's replies;
   - the per-round deltas;
   - blame showing the round in which each flagged line first appeared;
   - the approved scope, sketch and approach.
4. **Extra round.** The driver sends one advised repair brief to the same author for round 4 only when all hold:
   - the driver accepts the path;
   - both advisers agree on it;
   - it stays inside the approved scope and breaks no sketch `Binding` line;
   - no independent hold applies.

   Round 4 needs fresh, independent reviewer and diligence receipts: a fresh session of the same mapped reviewer role, with no extra reviewer.
5. **Advisers do not judge findings.**
   - They cannot lower a rating or clear a finding.
   - They may propose `Pre-existing` with evidence; the round-4 reviewer validates it under scope 3.
6. **Durable count, once per PR.**
   - **Field.** Each entry in the run record's `PR membership` gains `rounds: <n>; step-back: unused | used r<n>`.
     - `rounds` counts failing review rounds (2.1), not `repairs`.
     - Ticketless PRs (small-change intents, adopted PRs) have entries too.
   - **Start state.**
     - A new planned PR, small-change PR or adopted PR starts at `rounds: 0; step-back: unused` when it enters the run, unless a prior run's entry for it exists, in which case it copies that entry.
     - A prior record that predates this field also starts `unused`.
     - Distinct planned PRs that share one ticket or issue keep separate budgets.
   - **When it is written.** The driver writes `used` before dispatching the advised repair brief.
   - **Lineage.** A replacement or split PR copies its predecessor's entry. The entry persists across rebases, resumes and owner transfer.
   - **Unknown history.** An inherited entry with this field whose value is missing or unclear counts as `used`.
   - **No second extension.** Any counted failing round after the extension records `held` with an advised card (scope 1). This includes a re-review after a base update and a round after a passing round 4. An interrupted or failed round-4 attempt follows the existing failure rules and never earns a second extension.
7. **Falls to the user now** when any 2.4 condition fails, recorded as `held` with the advised step-back card.
   - An independent hold (2.8) keeps its own card and rules instead. Any step-back advice already received is attached to that card as context.
   - Examples:
     - the advisers split;
     - a seat is unavailable;
     - the driver rejects the agreed path;
     - the only path leaves the approved scope or breaks a `Binding` line. A scope change follows the existing material-revision route.
8. **Unchanged holds:** `INCOMPLETE`, provenance gap, unavailable model, serious risk and diligence `UNKNOWN`.

### 3. Pre-existing findings (PR C)

1. **Disposition, not severity.** A finding may carry the disposition `Pre-existing`; its rating is unchanged. The reviewer must prove both:
   - **It existed before the work.** The defect itself, not just its lines, exists at the reference revision. Evidence is quoted code at that revision plus a reproduction or a same-input argument. Blame alone is not enough.
     - Own run PRs: the run's recorded `Source base`. A chain child's parent head does not count, so a defect this run introduced can never qualify.
     - Adopted own PRs and peer PRs: the merge-base of the PR head with the default branch.
   - **The diff does not cause it.** The diff does not change the defective code. It does not introduce, amplify or newly expose the defect through changed callers or configuration.
2. **Excluded.** These stay under the normal rules of their mode:
   - the defect the accepted scope targets (in peer mode, the linked issue or the PR's stated purpose);
   - a defect an acceptance check depends on;
   - another instance of the same defect class inside the diff;
   - amplified or newly exposed defects.

   The defect-class sweep runs before a finding takes the disposition.

   Failing the proof denies the disposition. It never raises a rating, and it never creates a peer blocker by itself.
3. **Who applies it.**
   - Only the reviewer applies the tag; the author never self-tags.
   - Authored mode: diligence contests a tag that lacks evidence or hits an exclusion, by returning `FINDINGS`.
   - Peer mode (no diligence): the owner's existing focused check (review §4) settles a disputed tag.
4. **Authored mode (own PRs).**
   - **Effect.** A validated `Pre-existing` medium or high finding:
     - does not block `APPROVE`;
     - needs no fix and re-review in this PR.

     These are explicit exceptions to "medium and high block" and "fix and re-review every medium or high finding". Nobody lowers the rating.
   - **Diligence:**
     - returns `PASS` listing validated `Pre-existing` items when no other blocking mismatch remains;
     - otherwise returns `FINDINGS` as today.
   - **Tracking.** The owner records each item in the existing follow-up issue with its severity and evidence, linked from the PR. The tracker is GitHub Issues, or Linear for `defi-com`.
   - **Watch §5 (PR C edits it):**
     - Agent-authored threads on validated `Pre-existing` findings do not hold automatic merge.
     - Repository conversation-resolution rules, non-agent comment ratings and human `CHANGES_REQUESTED` stay in effect.
     - Failed checks stay failed.
   - **Serious risk.** Serious-risk categories still raise the serious-risk hold.
5. **Peer mode (colleague PRs).** First review only. Follow-ups and the single-reviewer full-diff fallback add no `Pre-existing` notes, keep closed points closed, and never repeat an earlier note or request.
   - **Effect.** A validated pre-existing defect never blocks. Exceptions:
     - Serious security, data-loss or funds defects still block.
     - The peer serious-risk ping keeps its security/funds threshold.
   - **Drafts.** Only defects in changed files, or in their direct callers and callees, get a draft.
   - **One trailing `Pre-existing` block**, exempt from the five-note limit and the word budget, holds at most two drafts. All other validated pre-existing defects, including ones outside that range, go on one `Also pre-existing:` line.
   - **Each draft:**
     - says the bug is pre-existing and not caused by this PR;
     - gives a self-contained bug report with no private paths: title, `file:line`, reference SHA, reproduction or evidence, impact;
     - names the tracker (Linear for `defi-com` repositories, GitHub Issues otherwise);
     - asks the author to file it and link it in the PR.
   - **Existing issue.**
     - Before posting, the thread that publishes the review runs one read-only search per draft for an open issue on the same file or symbol and the same behaviour.
     - On a match, the draft links that issue instead of asking.
     - A failed search says `tracker search failed` and still asks; it never implies that no issue exists.
   - **Never a gate.** The request never gates `APPROVE`.
   - **Rule exceptions.** This filing request is the only exception to:
     - "never ask the author for … a process decision";
     - "peer notes have no follow-up issue required".
6. **Receipt.** The review receipt gains a `Pre-existing:` line listing each item with its reference revision and evidence, or `none`.
7. **Unchanged.**
   - The non-agent comment rating set (`above low`, `low`, `addressed`, `uncertain`).
   - Human `CHANGES_REQUESTED`.
   - **Known gaps:**
     - A bot or human comment about a pre-existing defect still holds merge under its own rating.
     - On own run PRs, a defect that others land on the default branch after the run's `Source base` cannot qualify. This is conservative: such a defect follows the normal rules.

### 4. Release (PR D)

`Release: AGENTS.md:79-87 + .github/workflows/publish.yml + hosts io, iobook, iobox (xzat@iobox), vps.`

Release flow:

1. Cut `chore(release): v0.46.0`.
2. Merge the release PR under the watch predicate.
3. Run the tag-triggered publish workflow. The human approves the npm stage.
4. Reinstall and verify on io, iobook, iobox and vps.

## Design

```text
Usage: watch hits `verification not proven` on PR #512 after the driver's own attempt failed, and posts:
         Verification not proven: payment retry against staging (PR #512 head abc1234 base def5678)
         Why: the offline fixture passes; this run has no staging key (driver attempt: evidence/verify-512-a1)
         Recommended: 1 (advisers agree)
         Trade-off: a scoped staging key and ~15 min verifier drive vs merging a path no test exercised
         Checks would miss: the provider's real retry headers
         Reply: 1. grant staging access; the verifier runs the drive  2. accept unproven for this head; merge proceeds when every other gate permits  3. keep holding
       user replies "#512 1"
Shape: contracts.md §Advised holds  <- pointers: watch §4/§5 cards, implement step 4, review escalation, autopilot; Fable carve-out at contracts' Fable rule
       implement step 4: round 3 fails -> step-back (both advisers) -> round 4 once -> held + advised card
       run-record PR membership: rounds + step-back per PR entry, copied to replacement and split PRs
       review severity + authored + peer + receipt, diligence, watch §5: Pre-existing disposition and peer filing request
Binding: advise only on >=2 agent-executable paths; advice grants no authority, never suppresses a card, waits at most one bound watch wake;
         high-stakes decisions keep Astra + Fable; serious risk is raised before advice; one step-back per PR lineage with a durable count and a hard hold after it;
         Pre-existing reference revision, evidence and exclusions; the peer filing request never gates APPROVE
Flow + failure: hold -> adviser dispatch -> one seat hangs -> next watch wake posts the card with `advice pending: <seat>`; late advice is an addendum; the user still decides
We accept: one adviser consult per judgment hold (cost, up to one bound watch wake of latency) for faster, better-informed user picks
Rejected: Fable tie-break at holds -> cost with no authority gain; a new advised-card kind -> duplicates existing cards;
          a script or runtime gate -> AGENTS.md forbids it; agent-filed tickets on colleague trackers -> tickets under the user's name on their board;
          the PR's pinned base as the Pre-existing reference -> lets a chain child hide a defect this run introduced
Open: none
```

## Acceptance

1. Contracts gain one `Advised holds` section carrying scope 1. Watch, implement, review and autopilot point to it without copying it. The Fable rule names the carve-out.
2. Implement step 4 replaces the third-round hold with the step-back, and each run-record `PR membership` entry gains the `rounds` / `step-back` field (scope 2).
3. Review, diligence and watch §5 define the `Pre-existing` disposition, its reference revision, evidence, exclusions, receipt line and effects in authored and peer modes. The peer exceptions name only the filing request (scope 3).
4. **Prose-contract tests** cover each scenario below. Each test fails when its rule is removed or inverted and survives a meaning-preserving rewording.
   1. A hold with two or more agent-executable paths gets advice; a never-advised hold (including a review-manager pass hold) does not.
   2. A non-high-stakes split shows both options with the driver's pick first, with no Fable. A high-stakes hold keeps Astra and Fable plain AGREE, and an unresolved high-stakes split shows both options marked `high-stakes: no AGREE`.
   3. A hung seat leads to the card at the next bound watch wake with `advice pending`; with no watch, the card posts at once.
   4. An unavailable seat shows on the card; at step-back it counts as no agreement.
   5. Unchanged evidence reuses advice; changed evidence needs fresh advice.
   6. Advice never clears a hold and silence never applies it; an ambiguous reply clears nothing. The never-advised list is judged by the hold's cause.
   7. Serious risk:
      - It is raised before advice, including a serious risk found during watch or implement; late advice sends no second alert.
      - There is one advice-suggested self-close per PR and cause kind, only when advisers agree.
   8. Step-back:
      - It gives exactly one extra round, and advisers cannot lower a rating.
      - The count survives a replacement PR, a split and a rebase, and any failing round after it holds.
      - A ticketless PR and an adopted PR each get their first extension.
      - A failed check and post-readiness feedback do not count as a round.
      - An adopted PR copies an earlier run's entry; a record that predates the field starts `unused`.
      - An independent hold keeps its own card.
      - Two PRs sharing one issue keep separate budgets.
   9. Pre-existing:
      - a defect introduced earlier in the same run is rejected (Source base rule);
      - an inherited but amplified or newly exposed defect stays blocking;
      - blame alone is rejected;
      - the author never self-tags;
      - the receipt carries the `Pre-existing:` line.
   10. A serious inherited defect still blocks (peer) or raises the serious-risk hold (authored). An own-PR item reaches the follow-up issue with its severity. Under watch §5, an agent thread on a validated `Pre-existing` finding does not hold merge, while a human `CHANGES_REQUESTED` still does.
   11. Peer note:
       - It has at most two drafts, and an out-of-range defect goes on `Also pre-existing:` without blocking.
       - An existing issue is linked, and a failed search still asks.
       - The filing request never gates `APPROVE`, and follow-ups never re-ask.

   **Existing tests.** These are updated, not deleted, keeping removal-or-inversion red:
   - `review-convergence.test.js:19`
   - `implement-loop.test.js:24`
   - `diligence-repair.test.js:31-32`
   - `review-severity.test.js:41-42`
   - `peer-review.test.js:162-163`
   - `autopilot-repair.test.js:70`
   - `fable-escalation.test.js:31`
   - `review-severity.test.js:52-58, 65-68, 106`
   - `merge-boundary.test.js:63`
   - `peer-review.test.js:30-31, 45-46`
   - `review-severity.test.js:45-51`

   **Suite.** `bun run test:all` passes.
5. `verify-axstack` Workflow contracts and Package contents features pass at each PR's final head.
6. The release is published, installed on io, iobook, iobox and vps, and verified there.

## Verification

- **`verify-axstack` applies:**
  - Workflow contracts (`features/workflows.md`) and Package contents (`features/package.md`) at each PR's final head;
  - the release adds Install/check/version on each host.
- **Unverified until real use:**
  - live adviser dispatch at a T3 hold;
  - a live step-back on a PR that really fails;
  - live peer-note posting;
  - host alert delivery.

## Exclusions

- `REVIEW.md`, finding vote filter, incident evals and circuit breakers.
- Live home configuration, including any `CLAUDE.md` alert line. An optional `Recommended:` alert line is offered separately as the user's own edit.
- No change to:
  - the peer cap panel (its Fable split rule stays);
  - the high-stakes contract;
  - non-agent comment ratings;
  - the severity rubric.
- No new script, state store, daemon or programmatic gate.

## Decisions

| # | Decision | Source |
| --- | --- | --- |
| D1 | Advise only when the reply picks between two or more agent-executable paths; the criterion governs; the never-advised list is exhaustive | Astra and Opus Align r1; Opus spec r1 |
| D2 | One contract in `contracts.md`, with pointers elsewhere | Opus Align r1 |
| D3 | Reuse key is cause plus evidence packet (patch-id), not raw head or base | Astra and Opus Align r1 |
| D4 | At most one advice-suggested self-close per PR and cause kind | Opus Align r1, spec r1 |
| D5 | Serious risk is raised first; advisers dispatch after; advice is an addendum; no second alert | Astra and Opus Align r1; Opus spec r1 |
| D6 | Single-provider presets use one adviser plus a recorded absence. An unavailable seat shows on the card and never blocks it, and stays a recorded gap for later work | Astra and Opus Align r1, spec r1 |
| D7 | One extra advised round after the round-3 step-back, once per PR lineage (replacement and split PRs inherit the count); hard hold after it | User Q1; Astra and Opus spec r2 |
| D8 | On an adviser split at a non-high-stakes hold or step-back, show both options with the driver's pick first; no Fable, no reconciliation; explicit carve-out in contracts. High-stakes holds keep Astra + Fable; an unresolved high-stakes split shows both options marked `high-stakes: no AGREE` | User Q2; Opus spec r1, r4; diligence rev 4 |
| D9 | Pre-existing applies to peer PRs (first review only) as a note asking the author to file and link the bug; never a gate | User Q3; Astra and Opus spec r1 |
| D10 | Own PRs: the owner files Pre-existing items in the follow-up issue; colleague PRs: the author files | User Q4 |
| D11 | Pre-existing is a disposition with evidence at the run's Source base (merge-base for adopted and peer PRs); blame alone fails; exclusions as in scope 3.2 | Astra and Opus Align r1; Opus spec r1 |
| D12 | The advice wait is bounded by one watch wake; with no watch, the card posts at once | Astra and Opus spec r1 |
| D13 | High-stakes decisions keep the Astra + Fable route instead of advised seats (card, wait and authority rules still apply); outside peer mode, serious risk is raised first, whichever skill raises it, with advice after; peer serious-risk holds are never advised | Opus spec r1, r2, r3 |
| D14 | Diligence `UNKNOWN` and `Learning` contradictions stay driver dispositions | Opus spec r1 |
| D15 | Peer drafts: at most two in one trailing block, for changed files and their direct callers and callees; every other validated pre-existing defect goes on one non-blocking line | Opus spec r1, r2; Astra spec r1 (optional) |
| D16 | Spec store: this GitHub issue plus `docs/specs/advised-holds.md`, committed in PR A | Precedent `docs/specs/scout.md`; diligence rev 4 |
| D17 | Watch §5 is edited in PR C so agent threads on validated Pre-existing findings do not hold merge | Opus spec r2 |
| D18 | Review-manager pass holds are never advised; an independent hold during a step-back keeps its own card | Opus spec r4 |
| D19 | Run records that predate the step-back field start `unused` | Opus spec r4 |
