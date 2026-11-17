import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

const hasRetiredActivationGate = (text) => sentences(text).some((sentence) => {
  const clause = sentence.replace(/\bChrome Canary\b|\bcanary releases?\b/gi, '');
  if (/\b(?:does|do|need) not (?:require|need|wait)\b|\bno longer\b/i.test(clause)) return false;
  const schedule = /\b(?:activat\w*|enabl\w*|disabl\w*|paused|turn\b[^.;!?]*\bon)\b/i.test(clause);
  // Weekly audit's removed canary condition used "admission". Ordinary
  // per-pass ownership/admission proofs are outside this retirement guard.
  const canary = /\bcanar(?:y|ies)\b/i.test(clause)
    && (schedule || /\badmission\b/i.test(clause));
  const outcome = schedule
    && /\b(?:before|until|only (?:after|once)|requir\w*|needs?|must|gated|wait\w*)\b/i.test(clause)
    && /\b(?:live|native|trial|prov\w*|verif\w*|validat\w*|demonstrat\w*|evidence|shown)\b/i.test(clause)
    && /\b(?:overlap\w*|concurrent|simultaneous|killed[\s-]+predecessor|storage[\s-]+limit|temporary[\s-]+limit|real[\s-]+(?:PR|event)|host validation)\b/i.test(clause);
  return canary || outcome;
});

test.each([
  ['gate after a disclaimer', 'This is prompt policy, not an atomic lock: the overlap canary must demonstrate one admission owner before activation.', true],
  ['reworded requirement', 'Before activation, a live trial must run two overlapping run_scheduled_task_now passes proving one admission owner, reconcile a killed predecessor, and show the limit disables the schedule.', true],
  ['harmless product name', 'Chrome Canary builds are not supported.', false],
  ['overlap prerequisite', 'Enablement requires live proof that simultaneous passes admit only one owner.', true],
  ['predecessor prerequisite', 'Before enabling the schedule, a live trial must verify recovery of a killed predecessor.', true],
  ['storage prerequisite', 'Activation waits for live evidence that a temporary storage limit disables the schedule.', true],
  ['event prerequisite', 'Only after a live trial reviews one real PR event may activation proceed.', true],
  ['negative enablement gate', 'Do not enable the schedule until live proof shows overlapping passes have one owner.', true],
  ['negated requirement', 'Activation does not require live proof of overlapping passes.', false],
  ['runtime uncertainty', 'Source checks do not prove live overlap or predecessor recovery.', false],
  ['authority safeguard', 'Missing authority holds activation.', false],
  ['undefined host validation', 'Activation needs live host validation.', true],
  ['L1 weekly activation', 'The native canary below is also required before weekly activation.', true],
  ['L2 manager activation', 'The review manager runs every 30 minutes and requires its separate native canary before activation.', true],
  ['L3 named outcomes', 'The overlap, real-event, killed-predecessor, and storage-limit canaries must pass before activation.', true],
  ['L4 operational contract', 'Activation still requires the native canary described by the operational contract.', true],
  ['L5 weekly setup', 'Before enabling the schedule, pass the [native activation canary](../skills/axstack/references/automations.md): fresh pass threads, overlap admission, killed-predecessor recovery, capacity and bounded retained worktrees.', true],
  ['L6 authority or canary', 'Missing authority, or no passing native canary, holds activation.', true],
  ['L7 weekly admission', 'Missing authority, or no passing native canary from [Automations](automations.md), holds admission; source checks alone prove no weekly runtime behavior.', true],
  ['R1 negative prerequisite', 'Activation must not proceed until a live trial shows overlapping passes keep one owner.', true],
  ['R2 turn on', 'Turn the schedule on only once a live run has shown that a killed predecessor is reconciled.', true],
  ['R3 disabled overlap', 'Keep the schedule disabled until a native test proves two concurrent passes admit one owner.', true],
  ['R4 weekly canary', 'Weekly activation is gated on a passing live canary.', true],
  ['R5 disabled storage', 'Leave the schedule disabled until the storage limit has been proven live to stop new pass worktrees.', true],
  ['H1 canary release', 'A canary release ships the CLI to one host before the rest of the fleet.', false],
  ['H2 per-pass admission', 'Admission requires verified evidence that any overlapping earlier pass has exited.', false],
  ['H3 per-pass ownership', 'Before admission, verify that no overlapping pass owns the PR.', false],
  ['H4 watch authority', 'Before enabling chat-run watch, verify the PR is open.', false],
  ['H5 runtime disclaimer', 'Live overlap, recovery and storage-limit behavior remain unproven; the drift check proves only prompt bytes.', false],
])('retirement guard: %s', (_name, text, gated) => {
  expect(hasRetiredActivationGate(text)).toBe(gated);
});

// Frozen from 6589b7af: outcome sentences belong to this activation section.
test('retired activation block is rejected in its original context', () => {
  const block = [
    '## Activation canary',
    'The canary runs two overlapping `run_scheduled_task_now` passes and proves one admission owner per PR.',
    'The canary reviews or correctly no-ops one real PR event.',
    'The canary reconciles a killed predecessor and demonstrates wedged-pass recovery: exactly one successor interrupts and retires a wedged predecessor.',
    'With a temporary limit equal to the current count, the canary disables the schedule and verifies that the following interval creates zero new pass worktrees.',
    'The previous review-manager automation is disabled, never deleted, only after all four T3 canary checks pass.',
    'Live VPS activation and the four canary outcomes remain unverified until exercised.',
  ].join('\n');
  expect(hasRetiredActivationGate(block)).toBe(true);
});

test('manager and weekly scheduling no longer require the retired activation canary', () => {
  for (const path of [
    'README.md',
    'skills/axstack/references/automations.md',
    'skills/axstack/references/lifecycle.md',
    'skills/axstack/references/test-audit-weekly.md',
    'docs/host-operations.md',
    'docs/workflows.md',
    'tests/workflows/pr-manager-scenarios.json',
    'tests/workflows/tracking-scenarios.json',
  ]) {
    const sources = [];
    if (path.endsWith('.json')) {
      JSON.parse(read(path), (_key, value) => {
        if (typeof value === 'string') sources.push(value);
        return value;
      });
    } else sources.push(read(path));
    for (const source of sources) {
      expect(hasRetiredActivationGate(source), `${path}: ${source}`).toBe(false);
    }
  }
});

// Source-contract regression checks, not model or live-runtime proof.
test('scheduled manager uses fresh T3 pass threads and guarded predecessor retirement', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toContain('`bindToCurrentThread:false`');
  expect(text).toContain('A confirmed live manager for the same lane remains authoritative');
  expect(text).toContain('never checks out a PR branch');
  expect(compact('skills/axstack/references/review-manager-prompt.md')).toContain('fresh finite T3 review-manager pass');
  expect(text).toMatch(/t3_thread_organize[^.]*metadata only[^.]*guarded Git worktree removal/i);
  expect(text).not.toMatch(/new isolated workspace for every scheduled pass|repo-created worktree mode|terminal close --worktree|earlier pass workspaces/);
});

test('settled PR jobs release terminals and retire both worktree levels after archive', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toContain('t3_thread_organize');
  expect(text).toMatch(/private evidence archive[\s\S]*?read back[\s\S]*?axstack-cleanup[\s\S]*?reviewer and PR-job worktrees/i);
  expect(text).toMatch(/merged or closed PR[^.]*never[^.]*keep a job worktree/i);
  expect(text).toMatch(/dirty source[\s\S]*?unpushed commits[\s\S]*?salvage path/i);
  expect(text).toMatch(/`user_takeover`[^.]*unknown liveness[^.]*ambiguous publication/i);
});

test('continuity stays bounded', () => {
  const text = compact('skills/axstack/references/automations.md');
  const record = compact('skills/axstack/references/run-record.md');
  expect(text).toContain('[Run record](run-record.md)');
  expect(text).not.toContain('Append older pass history');
  expect(record).toMatch(/current lane state[^.]*open holds[^.]*watermarks[^.]*last pass summary/i);
  expect(record).toMatch(/superseded history[^.]*separate history file beside/i);
  expect(record).toMatch(/never re-read history[^.]*by default/i);
  expect(text).not.toMatch(/self-close|self-retirement|three-workspace threshold/);
});

test('manual invocations do not enter scheduled lifecycle', () => {
  for (const skill of ['review', 'watch']) {
    const text = read(`skills/axstack-${skill}/SKILL.md`);
    expect(text).toMatch(/Manual (review|watch) keeps the user’s chat and workspace open/);
  }
  expect(read('skills/axstack-watch/SKILL.md')).not.toMatch(/scheduled pass|watch-manager/i);
});


// Rev 4 safety sentences are deliberate exact-text contracts (normalised whitespace).
const safety = [
  'A pass never admits a PR owned by a live or uncertain earlier pass.',
  'Missing ordering or ownership evidence holds admission and never guesses a winner.',
  'A truncated or failed inventory holds admission and cleanup.',
  'A binding mismatch holds admission.',
  'A missing, non-durable or unreadable continuity path holds admission.',
  'Lane identity requires exact thread/run identity, never a title or directory-name guess; never infer lane ownership from an empty local workspace.',
  'A firing timestamp proves neither delivery nor useful completion.',
  "The orphan sweep covers the run record's repositories plus registered repositories on this host.",
  'Past the authorized storage limit (default 20 retained lane worktrees), disable the schedule with `update_scheduled_task` using `enabled:false` and hold.',
  'A repository without a host clone is a held job.',
];
for (const sentence of safety) {
  test(`T3 manager safety: ${sentence}`, () => {
    const accepts = (text) => text.replace(/\s+/g, ' ').includes(sentence);
    const text = compact('skills/axstack/references/automations.md');
    expect(accepts(text)).toBe(true);
    expect(accepts(text.replace(sentence, ''))).toBe(false);
    expect(accepts(text.replace(sentence, `Do not follow: ${sentence.replace(/^(\S+)/, '$1 not')}`))).toBe(false);
  });
}

import { requires, prohibits, sentences, checkRule } from './prose-contract.js';
const rules = [
  ['lane', [/T3 project/i, /axstack-review-lane/, /VPS/, /existing/, /axatbhardwaj\/axstack/, /origin/, /main/],
    'On the VPS, the existing axatbhardwaj/axstack clone with origin and main must host T3 project axstack-review-lane.'],
  ['pass base', [/unbound/i, /worktrees?/i, /origin\/main/, /fetch/i, /first/i],
    'Every unbound pass must fetch first and base its worktree on origin/main.'],
  ['continuity', [/continuity/i, /~\/\.local\/share\/axstack\/runs\/review-manager\/progress\.md/, /outside/i, /worktrees?/i],
    'Continuity must remain outside worktrees at ~/.local/share/axstack/runs/review-manager/progress.md.'],
  ['binding', [/lane thread/i, /t3_thread_read/, /axstack-owner/, /read.?back/i],
    'The lane thread must use axstack-owner and verify the readback through t3_thread_read.'],
  ['schedule', [/schedule_task/, /packaged prompt/i, /everyMs:1800000/, /bindToCurrentThread:false/, /stable/i, /clientRequestId/],
    'With a stable clientRequestId, schedule_task must use the packaged prompt, everyMs:1800000 and bindToCurrentThread:false.'],
  ['pass configuration', [/each pass/i, /compar/i, /native task status and thread reads/i, /recorded binding/i],
    'Each pass must compare native task status and thread reads with the recorded binding.'],
  ['ordering', [/earlier pass/i, /wins/i, /ordering evidence/i],
    'With ordering evidence, the earlier pass must be the one that wins.'],
  ['inventory', [/discovery/i, /every page/i, /PRs/, /threads/i],
    'Discovery must read every page of threads and PRs.'],
  ['growth', [/owner-of-record pass/i, /retire/i, /settled predecessor/i],
    'The owner-of-record pass must retire settled predecessor passes.'],
  ['growth report', [/each pass/i, /report/i, /retained worktree count/i],
    'Each pass must report the retained worktree count.'],
];
for (const [name, concepts, holdout] of rules) {
  test(`T3 manager rule: ${name}`, () => {
    const text = read('skills/axstack/references/automations.md');
    expect(requires(text, ...concepts)).toBe(true);
    expect(requires(sentences(text).filter((sentence) => !requires(sentence, ...concepts)).join('. '), ...concepts)).toBe(false);
    expect(requires(holdout, ...concepts)).toBe(true);
    expect(requires(holdout.replace('must', 'must not'), ...concepts)).toBe(false);
  });
}

const duplicateRules = [
  ['owner retires terminal duplicates',
    (text) => requires(text, /only.*owner-of-record pass/i, /retir/i,
      /settled predecessor/i, /terminal duplicates/i, /including.*duplicates/i,
      /newer than|started after/i, /owner/i, /immediately|right after/i, /successor takeover/i),
    'Only the owner-of-record pass must retire settled predecessors and terminal duplicates, including duplicates that started after the owner and right after successor takeover.',
    [[/only.*owner-of-record pass/i, 'any duplicate pass'],
      [/including/i, 'excluding'], [/immediately|right after/i, 'only on a later pass']]],
  ['terminal duplicate eligibility',
    (text) => prohibits(text, /(?:no|zero) descendants/i, /qualifying duplicates|duplicates qualify/i,
      /(?<!non-)\bterminal run/i, /\b(?:only|exclusively)\b/i, /own.*(?:pass )?note/i),
    'Qualifying duplicates have a terminal run, zero descendants and only wrote their own pass note.',
    [[/terminal run/i, 'non-terminal run'], [/(?:no|zero) descendants/i, 'active descendants'],
      [/only.*own pass note/i, 'shared continuity writes']]],
  ['retirement settles remaining sidebar threads in the same pass',
    (text) => requires(text, /(?:retirement|retiring)[^()]*\bsettles?\b[^()]*threads?/i, /duplicates?/i,
      /threads?/i, /t3_thread_organize/i, /before|ahead of/i, /guarded/i, /Git/i, /worktree removal/i),
    'While retiring a duplicate, settle its thread via t3_thread_organize (settle/archive is metadata only) ahead of separate guarded Git worktree removal.',
    [[/\bsettles?\b/i, 'leaves unsettled'], [/before|ahead of/i, 'after'],
      [/\bsettles?\b/i, 'requires already-settled']]],
];
for (const [name, accepts, rewording, inversions] of duplicateRules) {
  test(`terminal duplicate recovery: ${name}`, () => {
    const text = compact('skills/axstack/references/automations.md')
      .split('## Finite-session teardown')[1].split('## Recovery and limits')[0];
    checkRule(text, accepts, rewording, inversions);
  });
}

for (const [path, name, concepts, rewording, inversions] of [
  ['automations.md', 'binding comparison follows recorded instance update',
    [/each pass/i, /compares/i, /native task status and thread reads/i, /recorded binding/i,
      /after any owner-only instance update/i, /Provider bindings/i, /before admission/i],
    'After any owner-only instance update under Provider bindings, each pass compares native task status and thread reads with the recorded binding before admission.',
    [[/after any owner-only instance update/i, 'before any owner-only instance update']]],
  ['review-manager-prompt.md', 'ownership precedes shared routing and admission checks',
    [/reconcile lane ownership and duplicate status/i, /then follow Provider bindings/i,
      /shared schedule recreation and recorded instance update/i, /before verifying/i,
      /recorded axstack-owner binding/i, /before admission/i],
    'Before verifying the recorded axstack-owner binding before admission, reconcile lane ownership and duplicate status, then follow Provider bindings for shared schedule recreation and recorded instance update.',
    [[/reconcile lane ownership and duplicate status/i, 'ignore lane ownership and duplicate status'],
      [/before verifying/i, 'after verifying']]],
]) test(`manager account routing: ${name}`, () => {
  const text = sentences(read(`skills/axstack/references/${path}`).replace(/`/g, '')).join('. ');
  checkRule(text, (source) => requires(source, ...concepts), rewording, inversions, concepts);
});
