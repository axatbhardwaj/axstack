import { test, expect } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Structural instruction-contract checks for docs/specs/debug.md rev 3. They
// verify the declared ladder, packet, record, and boundaries, not whether a
// model will follow them; behavioral evidence lives in the run record.

const SKILL = 'skills/axstack-debug/SKILL.md';
const PACKET = 'skills/axstack-debug/references/packet.md';

test('debug: skill is discoverable and diagnoses without landing a change', () => {
  expect(existsSync(`${root}/${SKILL}`)).toBe(true);
  const text = compact(SKILL);
  expect(text).toMatch(/description: When [^\n]*use axstack-debug/);
  expect(text).toMatch(/never (?:lands|commits|pushes|publishes)[^.]*product change/i);
  expect(text).toMatch(/axstack-explain[^.]*how[^.]*works|how[^.]*works[^.]*axstack-explain/i);
  expect(text).toMatch(/diagnosis record/i);
  expect(text).toMatch(/axstack-implement/);
});

test('debug: seven gated phases with the loop completion criterion and redaction', () => {
  const text = compact(SKILL);
  for (const phase of ['Loop', 'Reproduce and minimise', 'State and recent change', 'Hypothesise', 'Probe', 'Root cause and seam', 'Record and hand off']) {
    expect(text, `phase ${phase}`).toContain(phase);
  }
  expect(text).toMatch(/one[^.]*agent-runnable command[^.]*red[^.]*exact symptom/i);
  expect(text).toMatch(/fast[^.]*deterministic|deterministic[^.]*fast/i);
  expect(text).toMatch(/flaky[^.]*sample count[^.]*observed failures[^.]*duration[^.]*seed/i);
  expect(text).toMatch(/theory before the loop|before the loop exists/i);
  expect(text).toMatch(/cannot be built[^.]*stop, list what was tried, and ask/i);
  expect(text).toMatch(/redact[^.]*secrets?[^.]*before/i);
  expect(text).toMatch(/one[^.]*strongly supported hypothesis[^.]*enough/i);
  expect(text).toMatch(/never invent[^.]*quota/i);
  expect(text).toMatch(/tagged[^.]*unique prefix|unique prefix/i);
  expect(text).toMatch(/one variable at a time/i);
  expect(text).toMatch(/failed probe is not a failed fix/i);
  expect(text).toMatch(/seam[^.]*NONE|NONE[^.]*seam/);
  expect(text).toMatch(/sweep[^.]*same pattern/i);
});

test('debug: fix attempts are defined and the ladder has three rungs with exact triggers', () => {
  const text = compact(SKILL);
  expect(text).toMatch(/fix attempt[^.]*one coherent repair[^.]*predicted[^.]*green/i);
  expect(text).toMatch(/implementation slip[^.]*(?:does not|never) count/i);
  expect(text).toMatch(/probe never counts|probe[^.]*never counts/i);
  expect(text).toMatch(/ledger[^.]*carries across|imports known attempts/i);
  expect(text).toMatch(/on resume[^.]*re-verifies the packet hash[^.]*re-run the loop red/i);
  for (const rung of ['L0', 'L1', 'L2']) expect(text).toContain(rung);
  expect(text).toMatch(/\| L0 \|.{0,80}at most one fix attempt/i);
  expect(text).toMatch(/\| L1 \| the L0 fix attempt failed/i);
  expect(text).toMatch(/second failure|second fix attempt failed/i);
  expect(text).toMatch(/before any third/i);
  expect(text).toMatch(/L1 is inadmissible without a red loop/i);
  expect(text).toMatch(/\| L2 \|.{0,400}architecture.{0,400}the user decides/i);
});

test('debug: adviser rule, plan merge, fan-out floor and completion are explicit', () => {
  const text = compact(SKILL);
  expect(text).toMatch(/ordinary diagnos\w+[^.]*not a high-stakes decision/i);
  expect(text).toMatch(/mixed[^.]*both advisers[^.]*both receipts/i);
  expect(text).toMatch(/single-provider[^.]*one configured adviser/i);
  expect(text).toMatch(/high-stakes[^.]*serious-risk[^.]*override/i);
  expect(text).toMatch(/configured but unavailable[^.]*holds? L1 and L2/i);
  expect(text).toMatch(/de-duplicates?[^.]*ranks? the union with reasons recorded in the run record/i);
  expect(text).toMatch(/briefs? [<≤]=? seats|briefs? (?:never exceed|at most)[^.]*seats/i);
  expect(text).toMatch(/untested \(queued\)|recorded as untested/i);
  expect(text).toMatch(/one bounded adviser replan/i);
  expect(text).toMatch(/at least two[^.]*investigators[^.]*(?:launch|start)[^.]*verified identity/i);
  expect(text).toMatch(/at least two usable independent[^.]*receipts/i);
  expect(text).toMatch(/driver-run[^.]*never replace|never replace[^.]*driver-run/i);
  expect(text).toMatch(/confirmed, refuted, inconclusive, blocked[^.]*untested/i);
  expect(text).toMatch(/never by vote/i);
});

test('debug: isolation by disposable worktree with preserved evidence and hermetic loop', () => {
  const text = compact(SKILL);
  expect(text).toMatch(/disposable worktree[^.]*pinned revision[^.]*dirty patch/i);
  expect(text).toMatch(/hash-verified/i);
  expect(text).toMatch(/re-runs? the original loop red/i);
  expect(text).toMatch(/never commits, pushes, publishes, or creates children/i);
  expect(text).toMatch(/probe diff or script[^.]*command and output[^.]*receipt[^.]*preserved/i);
  expect(text).toMatch(/sole `?progress\.md`? writer/i);
  expect(text).toMatch(/hermetic/i);
  expect(text).toMatch(/isolates files, not shared or live systems/i);
  expect(text).toMatch(/reset and restore steps/i);
  expect(text).toMatch(/requested and effective settings[^.]*separately/i);
});

test('debug: packet, brief, record, and repair classes carry every spec field', () => {
  expect(existsSync(`${root}/${PACKET}`)).toBe(true);
  const packet = compact(PACKET);
  for (const field of [
    'symptom verbatim', 'base and candidate SHA', 'dirty-patch', 'prerequisites',
    'setup and reset steps', 'exact assertion', 'original output', 'minimised repro',
    'prior attempt', 'already refuted', 'allowed reads', 'scratch location',
    'excluded systems', 'probe budget',
  ]) expect(packet, `packet field ${field}`).toMatch(new RegExp(field, 'i'));
  for (const field of ['hypothesis ID', 'prediction', 'discriminating probe', 'falsification criterion', 'stop criterion']) {
    expect(packet, `brief field ${field}`).toMatch(new RegExp(field, 'i'));
  }
  expect(packet).toMatch(/one credible alternative hypothesis/i);
  for (const line of [
    'Bug:', 'Revision:', 'Loop:', 'Hermetic:', 'Minimised repro:', 'State/recent change:',
    'Hypotheses:', 'Root cause:', 'Seam:', 'Pattern sweep:', 'Rung reached:', 'Fixes tried:',
    'Adviser receipts:', 'Investigator receipts:', 'Cleanup:', 'Repair class:', 'Lesson:',
  ]) expect(packet, `record line ${line}`).toContain(line);
  expect(packet).toMatch(/bounded[^|]*small-change intent/i);
  expect(packet).toMatch(/substantial[^|]*spec route/i);
  expect(packet).toMatch(/unresolved[^|]*investigation continues/i);
  expect(packet).toMatch(/NONE seam[^.]*TDD gap/i);
  expect(packet).toMatch(/both the original loop and the minimised repro/i);
});

test('debug: shared references route to the skill and carry its contracts', () => {
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/red loop[^.]*-> `axstack-debug`|-> `axstack-debug`/);
  expect(routing).toMatch(/axstack-debug-investigator-1/);
  expect(read('skills/axstack/references/routing.md').length).toBeLessThan(7500);
  const contracts = compact('skills/axstack/references/contracts.md');
  expect(contracts).toMatch(/axstack-debug/);
  expect(contracts).toMatch(/ordinary diagnos\w+[^.]*configured adviser/i);
  expect(contracts).toMatch(/high-stakes[^.]*override/i);
  expect(contracts).toMatch(/packet[^.]*unchanged/i);
  const implement = compact('skills/axstack-implement/SKILL.md');
  expect(implement).toMatch(/diagnosis record[^.]*bounded[^.]*small-change intent/i);
  expect(implement).toMatch(/implementation slip[^.]*(?:does not|never)[^.]*ledger/i);
  const audit = compact('skills/axstack-audit/SKILL.md') + ' ' + compact('skills/axstack-audit/references/record.md');
  expect(audit).toMatch(/Debug: <[^>]*rung/i);
  expect(compact('README.md')).toMatch(/axstack-debug/);
  expect(compact('docs/workflows.md')).toMatch(/axstack-debug/);
});

test('debug: scenario corpus carries the twenty spec cases', () => {
  const data = JSON.parse(read('tests/workflows/debug-scenarios.json'));
  expect(data.version).toBe(1);
  const ids = data.cases.map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const required of [
    'easy-bug-l0', 'loop-unbuildable', 'probe-failure-vs-fix-failure', 'implementation-slip',
    'first-fix-failed-fanout', 'advisers-disagree-ranking', 'five-hypotheses-four-seats',
    'zero-investigators', 'one-investigator', 'two-investigators', 'decisive-probe-blocked',
    'contradictory-receipts', 'shared-state-loop', 'single-provider-l1',
    'instrumentation-denied', 'dirty-revision-resume', 'second-failure-l2',
    'unknown-root-cause', 'none-seam', 'flaky-false-green',
  ]) expect(ids, `missing case ${required}`).toContain(required);
  const decisionLocks = {
    'easy-bug-l0': /no adviser or investigator dispatch/i,
    'loop-unbuildable': /list what was tried[\s\S]*no advisers/i,
    'probe-failure-vs-fix-failure': /fix attempts remain 0[\s\S]*L1 is not triggered/i,
    'implementation-slip': /ledger stays at 0/i,
    'first-fix-failed-fanout': /Astra and Fable independently[\s\S]*untested \(queued\)/i,
    'advisers-disagree-ranking': /only hypotheses both advisers refute are dropped[\s\S]*no vote/i,
    'five-hypotheses-four-seats': /fifth as untested \(queued\)/i,
    'zero-investigators': /hold[\s\S]*no substitution[\s\S]*L1 is not satisfied/i,
    'one-investigator': /below the two-seat floor/i,
    'two-investigators': /two usable independent receipts/i,
    'decisive-probe-blocked': /record blocked[\s\S]*hold dependent conclusions/i,
    'contradictory-receipts': /one discriminating rerun[\s\S]*never[\s\S]*vote/i,
    'shared-state-loop': /parameterise[\s\S]*serialise[\s\S]*hold the probe/i,
    'single-provider-l1': /Astra alone[\s\S]*intentional absence[\s\S]*override/i,
    'instrumentation-denied': /do not add instrumentation/i,
    'dirty-revision-resume': /import the known attempt[\s\S]*re-verify the packet hash[\s\S]*re-run the loop red/i,
    'second-failure-l2': /no third attempt until the user decides/i,
    'unknown-root-cause': /UNKNOWN[\s\S]*unresolved/i,
    'none-seam': /Seam: NONE[\s\S]*scoped decision/i,
    'flaky-false-green': /200 runs, 0 failures/i,
  };
  for (const c of data.cases) {
    expect(c.skill_ref, `${c.id} skill_ref`).toBe('axstack-debug');
    expect(c.expected.decision, `${c.id} decision body`).toMatch(decisionLocks[c.id]);
    expect(typeof c.input.request).toBe('string');
    expect(typeof c.input.facts).toBe('string');
    expect(typeof c.expected.decision).toBe('string');
    expect(Array.isArray(c.expected.forbidden) && c.expected.forbidden.length > 0, `${c.id} forbidden`).toBe(true);
  }
});
