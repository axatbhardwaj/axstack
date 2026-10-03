import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Source-contract regression checks, not model or live-runtime proof.
test('scheduled manager uses fresh T3 pass threads and guarded predecessor retirement', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toContain('`bindToCurrentThread:false`');
  expect(text).toContain('A confirmed live manager for the same lane remains authoritative');
  expect(text).toContain('never checks out a PR branch');
  expect(compact('skills/axstack/references/review-manager-prompt.md')).toContain('fresh finite T3 review-manager pass');
  expect(text).toMatch(/failed scheduled run alone proves neither predecessor exit nor release/i);
  expect(text).toMatch(/t3_thread_organize[^.]*metadata only[^.]*guarded Git worktree removal/i);
});

test('settled PR jobs release terminals and retire both worktree levels after archive', () => {
  const text = compact('skills/axstack/references/automations.md');
  expect(text).toContain('t3_thread_organize');
  expect(text).toMatch(/private evidence archive[\s\S]*?read back[\s\S]*?axstack-cleanup[\s\S]*?reviewer and PR-job worktrees/i);
  expect(text).toMatch(/merged or closed PR[^.]*never[^.]*keep a job worktree/i);
  expect(text).toMatch(/dirty source[\s\S]*?unpushed commits[\s\S]*?salvage path/i);
  expect(text).toMatch(/`user_takeover`[^.]*unknown liveness[^.]*ambiguous publication/i);
});

test('continuity stays bounded and both command kinds use private run TMPDIR', () => {
  const text = compact('skills/axstack/references/automations.md');
  const record = compact('skills/axstack/references/run-record.md');
  expect(text).toContain('[Run record](run-record.md)');
  expect(text).not.toContain('Append older pass history');
  expect(record).toMatch(/current lane state[^.]*open holds[^.]*watermarks[^.]*last pass summary/i);
  expect(record).toMatch(/superseded history[^.]*separate history file beside/i);
  expect(record).toMatch(/never re-read history[^.]*by default/i);
  expect(text).toMatch(/TMPDIR[^.]*manager and job commands[^.]*<run dir>\/evidence\/<dispatch>\//i);
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
  'Predecessor exit requires exact thread/run identity and terminal run evidence; a completed run row alone does not prove the work settled.',
  'A firing timestamp proves neither delivery nor useful completion.',
  "The orphan sweep covers the run record's repositories plus registered repositories on this host.",
  'Past the authorized storage limit (default 20 retained lane worktrees), disable the schedule with `update_scheduled_task` using `enabled:false` and hold.',
  'The previous review-manager automation is disabled, never deleted, only after all four T3 canary checks pass.',
  'The canary reviews or correctly no-ops one real PR event.',
  'A repository without a host clone is a held job.',
  'With a temporary limit equal to the current count, the canary disables the schedule and verifies that the following interval creates zero new pass worktrees.',
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

import { requires, sentences } from './prose-contract.js';
const rules = [
  ['lane', [/T3 project/i, /axstack-review-lane/, /VPS/, /existing/, /axatbhardwaj\/axstack/, /origin/, /main/],
    'On the VPS, the existing axatbhardwaj/axstack clone with origin and main must host T3 project axstack-review-lane.'],
  ['pass base', [/unbound/i, /worktrees?/i, /origin\/main/, /fetch/i, /first/i],
    'Every unbound pass must fetch first and base its worktree on origin/main.'],
  ['continuity', [/continuity/i, /~\/\.local\/share\/axstack\/runs\/review-manager\/progress\.md/, /outside/i, /worktrees?/i],
    'Continuity must remain outside worktrees at ~/.local/share/axstack/runs/review-manager/progress.md.'],
  ['binding', [/lane thread/i, /t3_thread_configure/, /axstack-owner/, /read.?back/i],
    'The lane thread must use t3_thread_configure for axstack-owner and verify the readback.'],
  ['schedule', [/schedule_task/, /packaged prompt/i, /everyMs:900000/, /bindToCurrentThread:false/, /stable/i, /clientRequestId/],
    'With a stable clientRequestId, schedule_task must use the packaged prompt, everyMs:900000 and bindToCurrentThread:false.'],
  ['pass configuration', [/each pass/i, /compar/i, /t3_thread_configuration/, /recorded binding/i],
    'Each pass must compare t3_thread_configuration with the recorded binding.'],
  ['ordering', [/earlier pass/i, /wins/i, /ordering evidence/i],
    'With ordering evidence, the earlier pass must be the one that wins.'],
  ['inventory', [/discovery/i, /every page/i, /PRs/, /threads/i],
    'Discovery must read every page of threads and PRs.'],
  ['growth', [/each pass/i, /retire/i, /settled predecessor/i, /report/i, /retained worktree count/i],
    'Each pass must report the retained worktree count and retire settled predecessor passes.'],
  ['overlap canary', [/canary/i, /two overlapping/i, /run_scheduled_task_now/, /one admission owner/i],
    'The canary must demonstrate one admission owner with two overlapping run_scheduled_task_now passes.'],
  ['killed predecessor canary', [/canary/i, /reconcil/i, /killed predecessor/i],
    'A canary must reconcile a killed predecessor.'],
  ['limit canary', [/canary/i, /temporary limit/i, /current count/i, /disabl/i, /following interval/i],
    'With a temporary limit equal to current count, the canary must disable the schedule before the following interval.'],
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
