import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Cross-file consistency checks for the automation contract. Each assertion
// binds a trigger to its required outcome (a transition), not a bare keyword.
// A sentence is the unit: `clause` returns the sentence that carries the
// trigger so the outcome must appear in the same rule.
function clause(text, trigger) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z`*(])/);
  const hit = sentences.find((s) => trigger.test(s));
  expect(hit, `no sentence matches ${trigger}`).toBeTruthy();
  return hit;
}

function section(text, start, end) {
  const from = text.indexOf(start);
  expect(from, `missing section start ${start}`).toBeGreaterThan(-1);
  const to = text.indexOf(end, from + start.length);
  expect(to, `missing section end ${end}`).toBeGreaterThan(from);
  return text.slice(from, to);
}

test('sol-1: an automation repair is reviewed at its local immutable SHA; ordinary candidates keep remote confirmation', () => {
  const pub = compact('skills/axstack/references/candidate-publication.md');
  const review = compact('skills/axstack-review/SKILL.md');

  // Ordinary boundary: remote equality before reviewer dispatch is unchanged.
  expect(pub).toMatch(/Before reviewer dispatch, read the remote ref back and confirm that it resolves to the candidate SHA/);
  expect(pub).toMatch(/Ordinary[^.]*(?:keep|retain)[^.]*remote confirmation|Every other caller[^.]*remote confirmation/i);

  // Automation exception: local commit SHA in the per-PR child worktree is the
  // candidate, confirmed by git rev-parse, not by remote equality.
  const exception = clause(pub, /automation repair/i);
  expect(exception).toMatch(/local immutable commit SHA[^.]*per-PR child worktree/i);
  expect(clause(pub, /git rev-parse/)).toMatch(/instead of remote equality/i);
  expect(clause(pub, /re-checked/i)).toMatch(/remote equality[^.]*publication readback[^.]*immediately before the fast-forward push/i);
  // The remote is expected to still be the pre-repair head, so equality is not required for admission.
  expect(clause(pub, /pre-repair/i)).toMatch(/expected-old remote SHA|not[^.]*equal[^.]*candidate/i);

  // Review skill: pin-the-brief step carries the same exception and keeps the ordinary rule.
  const pin = section(review, '1. **Pin the brief.**', '2. **Materialize');
  expect(pin).toMatch(/For an owned candidate, verify remote confirmation of the candidate SHA before reviewer dispatch/);
  expect(clause(pin, /automation repair/i)).toMatch(/local immutable candidate SHA[^.]*git rev-parse[^.]*child worktree/i);
  expect(clause(pin, /automation repair/i)).toMatch(/remote[^.]*pre-repair|expected-old remote/i);
});

test('sol-2: original-author continuity is scoped to run-launched sessions; an automation repair is authored by the automation session or a dispatched axstack-author', () => {
  const watch = compact('skills/axstack-watch/SKILL.md');
  const repair = compact('skills/axstack-watch/references/repair-publication.md');
  const ref = compact('skills/axstack/references/automations.md');

  for (const [name, text] of [['watch', watch], ['repair-publication', repair]]) {
    // Continuity rule is conditioned on a session the run itself launched.
    const continuity = clause(text, /original author session|same original author session/i);
    expect(continuity, `${name}: continuity must be scoped`).toMatch(/run itself launched|launched by (?:this|the) run|this run launched/i);
    // Automation branch: adopted own PR -> automation session or dispatched axstack-author.
    const automation = clause(text, /adopted own PR under (?:the|an) automation|under (?:the|an) automation[^.]*adopted own PR/i);
    expect(automation, `${name}: automation author`).toMatch(/automation session[^.]*(?:Claude\/Opus|provider `claude`)/i);
    expect(automation, `${name}: delegated author`).toMatch(/dispatched `axstack-author`/);
    // Reviewer pairing follows the recorded actual provenance of that repair.
    expect(clause(text, /authored-review pairing|authored review pairing/i)).toMatch(/actual provenance|recorded provenance/i);
  }
  // The shared reference names the two provenance -> reviewer transitions.
  expect(clause(ref, /repair author is the automation session/i)).toMatch(/`axstack-reviewer-primary`/);
  expect(clause(ref, /delegated to `axstack-author`/i)).toMatch(/`axstack-reviewer-secondary`/);
});

test('sol-3: the driver is the automation session; axstack-monitor stays optional read-only and never sends; the watchdog never mutates GitHub and may perform only the gate-authorized health send', () => {
  const texts = {
    'watch-runtime': compact('skills/axstack-watch/references/watch-runtime.md'),
    watch: compact('skills/axstack-watch/SKILL.md'),
    workflows: compact('docs/workflows.md'),
    lifecycle: compact('skills/axstack/references/lifecycle.md'),
    automations: compact('skills/axstack/references/automations.md'),
  };
  for (const [name, text] of Object.entries(texts)) {
    // Driver identity: the automation session itself, not a monitor/owner role row.
    const driver = clause(text, /driver (?:automation )?is the automation session itself/i);
    expect(driver, `${name}: driver is not a role row`).toMatch(/no `axstack-monitor` or `axstack-owner` role(?: row)?|neither `axstack-monitor` nor `axstack-owner`/i);
    // Monitor: optional, read-only, never sends.
    const monitor = clause(text, /`axstack-monitor`[^.]*optional|optional[^.]*`axstack-monitor`/i);
    expect(monitor, `${name}: monitor read-only`).toMatch(/read-only/i);
    expect(monitor, `${name}: monitor never sends`).toMatch(/never sends/i);
    // Watchdog: never mutates GitHub; exactly one kind of send, gate-authorized, recorded in watchdog.json.
    const watchdog = clause(text, /`axstack-watchdog`[^.]*never mutates GitHub/i);
    expect(watchdog, `${name}: watchdog one send`).toMatch(/exactly one kind of send|only send/i);
    expect(watchdog, `${name}: watchdog send is gated`).toMatch(/gate-authorized[^.]*automation-health/i);
    expect(watchdog, `${name}: watchdog send recorded`).toMatch(/`watchdog\.json`/);
    // The stale blanket rule must be gone.
    expect(text, `${name}: stale no-send rule`).not.toMatch(/monitor and watchdog never send|monitor\/watchdog roles never send|watchdog never sends and never mutates/i);
    expect(text, `${name}: monitor is not the driver`).not.toMatch(/`axstack-monitor` names the five-minute driver/i);
  }
});

test('sol-4: credible serious risk raises the internal prompt and hold immediately; the gate governs only external notification', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const review = compact('skills/axstack-review/SKILL.md');
  const contracts = compact('skills/axstack/references/contracts.md');
  // The standing contract is unchanged and is what the precedence rule points at.
  expect(contracts).toMatch(/Raise credible serious security, downtime, data-loss, or major-design risk immediately through a prompt/);

  for (const [name, text] of [['automations', ref], ['review', review]]) {
    // Trigger: credible serious risk found by a reviewer.
    const rule = clause(text, /credible serious risk/i);
    // Outcome 1: the standing internal prompt and dependent-action hold, immediately.
    expect(rule, `${name}: immediate internal hold`).toMatch(/standing internal prompt[^.]*dependent-action hold[^.]*immediately|immediately[^.]*standing internal prompt[^.]*dependent-action hold/i);
    // Outcome 2: the gate decides only external notification.
    expect(rule, `${name}: gate scope`).toMatch(/gate governs only external notification/i);
    // Precedence: proceed never overrides a validated blocking finding.
    expect(clause(text, /`proceed`[^.]*never overrides/i)).toMatch(/validated blocking finding/i);
  }
  // The review skill says where the automation's internal prompt lands and that no ungated send occurs.
  const urgent = section(review, '## Prompt-only urgent escalation', '## Publishing rule');
  expect(clause(urgent, /automation session/i)).toMatch(/run record|Orca conversation/i);
  expect(clause(urgent, /automation session/i)).toMatch(/no `hermes send`[^.]*without[^.]*`escalate`|only[^.]*`escalate`[^.]*send/i);
});

test('sol-5: escalate records and notifies a hold and publishes nothing; only proceed with no unresolved validated blocking finding permits publication', () => {
  const docs = read('docs/workflows.md');
  const section = docs.slice(docs.indexOf('## Automations'), docs.indexOf('## Run record and evidence')).replace(/\s+/g, ' ');
  const ref = compact('skills/axstack/references/automations.md');
  const review = compact('skills/axstack-review/SKILL.md');

  for (const [name, text] of [['workflows', section], ['automations', ref], ['review', review]]) {
    // The gate returns exactly one token.
    expect(text, `${name}: one token`).toMatch(/exactly one (?:literal )?token[^.]*`escalate` or `proceed`/i);
    // escalate -> hold recorded/notified, nothing published.
    const escalate = clause(text, /`escalate`\s*(?:→|->|records|:)/i);
    expect(escalate, `${name}: escalate records a hold`).toMatch(/hold/i);
    expect(escalate, `${name}: escalate publishes nothing`).toMatch(/publishes nothing|nothing is pushed or published|no push or publication/i);
    // proceed -> publication only with no unresolved validated blocking finding.
    const proceed = clause(text, /only `proceed`|`proceed`\s*(?:→|->)/i);
    expect(proceed, `${name}: proceed requires no unresolved validated blocking finding`).toMatch(/no unresolved validated blocking finding/i);
    // The unsafe wording is gone: publication is never conditioned on either token.
    expect(text, `${name}: no either-token publication`).not.toMatch(/publishes only after[^.]*`escalate` or `proceed`|after the gate returns `escalate` or `proceed`/i);
  }
});

test('rev-2 discovery: record-only outside the allowlist, --limit 100 with count==limit as error, mention is a request only after reading the comment', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // Outside the allowlist -> record only: no model work, no escalation, no wake.
  const outside = clause(ref, /Outside the allowlist/i);
  expect(outside).toMatch(/discovers and records only|record(?:s|ed) only/i);
  expect(ref).toMatch(/no review, watch, gate, or other model work[^.]*external PR/i);
  expect(clause(ref, /external changes|external churn/i)).toMatch(/do(?:es)? not enter the wake fingerprint|never wakes? the session/i);
  expect(clause(ref, /external PR contents/i)).toMatch(/never produce an escalation/i);
  expect(ref).not.toMatch(/still receives report-only review/i);
  // Discovery limit -> truncation is an error line.
  expect(ref).toMatch(/--limit 100/);
  expect(clause(ref, /equal to the limit/i)).toMatch(/`error`/);
  // Mention -> request only after reading the comment; incidental mention is not authority.
  const mention = clause(ref, /mention counts as a peer request/i);
  expect(mention).toMatch(/only when the driver reads the comment/i);
  expect(clause(ref, /incidental mention/i)).toMatch(/never review authority/i);
});

test('rev-2 precheck and tick: due control work wakes the driver, the observed fingerprint is promoted verbatim, per-PR event state bounds receipt reuse', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // Due control work (deadline at/before now, pending failed-relay retry) -> exit 0 even when GitHub is unchanged.
  const due = clause(ref, /due control work/i);
  expect(due).toMatch(/deadline at or before now|watch deadline/i);
  expect(due).toMatch(/failed-relay retry/i);
  expect(clause(ref, /Exit 0/)).toMatch(/hash differs or control work is due/i);
  expect(clause(ref, /due deadline/i)).toMatch(/wakes the driver[^.]*even when GitHub is unchanged/i);
  expect(ref).toMatch(/`<ts> <changed\|due\|unchanged\|error\|busy>`/);
  // Observed fingerprint -> promoted verbatim from pending.json, never recomputed.
  const promote = clause(ref, /promotes exactly that value/i);
  expect(promote).toMatch(/never a recomputed one/i);
  expect(clause(ref, /observed fingerprint is written/i)).toMatch(/`pending\.json`/);
  expect(clause(ref, /landing during a run|lands during a run/i)).toMatch(/following tick/i);
  // Per-PR event state -> receipt reuse only on unchanged head+base+scope; new event at unchanged head is new work.
  expect(clause(ref, /Per-PR event state/i)).toMatch(/head SHA, base SHA, check rollup, and processed request and comment IDs/i);
  expect(clause(ref, /receipt is reused only/i)).toMatch(/head, base, and scope are unchanged/i);
  expect(clause(ref, /at an unchanged head/i)).toMatch(/new failing check, base change, review request, or qualifying comment[^.]*new work/i);
  // Deadline is rechecked immediately before any publication.
  expect(clause(ref, /rechecks the deadline/i)).toMatch(/immediately before any publication/i);
  // Sidecar contents.
  expect(clause(ref, /`cursor\.json` \(/)).toMatch(/expired PR list[^.]*watch deadlines[^.]*failed-relay retries/i);
});

test('rev-2 identity and watchdog: effective identity by Orca runtime inspection holds on unknown; thresholds, occurrence id, and the unavailable-gate hold match the spec', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // Driver: inspect before repair or publication; mismatch or unknown -> hold + health finding.
  const driver = clause(ref, /Before any repair or publication/i);
  expect(driver).toMatch(/effective session identity through Orca runtime inspection/i);
  expect(clause(ref, /self-written label/i)).toMatch(/not evidence/i);
  expect(clause(ref, /mismatch or unknown identity/i)).toMatch(/holds repair and publication[^.]*health finding/i);
  // Watchdog: inspect before gate dispatch; unknown -> hold recorded in watchdog.json.
  const watchdog = clause(ref, /Before its gate dispatch/i);
  expect(watchdog).toMatch(/own effective session identity through Orca runtime inspection/i);
  expect(clause(ref, /unknown identity holds the dispatch/i)).toMatch(/`watchdog\.json`/);
  // Thresholds, exactly as the spec lists them.
  const thresholds = clause(ref, /Thresholds:/);
  expect(thresholds).toMatch(/three consecutive `error` lines in `precheck\.log`/);
  expect(thresholds).toMatch(/three consecutive failed (?:driver|A) runs/i);
  expect(thresholds).toMatch(/no successful (?:driver|A) run within two hours while the precheck logged `changed` or `due`/i);
  expect(thresholds).toMatch(/unrequested fresh-session fallback or non-Opus effective identity/i);
  expect(thresholds).toMatch(/`failed` relay receipt older than one tick or any `uncertain` receipt/i);
  expect(thresholds).toMatch(/hold with no owner/i);
  expect(clause(ref, /quiet precheck history/i)).toMatch(/healthy/i);
  // Occurrence id -> dedup while unresolved; recurrence is a new occurrence.
  const occurrence = clause(ref, /occurrence id/i);
  expect(occurrence).toMatch(/\(type, first-observed UTC timestamp\)/);
  expect(clause(ref, /later recurrence/i)).toMatch(/new occurrence/i);
  // Health gate input and the unavailable-gate hold.
  expect(clause(ref, /health gate takes/i)).toMatch(/watchdog finding and its evidence, not reviewer verdicts or a candidate/i);
  expect(clause(ref, /cannot be escalated through itself/i)).toMatch(/hold stays[^.]*no substitute or unauthorized send/i);
  // Failed/uncertain watchdog delivery stays held and visible.
  expect(clause(ref, /Failed or uncertain delivery/i)).toMatch(/visibly held in `watchdog\.json`/i);
  // Four criteria now include the discovery hold.
  expect(clause(ref, /automation health \(/i)).toMatch(/model-substitution, session, precheck, discovery, or relay-delivery hold/i);
});

test('rev-2 review exception: Standalone-owner and Authorized-submission carry the spec wording exactly', () => {
  const review = compact('skills/axstack-review/SKILL.md');
  const owner = section(review, '## Standalone owner', '## Review the candidate');
  expect(owner).toContain('Standalone owner: no separate `axstack-owner` is materialized');
  expect(clause(owner, /no separate `axstack-owner` is materialized/)).toMatch(/Orca driver automation/i);
  const submission = section(review, '## Authorized submission (peer review)', '## Automation publication');
  // Revision 5 pair-scopes this exception. A/B's COMMENT-only guarantee must survive verbatim,
  // and pair C must be routed to the authorized-submission branch.
  expect(submission).toContain('for the pair A/B driver automation the `COMMENT` branch below, with the existing remote head/base readback and ambiguity handling, is the only submission it makes');
  expect(submission).toMatch(/pair C driver automation instead uses this authorized-submission branch and submits the actual verdict on an officially-requested peer PR/);
  expect(submission).toMatch(/mention trigger still takes the `COMMENT` branch/);
  expect(clause(submission, /Authorized submission, pair-scoped:/)).toMatch(/Orca driver automation|pair A\/B driver automation/i);
  // The APPROVE/REQUEST_CHANGES ban is on GitHub actions; the internal verdict vocabulary stays.
  expect(clause(review, /ban on those GitHub actions|prohibition on `APPROVE` and `REQUEST_CHANGES`/i)).toMatch(/internal verdict vocabulary is unchanged/i);
});

test('rev-2 docs: gh stack publication does not apply to automation repairs; they push fast-forward after the gate', () => {
  const docs = compact('docs/workflows.md');
  const rule = clause(docs, /`gh stack` publication does not apply to automation repairs/i);
  expect(rule).toMatch(/fast-forward `git push`/);
  expect(rule).toMatch(/after the gate|after `proceed`/i);
  // The watch bullet no longer routes automation repairs to the original author unconditionally.
  const watch = clause(docs, /`axstack-watch` adopts an existing PR/i);
  expect(docs.slice(docs.indexOf(watch))).toMatch(/original author[^.]*run itself launched|run-launched/i);
});

// --- revision 4: the contract serves two independent pairs -----------------

test('rev-4 pairs: the allowlist is per automation, and the two pairs share no state', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // An automation session must learn which pair it is before it acts.
  expect(clause(ref, /which pair/i)).toMatch(/run id|allowlist/i);
  // The allowlist is per automation, not one global list.
  const allow = clause(ref, /Mutation allowlist/i);
  expect(allow).toMatch(/per automation/i);
  expect(allow).not.toMatch(/initially/i);
  // Each pair's verbatim membership is stated.
  expect(ref).toMatch(/axatbhardwaj\/axstack/);
  expect(ref).toMatch(/defi-com\/monorepo, defi-com\/mobile, defi-com\/azure-next-hybrid/);
  // No shared sidecars between pairs.
  expect(clause(ref, /shares? no state|no sidecar is shared/i)).toMatch(/run id|sidecar|run directory/i);
});

test('rev-4 stacks: repair takes the lowest failing PR and holds descendants instead of duplicating the fix', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const lowest = clause(ref, /lowest open failing PR/i);
  expect(lowest).toMatch(/stack/i);
  // A descendant gets a hold, not a second copy of the same fix.
  const hold = clause(ref, /pending restack/i);
  expect(hold).toMatch(/descendant|child/i);
  // A different finding on a descendant is still repaired.
  expect(clause(ref, /different finding/i)).toMatch(/repaired on its own merits|own merits/i);
  // One clearing rule, and it is exempt from the hold-with-no-owner threshold.
  expect(clause(ref, /cleared by the user's own restack/i)).toMatch(/observed|no longer failing/i);
  expect(clause(ref, /hold with no owner|hold-with-no-owner/i)).toMatch(/exempt/i);
  // Budget counts per stack.
  expect(clause(ref, /per-tick budget counts/i)).toMatch(/one unit per stack/i);
});

test('rev-4 bot feedback: dedup is by review ID and body digest, under explicit caps', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const dedup = clause(ref, /body digest|content digest/i);
  expect(dedup).toMatch(/review ID/i);
  // ID alone is called out as insufficient, with the reason.
  expect(clause(ref, /insufficient/i)).toMatch(/new review ID|re-post/i);
  // Caps: one repair per PR per 24h, and a per-tick push budget with a value.
  expect(clause(ref, /one repair per PR per 24 hours/i)).toBeTruthy();
  expect(clause(ref, /per-tick push budget/i)).toMatch(/six|configured/i);
  // Reaching a cap records a hold naming it; expiry is due control work.
  expect(clause(ref, /Reaching either cap/i)).toMatch(/hold naming the cap/i);
  expect(clause(ref, /cap expires|cap has expired/i)).toMatch(/due control work|wakes the driver/i);
  // A bot review never grants peer-review authority.
  expect(clause(ref, /never satisfies the peer-PR trigger|bot review never/i)).toMatch(/review-requested|explicitly asks/i);
});

test('rev-4 deployment: the repair push hold is branch-name-agnostic and enumerated per repository', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const rule = clause(ref, /deploy-on-push/i);
  expect(rule).toMatch(/never pushes/i);
  expect(rule).toMatch(/recorded hold|is a hold/i);
  // Enumerated from the workflow files, not hardcoded to one branch.
  expect(clause(ref, /enumerated/i)).toMatch(/workflow files|per repository/i);
  expect(clause(ref, /re-verified/i)).toMatch(/before enabling|allowlist change/i);
});

test('rev-4 watch window: C/D roll, A/B expire, and the difference is stated as deliberate', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const rolling = clause(ref, /rolling window/i);
  expect(rolling).toMatch(/open and eligible/i);
  expect(clause(ref, /no expiry/i)).toMatch(/re-arm|merge or close/i);
  // A/B keep the 24h window explicitly, so neither pair inherits the other's rule.
  expect(clause(ref, /24 hours per own PR from first observation/i)).toMatch(/Automation A|axstack pair|A\/B/i);
  // Budgets and the watchdog are named as the replacement cost brakes.
  expect(clause(ref, /cost brake|only brakes/i)).toMatch(/budget/i);
});

test('rev-4 eligibility: drafts wait, requested-reviewer PRs are kept, and mobile has no check signal', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // A draft is recorded but not repaired, and becomes eligible on ready-for-review.
  expect(clause(ref, /draft PR is discovered/i)).toMatch(/never repaired/i);
  expect(clause(ref, /ready for review/i)).toMatch(/new work/i);
  // Human-reviewer-requested PRs are explicitly NOT excluded, with the reason.
  const kept = clause(ref, /human reviewer requested/i);
  expect(kept).toMatch(/not excluded|is eligible/i);
  expect(clause(ref, /would empty the coverage/i)).toBeTruthy();
  // mobile: review feedback only, and the reason is the absent check signal.
  expect(clause(ref, /no workflows and therefore no check signal/i)).toMatch(/actionable review feedback/i);
});

test('rev-4 pair isolation: run ids, run directories and stall windows are per pair', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // Both run ids named, one per pair, with no shared sidecar.
  const runIds = clause(ref, /One run id per pair/i);
  expect(runIds).toMatch(/20260916-pr-automations/);
  expect(runIds).toMatch(/20260916-defi-automations/);
  expect(clause(ref, /no\s+sidecar, record, or cursor is shared/i)).toBeTruthy();
  // D's stall window is re-derived, not the literal two hours.
  const stall = clause(ref, /stall window/i);
  expect(stall).toMatch(/95th-percentile/i);
  expect(clause(ref, /would fire on the first slow tick/i)).toBeTruthy();
  // A/B keeps its literal two-hour threshold.
  expect(ref).toMatch(/no successful driver run within two hours while the precheck logged `changed` or `due`/);
});

// The `clause` helper returns the FIRST sentence matching a trigger, so a
// trigger that also appears in a heading, a summary line or a list item can
// silently assert against the wrong sentence and pass for the wrong reason.
// Every revision-4 trigger must therefore be unique in the reference.
test('rev-4 triggers are unambiguous: each one matches exactly one sentence', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const sentences = ref.split(/(?<=[.!?])\s+(?=[A-Z`*(])/);
  const triggers = [
    /lowest open failing PR/i,
    /different finding/i,
    /cleared by the user's own restack/i,
    /per-tick budget counts/i,
    /body digest|content digest/i,
    /one repair per PR per 24 hours/i,
    /per-tick push budget/i,
    /Reaching either cap/i,
    /deploy-on-push/i,
    /rolling window/i,
    /draft PR is discovered/i,
    /human reviewer requested/i,
    /no workflows and therefore no check signal/i,
    /One run id per pair/i,
    /stall window/i,
  ];
  for (const trigger of triggers) {
    const hits = sentences.filter((s) => trigger.test(s));
    expect(hits.length, `${trigger} matches ${hits.length} sentences, expected 1`).toBe(1);
  }
});

test('rev-4 draft transition is observable for C/D only, leaving A/B unchanged', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // Draft status is queried, hashed and scoped to C/D in one sentence.
  const query = clause(ref, /`isDraft`/);
  expect(query).toMatch(/pair\s+C\/D only/i);
  expect(query).toMatch(/hashed fingerprint/i);
  expect(query).toMatch(/wakes the driver/i);
  // A/B's queried fields and fingerprint are explicitly unchanged.
  expect(query).toMatch(/pair A\/B's queried fields and fingerprint are unchanged/i);
  expect(ref).toMatch(/`gh pr view --json headRefOid,baseRefOid,statusCheckRollup`/);
  // The true->false transition is new work for C/D, named as such.
  expect(clause(ref, /draft status that has changed from true to false/i)).toMatch(/new work for C\/D/i);
});

test('rev-4 run record: deadline and expired fields are pair A/B only', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const stored = clause(ref, /watch deadline and `expired` fields are/i);
  expect(stored).toMatch(/pair A\/B only/i);
  expect(stored).toMatch(/cannot reach `expired`/i);
  expect(stored).toMatch(/draft status is pair C\/D only/i);
});

test('rev-4 scheduling and caps are qualified: four distinct minutes, caps are C/D only', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // All four automations, not just the two of one pair.
  const minutes = clause(ref, /dispatch minute/i);
  expect(minutes).toMatch(/four automations/i);
  expect(minutes).toMatch(/A, B, C and D/);
  // The repair-cap due-work trigger belongs to C/D, which is the only pair with caps.
  expect(clause(ref, /cap that has expired/i)).toMatch(/pair C\/D only/i);
});

// --- revision 5: pair C submits binding verdicts, pair A/B stays COMMENT-only ---

test('rev-5 verdict authority is pair-scoped: C submits verdicts, A/B and D do not', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // The prohibition is no longer blanket: it names the pairs it still binds.
  // The blanket prohibition keeps the always-forbidden mutations for all four.
  expect(ref).toMatch(/\*\*Prohibited everywhere:\*\* force-push, rebase, merge, close\./);
  // The verdict prohibition is pair-scoped and names exactly who it still binds.
  expect(ref).toMatch(/`APPROVE` and `REQUEST_CHANGES`\*\* are prohibited for Automations A, B and D/);
  expect(ref).toMatch(/Automation C may submit them under "Binding review verdicts \(pair C\)" below\s*and nowhere else/);
  // C's authority exists, is peer-only, and needs an official request.
  const authority = clause(ref, /A binding verdict is submitted only/i);
  expect(authority).toMatch(/officially review-requested/i);
  expect(authority).toMatch(/authored by someone else/i);
  // A mention-triggered peer review stays COMMENT.
  expect(clause(ref, /mention trigger/i)).toMatch(/`COMMENT`/);
  // D still writes nothing to GitHub.
  expect(ref).toMatch(/Automation D never (?:mutates|writes)/i);
});

test('rev-5 blocking obligations are tracked, wake C, and can clear themselves', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // Durable obligation record, polled by URL outside discovery.
  const obligation = clause(ref, /obligation/i);
  expect(obligation).toBeTruthy();
  expect(ref).toMatch(/removes self from[^.]*review-requested|no longer returns the PR/i);
  expect(clause(ref, /polls those PRs directly by URL|polled directly by URL/i)).toBeTruthy();
  // Outstanding obligations are due control work in the precheck list.
  expect(clause(ref, /due control work/i)).toMatch(/obligation/i);
  // The self-resolve authority exists and follows the chain.
  expect(clause(ref, /obligation chain/i)).toMatch(/inherits/i);
  // Supersession is capped per head.
  expect(clause(ref, /one superseding verdict per head|one supersede per head/i)).toBeTruthy();
});

test('rev-5 local review file follows the workspace naming convention', () => {
  const ref = compact('skills/axstack/references/automations.md');
  const file = clause(ref, /review-PR-<num>\.html/);
  expect(file).toMatch(/monorepo/i);
  expect(ref).toMatch(/review-azure-next-hybrid-PR-<num>\.html/);
  expect(clause(ref, /failure to write the file|could not be written/i)).toMatch(/hold/i);
});

test('rev-5 repair scope: a review-only repository never reaches repair', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // C/D carries two lists, and the review-only repo is named as such.
  expect(ref).toMatch(/review allowlist `defi-com\/monorepo, defi-com\/mobile,\s*defi-com\/azure-next-hybrid`/);
  expect(ref).toMatch(/repair allowlist `defi-com\/monorepo, defi-com\/mobile`/);
  expect(clause(ref, /review-only: its own PRs/i)).toMatch(/never repaired and never pushed to/i);
  // Each action reads its own list, and the driver tick gates repair on the repair list.
  expect(clause(ref, /each action reads its own\s*list/i)).toMatch(/reviewed and never repaired/i);
  // The driver tick gates repair on the repair list, in the same sentence as the route.
  const tick = clause(ref, /only when its repository is on the acting automation's repair/i);
  expect(tick).toMatch(/axstack-watch/);
  expect(tick).toMatch(/no repair, no worktree and no push/i);
});

test('rev-5 obligations appear in the precheck due-work list and the cursor schema', () => {
  const ref = compact('skills/axstack/references/automations.md');
  // The due-work list the precheck actually reads must name obligations.
  expect(clause(ref, /for due control work:/i)).toMatch(/outstanding blocking-review obligation/i);
  // The cursor sidecar schema must carry them with enough state to resolve one.
  const cursor = clause(ref, /last processed fingerprint promoted verbatim/i);
  expect(cursor).toMatch(/outstanding blocking-review\s*obligations for pair C only/i);
  expect(cursor).toMatch(/review id/i);
  expect(cursor).toMatch(/one supersede is still available/i);
});
