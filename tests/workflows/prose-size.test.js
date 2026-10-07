import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const skills = `${root}/skills`;

test('packaged guidance stays within the aggregate and always-loaded budgets', () => {
  const markdown = readdirSync(skills, { recursive: true }).filter((path) => path.endsWith('.md'));
  const bytes = (path) => readFileSync(`${skills}/${path}`).byteLength;
  const total = markdown.reduce((sum, path) => sum + bytes(path), 0);
  const alwaysLoaded = ['contracts.md', 'lifecycle.md', 'routing.md']
    .reduce((sum, path) => sum + bytes(`axstack/references/${path}`), 0);

  // Aggregate baseline: 268,118 bytes on main; 273,308 with #245/#246; 2% headroom: 278,775.
  // driver acceptance recorded in run 20260930-test-slop-audit.
  // Driver acceptance in run 20261003-t3code-migration (T5b): restore the
  // 278,775-byte aggregate ceiling after retiring the legacy runtime reference.
  // 20261004-brainstorm-skill: new skill, user-approved; minimal ceiling 279,126.
  // 20261004-correct-ste T1: +86 bytes for literal owned-scratch cleanup and whole-worktree scope.
  // 20261004-correct-ste T2: +1322 bytes for close-out acceptance and spec receipt revisions.
  // 20261004-correct-ste T2 repair1: +78 bytes for explicit hold, high-stakes exception, and archive receipt.
  // 20261004-correct-ste T3: +1391 bytes for body-head checks, diligence logs, and Learning findings.
  // 20261004-correct-ste T3 repair1: +151 bytes for the diligence UNKNOWN hold and recorded reason.
  // 20261004-correct-ste T4: +982 bytes for STE-inspired writing and its contracts link.
  // 20261004-correct-ste T5: +1673 bytes for performance questions and three conditional links.
  // 20261004-correct-ste T6: +1813 bytes for the report-only recurrence skill and its safety contracts.
  // 20261004-correct-ste T6 repair2: +98 bytes for Standing contracts load and the report-only lifecycle exemption.
  // 20261004-correct-ste T7: +333 bytes for the audit recurrence exception and direct route.
  // 20261004-correct-ste T7 repair1: +121 bytes for both recurrence dispositions, net of the routing wrap.
  // 20261004-diagram-skill T2: +6613 bytes for the diagram router, fidelity, finalize, and limited UI exception.
  // 20261004-diagram-skill T2 repair1: +768 bytes for pinned cards, theme, claim labels, and composition repair guidance.
  // 20261004-diagram-skill T2 repair2: -278 bytes by deferring authoring and layout repair to pinned archify references.
  // 20261004-diagram-skill T2 repair3: +280 bytes for explicit Axstack precedence, retry exclusion, and browser delegation.
  // 20261004-diagram-skill T3: +962 bytes for explain routing, requested formats, card counting, and finalize-bound QA.
  // 20261006-review-lane-self-heal T1: +1381 measured bytes for bounded wedge recovery and terminal duplicate retirement.
  // 20261006-review-lane-self-heal T1 repair1: +798 bytes for any-pass recovery, exact-run interrupts, wait semantics and canary.
  // 20261006-review-lane-self-heal T1 repair2: +316 bytes for successor settlement before takeover and descendant protection.
  // auto-merge-preview-triage T1: +1951 measured bytes for shared severity, diligence verdicts, and comment holds.
  // auto-merge-preview-triage T2: +1214 measured bytes for the revert definition, body policy, and authored review.
  // auto-merge-preview-triage T3: +6018 measured bytes for default merge authority, provenance, exclusions, and cards.
  // auto-merge-preview-triage T4: +2257 measured bytes for every-phase watch arming, lifetime, cadence, and receipts.
  // auto-merge-preview-triage T4 repair1: -65 measured bytes after consolidating arming and watch receipts.
  // auto-merge-preview-triage T5: +3232 measured bytes for the PR preview procedure and owner lifecycle links.
  // auto-merge-preview-triage T5 repair1: +96 measured bytes for owner, verifier, and later-release authority boundaries.
  // auto-merge-preview-triage T6: +1957 measured bytes for nightly triage prompt and durable setup guidance.
  // Historical main ceilings (before this PR):
  // Always-loaded baseline: 23,361 bytes; 5% ceiling: 24,530.
  // Driver acceptance recorded in run 20260930-workflow-bottleneck-audit.
  // 20261006-account-routing rebase on d292f90: +1679 measured aggregate bytes
  // and +754 always-loaded bytes for the accepted account-routing contract.
  // Current ceilings: 314674 + 1679 = 316353; 24530 + 754 = 25284.
  // Preserve main history above and its 21-byte always-loaded headroom.
  // 20261006-relay-reply-tag: user-approved two-way relay tag; +1012 aggregate bytes.
  // 20261006-relay-reply-tag repair1: driver-authorized reply-origin proof; +1064 aggregate bytes.
  // 20261006-driver-self-routing T1: minimal +1497 aggregate and +143
  // always-loaded ceiling bytes for the canonical driver rule and short pointers.
  // 20261006-driver-self-routing amendment 1: +2424 measured bytes for
  // creation-time schedule bindings, recreation and scheduled-pass entry links.
  // 20261006-driver-self-routing repair 1: +763 measured bytes for owner-only
  // schedule/binding updates, explicit pass exit rules and forge-only triage scope.
  // 20261006-driver-self-routing repair 2: +404 measured bytes for the
  // lane-only gate and non-lane replacement inventory/skip rule.
  // 20261006-native-pr-watch T1: +2748 measured aggregate bytes and +436
  // always-loaded bytes for maintenance routing and canonical native PR tools.
  // 20261006-rm-settle-lag T1: +902 measured aggregate bytes for guarded
  // any-pass metadata settlement at pass start, separate from owner retirement.
  // 20261006-docs-overhaul T2: +920 measured aggregate bytes and +284 always-loaded bytes for skill fixes F1-F3, S1-S7.
  // 20261006-hermes-reply-inbox T1: +2028 measured aggregate bytes for inbox forwarding,
  // body-digest receipt matching and the packaged Hermes prompt; always-loaded unchanged.
  // A7 five-minute wake cadence: -5 measured aggregate bytes; always-loaded unchanged.
  // Hermes reply inbox repair1: +574 measured bytes for short plain-text/full-quote
  // transport, gateway version and CLI-only discovery scope; always-loaded unchanged.
  // 20261007-auto-merge-scope T1: +81 measured aggregate bytes for narrowed
  // exclusions and release merge eligibility; always-loaded unchanged.
  // 20261007-auto-merge-scope T1 scope addendum: +957 measured aggregate
  // bytes for consistent owning-watch actor pointers and approval/base record fields.
  // 20261007-auto-merge-scope T1 repair1: +145 measured aggregate bytes for the
  // closed manifest exclusion, release publication boundary and wording fixes.
  // 20261007-borrow-skills T1: +2753 measured aggregate bytes for the shared
  // performance loop and three conditional phase directives; always-loaded unchanged.
  // 20261007-borrow-skills T1 repair1: +143 measured aggregate bytes for
  // accepted structure-preserving scope and Implement-only change steps.
  // 20261007-borrow-skills T2: +687 measured aggregate bytes (644 for the thin
  // perf router, 43 for its direct route); +43 always-loaded routing bytes.
  // 20261007-borrow-skills T3: +1098 measured aggregate bytes for the optional
  // audit environment lens and pinned MIT attribution; always-loaded unchanged.
  // 20261007-borrow-skills T4: +456 measured aggregate bytes for UI proof
  // standards and pinned MIT attribution; always-loaded unchanged.
  // 20261007-autonomy A1: +1682 measured aggregate bytes (+1139 Autopilot,
  // +543 contracts) for denial scope and verified reversible repair; +543 always-loaded.
  // 20261007-borrow-skills T5: +5070 measured aggregate bytes (4989 create
  // skill + 81 routing); +81 always-loaded routing bytes.
  // 20261007-borrow-skills T5 repair1: +83 measured aggregate bytes for
  // fully qualified feature index and per-feature paths; always-loaded unchanged.
  // 20261007-borrow-skills T6: +3507 measured aggregate bytes (2579 maintain
  // skill + 464 implement + 464 UI integration); always-loaded unchanged.
  // 20261007-explain-t3-inline-html T1: +3886 measured aggregate bytes for
  // inline page routing and checks; always-loaded unchanged.
  // 20261007-explain-t3-inline-html T1 repair1: +80 measured aggregate bytes
  // for visual QA on requested artifacts; always-loaded unchanged.
  // 20261007-explain-t3-inline-html T2: +1527 measured aggregate bytes for
  // preview exceptions, page verification and dispatch publication limits; always-loaded unchanged.
  // 20261007-explain-t3-inline-html T2 rebase2: +92 measured aggregate bytes
  // for explicit verifier proof scope on candidate checks and inline pages; always-loaded unchanged.
  // 20261007-explain-t3-inline-html T2 repair1: +316 measured aggregate bytes for
  // dispatched non-publishing preview self-checks; always-loaded unchanged.
  // 20261007-explain-t3-inline-html T3: +696 measured aggregate bytes for
  // spec readback identity, diagram routing and role notes; always-loaded unchanged.
  // 20261007-explain-t3-inline-html T3 rebase1: 343009 measured bytes + 44 headroom;
  // preserve borrowed-skills comments and its 26190-byte always-loaded ceiling.
  // 20261007-explain-t3-inline-html T3 rebase2: 353899 measured bytes + 44 headroom;
  // retain all dated comments and main's 26814-byte always-loaded ceiling.
  // 20261007-autonomy A2: +879 measured aggregate bytes (+546 Autopilot,
  // +277 Spec, +56 Watch) for standing release and merge carry-forward; always-loaded unchanged.
  // 20261007-autonomy A2 repair1: -2 measured aggregate bytes for
  // run-record authority wording; always-loaded unchanged.
  // 20261007-autonomy A3: +1250 measured aggregate bytes (+558 Align,
  // +386 Spec, +145 watch runtime, +161 T3 runtime); always-loaded unchanged.
  // 20261007-autonomy A3 repair1: +477 measured aggregate bytes (+234 Align,
  // +243 Spec) for default fresh receipts and the bounded delta exception.
  // 20261007-autonomy A4: +1154 measured aggregate bytes (+323 Relay,
  // +201 lifecycle, +403 T3 runtime, +143 publication, +84 hygiene);
  // +201 always-loaded bytes. Preserve the inherited 44-byte aggregate headroom.
  // 20261007-author-thread-settle A1: +1163 measured aggregate bytes
  // (+987 T3 runtime, +176 hygiene) for author PR links and settlement readbacks;
  // always-loaded unchanged. Preserve the inherited 44-byte aggregate headroom.
  expect(total).toBeLessThanOrEqual(358864);
  expect(alwaysLoaded).toBeLessThanOrEqual(27015);
});
