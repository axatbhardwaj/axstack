import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const runtime = 'axstack/references/t3-runtime.md';
const lifecycle = 'axstack/references/lifecycle.md';
const implement = 'axstack-implement/SKILL.md';
const hygiene = 'axstack/references/workspace-hygiene.md';
// Each copy is a shipped instruction boundary; mutations stay in memory.
const rules = [
  ['fresh isolation proof', [runtime], [/[Bb]efore git switch -c/, /delegated fresh author.*verify/i, /git rev-parse --show-toplevel/, /differs from.*driver worktree.*named in.*brief/i],
    'Before git switch -c, the delegated fresh author shall verify git rev-parse --show-toplevel differs from the driver worktree named in its brief.', [/differs from/i, 'equals']],
  ['failed isolation proof', [runtime], [/failed isolation proof/i, /stop.*AXSTACK-FAILED/, /change nothing/i],
    'On failed isolation proof, stop with AXSTACK-FAILED and change nothing.', [/change nothing/i, 'switch branches anyway']],
  ['driver isolation readback', [runtime], [/after dispatch/i, /driver.*reads? back/i, /child.*worktreePath/, /hold if.*equals.*driver worktree/i],
    'After dispatch the driver shall read back the child worktreePath and hold if it equals the driver worktree.', [/equals/i, 'differs from']],
  ['missing isolation readback', [runtime], [/after dispatch/i, /driver.*reads? back/i, /child.*worktreePath/, /hold if.*(?:missing|absent).*driver worktree/i],
    'After dispatch, the driver reads back the child worktreePath and must hold if it is missing or equals the driver worktree.', [/missing/i, 'present']],
  ['fallback skips bootstrap', [runtime], [/launched fallback author/i, /starts.*encoded branch/i, /skips.*step 1.*isolation proof/i],
    'A launched fallback author starts on its encoded branch and skips step 1 and the isolation proof.', [/skips/i, 'repeats']],
  ['driver path in brief', [runtime], [/before dispatch/i, /driver.*name/i, /worktree.*absolute path.*author brief/i],
    'Before dispatch, the driver names its worktree absolute path in the author brief.', [/before dispatch/i, 'after dispatch']],
  ['fallback repair', [runtime], [/launched fallback/i, /retain.*same author thread/i, /use launched-run completion checks/i],
    'Retain the same author thread for a launched fallback and use launched-run completion checks.', [/same author thread/i, 'new author thread']],
  ['author route', [runtime, implement], [/authors?/i, /async delegate_task/i, /isolation:"worktree"/i, /title = dispatch key/i, /stable clientRequestId/i],
    'Authors shall use async delegate_task with isolation:"worktree", title = dispatch key and stable clientRequestId.', [/delegate_task/i, 't3_thread_launch']],
  ['fresh branch bootstrap', [runtime], [/delegated fresh author brief step 1/i, /verify.*branch.*absent.*before/i, /git switch -c <encoded branch> <pinned base SHA>/, /then verify HEAD equals.*pinned base SHA/i],
    'The delegated fresh author brief step 1 shall verify the branch is absent before git switch -c <encoded branch> <pinned base SHA>, then verify HEAD equals the pinned base SHA.', [/before/i, 'after']],
  ['non-resetting switch', [runtime], [/git switch -C/],
    'Never use git switch -C.', [/never/i, 'always'], /never use/i],
  ['temporary branch retirement', [runtime], [/delete.*T3.created starting branch.*current name/i, /only after.*switch succeeds.*HEAD.*verified/i],
    'Delete the T3-created starting branch under its current name only after the switch succeeds and HEAD is verified.', [/only after/i, 'before']],
  ['linked clean isolation', [runtime], [/isolation proof/i, /git rev-parse --git-dir/, /differs from git rev-parse --git-common-dir/, /git status --porcelain.*(?:is|be|returns) empty\b/i],
    'For the isolation proof, git status --porcelain must be empty and git rev-parse --git-dir differs from git rev-parse --git-common-dir.', [/differs from/, 'equals']],
  ['name independent isolation', [runtime], [/isolation proof/i, /depend on.*starting branch name/i],
    'Never depend on the starting branch name for the isolation proof.', [/never/i, 'always'], /never depend on/i],
  ['record starting identity', [runtime], [/immediately before git switch -c/i, /record.*git symbolic-ref --short HEAD/i, /starting HEAD.*git rev-parse HEAD/],
    'Record starting HEAD via git rev-parse HEAD and current branch via git symbolic-ref --short HEAD immediately before git switch -c.', [/before/, 'after']],
  ['rename awareness', [runtime], [/T3/i, /rename.*starting branch/i, /after start/i],
    'After start, T3 can rename the starting branch.', [/\bcan\b/, 'cannot']],
  ['rename recovery', [runtime], [/T3.*renamed.*recorded name/i, /follow.*worktree reflog rename.*final name/i],
    'Follow the worktree reflog rename to the final name when T3 renamed the recorded name between capture and switch.', [/follow/i, 'ignore']],
  ['retirement guards', [runtime], [/delete only if/i, /no worktree.*checked out/i, /tip equals.*recorded starting HEAD/i],
    'Delete only if its tip equals the recorded starting HEAD and no worktree has it checked out.', [/equals/, 'differs from'], /no worktree/i],
  ['uncertain retirement', [runtime], [/cannot.*identified safely/i, /leave.*(?:name|list).*receipt.*driver cleanup/i],
    'When the branch cannot be identified safely, leave it and list it in the receipt for driver cleanup.', [/leave/, 'delete'], /cannot be identified safely/i],
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
];

for (const [name, paths, concepts, wording, inversion, negative] of rules) {
  for (const path of paths) test(`hidden authors: ${name} in ${path}`, () => {
    const text = sentences(readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8').replace(/`/g, '')).join('. ');
    const required = [...concepts, inversion[0]];
    const accepts = (source) => negative ? prohibits(source, negative, ...required) : requires(source, ...required);
    const inversions = [inversion];
    if (name === 'linked clean isolation') inversions.push([/is empty|must be empty/i, 'is non-empty']);
    if (name === 'retirement guards') inversions.push([/no worktree/i, 'a worktree']);
    if (name === 'fresh branch bootstrap') inversions.push([/git switch -c/, 'git switch -C'], [/branch is absent/i, 'branch exists']);
    checkRule(text, accepts, wording, inversions, required);
  });
}

const obsoleteBootstrap = (text) => sentences(text).some((sentence) =>
  requires(sentence, /t3\/<id>/, /branch|isolation|proof/i)) || /until E2 lands/i.test(text);
test('obsolete branch-name proof and transitional activation stay absent', () => {
  const text = readFileSync(`${import.meta.dir}/../../skills/${runtime}`, 'utf8').replace(/`/g, '');
  expect(obsoleteBootstrap(text)).toBe(false);
  for (const extra of ['The starting branch must match t3/<id> for isolation proof.',
    'For isolation, require a branch named t3/<id>.',
    'E1 and E2 ship in the same release: until E2 lands, launched writers remain a valid route.']) {
    expect(obsoleteBootstrap(`${text}\n${extra}`)).toBe(true);
  }
});
