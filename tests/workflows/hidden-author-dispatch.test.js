import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const runtime = 'axstack/references/t3-runtime.md';
const lifecycle = 'axstack/references/lifecycle.md';
const implement = 'axstack-implement/SKILL.md';
const hygiene = 'axstack/references/workspace-hygiene.md';
// Each copy is a shipped instruction boundary; mutations stay in memory.
const rules = [
  ['fresh isolation proof', [runtime], [/[Bb]efore git switch -c/, /fresh author.*verify/i, /starting branch matches t3\/<id>/, /git rev-parse --show-toplevel/, /differs from.*driver worktree.*named in.*brief/i],
    'Before git switch -c, the fresh author shall verify the starting branch matches t3/<id> and git rev-parse --show-toplevel differs from the driver worktree named in its brief.', [/differs from/i, 'equals']],
  ['failed isolation proof', [runtime], [/failed isolation proof/i, /stop.*AXSTACK-FAILED/, /change nothing/i],
    'On failed isolation proof, stop with AXSTACK-FAILED and change nothing.', [/change nothing/i, 'switch branches anyway']],
  ['driver isolation readback', [runtime], [/after dispatch/i, /driver.*read back/i, /child.*worktreePath/, /hold if it equals.*driver worktree/i],
    'After dispatch the driver shall read back the child worktreePath and hold if it equals the driver worktree.', [/hold if it equals/i, 'hold if it differs from']],
  ['driver path in brief', [runtime], [/before dispatch/i, /driver.*name/i, /worktree.*absolute path.*author brief/i],
    'Before dispatch, the driver names its worktree absolute path in the author brief.', [/before dispatch/i, 'after dispatch']],
  ['fallback repair', [runtime], [/launched fallback/i, /retain.*same author thread/i, /use launched-run completion checks/i],
    'Retain the same author thread for a launched fallback and use launched-run completion checks.', [/same author thread/i, 'new author thread']],
  ['author route', [runtime, implement], [/authors?/i, /async delegate_task/i, /isolation:"worktree"/i, /title = dispatch key/i, /stable clientRequestId/i],
    'Authors shall use async delegate_task with isolation:"worktree", title = dispatch key and stable clientRequestId.', [/delegate_task/i, 't3_thread_launch']],
  ['fresh branch bootstrap', [runtime], [/fresh author brief step 1/i, /verify.*branch.*absent.*before/i, /git switch -c <encoded branch> <pinned base SHA>/, /then verify HEAD equals.*pinned base SHA/i],
    'The fresh author brief step 1 shall verify the branch is absent before git switch -c <encoded branch> <pinned base SHA>, then verify HEAD equals the pinned base SHA.', [/before/i, 'after']],
  ['non-resetting switch', [runtime], [/git switch -C/],
    'Never use git switch -C.', [/never/i, 'always'], /never use/i],
  ['temporary branch retirement', [runtime], [/delete.*exact T3 t3\/<id> branch/i, /only after.*switch succeeds.*HEAD.*verified/i],
    'Delete the exact T3 t3/<id> branch only after the switch succeeds and HEAD is verified.', [/only after/i, 'before']],
  ['author identity', [runtime], [/at dispatch/i, /record/i, /taskId/, /childThreadId/, /worktreePath/, /encoded branch/i],
    'At dispatch, record the encoded branch, worktreePath, childThreadId and taskId.', [/record/i, 'discard']],
  ['lost delegated response', [runtime], [/lost delegated.*response/i, /retry.*same.*clientRequestId/i, /recover.*task identity/i],
    'For a lost delegated dispatch or repair response, retry with the same clientRequestId to recover task identity.', [/same/i, 'new']],
  ['unknown writer', [runtime], [/second writer/i, /outcome.*unknown/i],
    'Never start a second writer while the outcome is unknown.', [/never/i, 'always'], /never start/i],
  ['same-child repair', [runtime, lifecycle], [/repair/i, /t3_thread_send\(childThreadId, mode:queue, clientRequestId\)/, /same author/i, /same.*worktree.*branch/i, /record.*returned taskId/i, /verif.*existing candidate head/i, /stable clientRequestId/i],
    'A repair uses t3_thread_send(childThreadId, mode:queue, clientRequestId) for the same author in the same worktree and branch, records the returned taskId and verifies the existing candidate head with a stable clientRequestId.', [/same author/i, 'new author']],
  ['fresh-only bootstrap', [runtime, lifecycle], [/repairs/i, /repeat.*step 1/i],
    'Repairs never repeat fresh checkout step 1.', [/never/i, 'always'], /never repeat/i],
  ['delegated candidate completion', [runtime, lifecycle], [/delegated author completion/i, /requires/i, /delegated terminal checks/i, /non-empty diff/i, /clean tree/i, /named red\/green logs/i],
    'Delegated author completion requires delegated terminal checks plus a clean tree, non-empty diff and named red/green logs.', [/requires/i, 'waives']],
  ['recorded fallback', [runtime], [/author fallback/i, /t3_thread_launch/i, /only when worktree isolation is unavailable/i, /record.*each use.*run record/i],
    'Use t3_thread_launch as a rare author fallback only when worktree isolation is unavailable and record each use in the run record.', [/only when/i, 'even when']],
  ['fallback workspace', [runtime], [/recorded author launch/i, /type:worktree/, /baseRef:<SHA>/, /branch:<encoded branch>/, /startFromOrigin:false/],
    'For a recorded author launch, use {startFromOrigin:false, branch:<encoded branch>, baseRef:<SHA>, type:worktree}.', [/startFromOrigin:false/, 'startFromOrigin:true']],
  ['manual author settlement', [runtime, hygiene], [/delegated authors/i, /accepted completion/i, /same driver turn/i, /settle.*t3_thread_organize.*action: settle/i, /read back.*settled: true.*t3_thread_read/i, /record.*settle: manual/i],
    'For delegated authors after accepted completion, in the same driver turn settle with t3_thread_organize action: settle, read back settled: true with t3_thread_read and record settle: manual.', [/same driver turn/i, 'later turn']],
  ['guarded manual retirement', [runtime, hygiene], [/delegated author/i, /archive.*guarded manual worktree removal/i, /wait for.*PR.*merge or close/i],
    'For delegated authors, archive and guarded manual worktree removal wait for PR merge or close.', [/wait for/i, 'precede']],
  ['no automatic child cleanup', [runtime, hygiene], [/automatic child cleanup/i],
    'Never rely on automatic child cleanup.', [/never/i, 'always'], /never rely/i],
  ['activation boundary', [runtime], [/E1 and E2/i, /same release/i, /until E2 lands/i, /launched writers remain.*valid route/i],
    'E1 and E2 ship in the same release: until E2 lands, launched writers remain a valid route.', [/until E2 lands/i, 'forever']],
];

for (const [name, paths, concepts, wording, inversion, negative] of rules) {
  for (const path of paths) test(`hidden authors: ${name} in ${path}`, () => {
    const text = sentences(readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8').replace(/`/g, '')).join('. ');
    const required = [...concepts, inversion[0]];
    const accepts = (source) => negative ? prohibits(source, negative, ...required) : requires(source, ...required);
    const inversions = [inversion];
    if (name === 'fresh branch bootstrap') inversions.push([/git switch -c/, 'git switch -C'], [/branch is absent/i, 'branch exists']);
    checkRule(text, accepts, wording, inversions, required);
  });
}
