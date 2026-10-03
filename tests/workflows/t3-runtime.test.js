import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const runtime = () => read('skills/axstack/references/t3-runtime.md');
const blocks = (text) => text.split(/\n\s*\n/).map((part) => part.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim());
// Each contract is local to one paragraph/table: scattered vocabulary cannot
// satisfy it. These prove prose instructions, not live T3 compliance.
const satisfies = (block, patterns) => /\bmust\b/i.test(block)
  && !/\b(?:must not|need not|optional|may instead)\b/i.test(block)
  && patterns.every((pattern) => new RegExp(pattern, 'i').test(block));

// Independent paraphrases exercise meaning while API identifiers stay exact.
const rules = [
  ['capabilities', ['orchestrator_capabilities', 'sav\\w*', 'T3', 'schema'],
    'A T3 driver must save orchestrator_capabilities and follow the advertised schema.'],
  ['role snapshot', ['roles.json', 'preset', 'stable.*ID', 'snapshot', 'resume', 'no re-resolution'],
    'The preset roles.json must be snapshotted by stable role ID; resume uses that snapshot with no re-resolution.'],
  ['read-only delegates', ['advisers', 'research', 'diligence', 'delegate_task', 'async', 'driver worktree', 'evidence', 'untouched'],
    'Advisers, research and diligence must use async delegate_task in the driver worktree; files stay untouched and outputs go to evidence.'],
  ['probe delegates', ['reviewers', 'debug', 'execution', 'UI verifier', 'delegate_task', 'detached', 'candidate SHA', 'pinned base', 'disposable', 'cd'],
    'Reviewers, debug and execution investigators and the UI verifier must cd into a disposable detached checkout of the candidate SHA and pinned base before delegate_task work.'],
  ['writer launch', ['author', 'code-arena', 't3_thread_launch', 'type:worktree', 'startFromOrigin:false', 'own worktree', 'merges or closes'],
    'The author and code-arena writers must use t3_thread_launch with type:worktree and startFromOrigin:false in their own worktree, kept until the PR merges or closes.'],
  ['driver ownership', ['driver', 'sole.*run.record writer', 'never.*tracked', 'one writer per candidate'],
    'The driver must remain the sole run-record writer, never change tracked candidate files, and enforce one writer per candidate.'],
  ['provider mapping', ['codex.*codex', 'claude.*claudeAgent', 'grok.*grok', 'antigravity.*antigravity', 'modeId', 'runtimeMode:full-access', 'options', 'id,value'],
    'Provider bindings must map codex to codex, claude to claudeAgent, grok to grok and antigravity to antigravity; modeId becomes runtimeMode:full-access and options contain id,value.'],
  ['pinned model', ['preset model', 'as given'],
    'A preset model must be used as given.'],
  ['class resolution', ['modelClass', 'newest', 'provider', 'gpt-<N>-<class>', 'claude-<class>-<N>-<N>', '--provider', 'saved capabilities'],
    'modelClass must resolve to the newest provider catalog ID, gpt-<N>-<class> or claude-<class>-<N>-<N>, using --provider and saved capabilities.'],
  ['null model', ['model:null', 'no class', 'first', 'capabilities', 'exact ID', 'record'],
    'For model:null with no class, the first model in capabilities must be selected and its exact ID recorded.'],
  ['availability hold', ['unavailable', 'model', 'effort', 'hold', 'no substitution'],
    'An unavailable model or effort must hold that role with no substitution.'],
  ['codex effort', ['codex', 'reasoningEffort'],
    'Codex effort must use reasoningEffort.'],
  ['claude effort', ['claude', 'option ID effort'],
    'Claude effort must use option ID effort.'],
  ['grok effort', ['grok', 'reasoningEffort', 'exclude max'],
    'Grok must use reasoningEffort and exclude max.'],
  ['opencode effort', ['opencode', 'variant'],
    'OpenCode effort must use variant.'],
  ['binding verification', ['echo', 'provider', 'model', 't3_thread_configuration', 'read.back', 'options', 'runtimeMode'],
    'The provider and model echo must match the request; t3_thread_configuration read-back verifies options and runtimeMode.'],
  ['missing effort readback', ['missing effort read.back', 'hold', 'never.*satisfied'],
    'Missing effort read-back must hold effort-dependent roles and never count as satisfied.'],
  ['first configuration canary', ['first dispatch', 'provider', 'model', 'effort', 'running or completed', 'before.*siblings'],
    'The first dispatch for each provider, model and effort must be running or completed before its siblings launch.'],
  ['key and title', ['<run>:<role>:<task>:a<n>', 'before.*launch', 'exact.*whole.*title'],
    'The key <run>:<role>:<task>:a<n> must be recorded before launch and used as the exact whole T3 title.'],
  ['branch encoding', ['axstack/<run>/<role>/<task>-a<n>', 'each segment', 'lowercase', '\\[\\^a-z0-9-\\]', 'replace.*-'],
    'The branch axstack/<run>/<role>/<task>-a<n> must lowercase each segment and replace [^a-z0-9-] with -.'],
  ['SHA baseRef', ['baseRef', 'always.*commit SHA', 'never.*branch'],
    'baseRef must always be a commit SHA, never a branch.'],
  ['receipt protocol', ['AXSTACK-DONE key=', 'head=', 'report=', 'AXSTACK-FAILED key=', 'AXSTACK-QUESTION key=', 'q=', 't3_thread_send'],
    'Workers must send AXSTACK-DONE key= head= report=, AXSTACK-FAILED key= head= report=, or AXSTACK-QUESTION key= q=; launched writers use t3_thread_send.'],
  ['status persistence', ['persist.*task_status.*before.*t3_thread_read'],
    'The driver must persist task_status before t3_thread_read.'],
  ['delegate completion', ['completed', 'result_available', 'hasPendingChildRuns:false', 'AXSTACK-DONE', 'terminal', 'question.*incomplete'],
    'Delegate completion must require terminal completed with result_available, hasPendingChildRuns:false and AXSTACK-DONE; a question remains incomplete.'],
  ['writer completion', ['terminal.*t3_thread_wait', 'non.empty diff', 'clean tree', 'red/green', 'message.*progress'],
    'Writer acceptance must require terminal t3_thread_wait, non-empty diff, clean tree and red/green logs; a message alone is progress.'],
  ['stale completion', ['current attempt', 'candidate SHA', 'older.*never.*complete'],
    'Completion must match the current attempt and candidate SHA; an older attempt never completes a newer attempt.'],
  ['failure classification', ['task_status.*failed', 'failed or interrupted', 'preparing.*error', 'AXSTACK-FAILED', 'incomplete'],
    'task_status failed, a run failed or interrupted, a preparing thread error or AXSTACK-FAILED must each be an incomplete outcome.'],
  ['delegated isolation', ['after each delegated completion', 'HEAD', 'git status --porcelain', 'unchanged', 'change.*hold'],
    'After each delegated completion the driver must verify HEAD and git status --porcelain are unchanged; any change is a hold.'],
  ['launch recovery inventory', ['t3_thread_list', 'titleContains', 'fully paginated', 'exact whole.title', 'git worktree list', 'reserved branch'],
    'Launch recovery must combine fully paginated t3_thread_list titleContains results filtered by exact whole-title equality with git worktree list and keep the reserved branch.'],
  ['launch recovery outcomes', ['one exact match.*adopt', 'proven absence.*relaunch once', 'several.*incomplete.*hold'],
    'Recovery must adopt one exact match, relaunch once on proven absence, and hold for several matches or an incomplete inventory.'],
  ['post-launch wait', ['post.launch', 't3_thread_wait', 'timeoutMs:120000', 'failed.*launch failure', 'timed.out', 'activeRunId', 'worktreePath', 'started', 'preparing.*hold', 'next wake'],
    'Post-launch t3_thread_wait with timeoutMs:120000 must classify failed as launch failure, timed-out activeRunId plus worktreePath as started, and still preparing as a hold re-read at the next wake.'],
  ['question resume', ['AXSTACK-QUESTION', 'answer once', 't3_thread_send.*childThreadId', 't3_thread_wait', 'timeoutMs:600000', 'run watch', 'latestTerminal', 'newer than.*question', 'no notification'],
    'For AXSTACK-QUESTION the driver must answer once with t3_thread_send to childThreadId, then t3_thread_wait timeoutMs:600000 re-armed by the run watch; accept latestTerminal* only newer than the question run even with no notification.'],
  ['same writer repair', ['repair', 't3_thread_send', 'mode:queue', 'same.*attempt', 'same.*author'],
    'A repair must use t3_thread_send mode:queue to the same author within the same attempt.'],
  ['replacement attempt', ['terminal failure', 'a<n\\+1>', 'new branch', 'title', 'failed.*branch.*kept.*salvage'],
    'Replacement after terminal failure must use a<n+1>, a new branch and title, with the failed branch kept until salvage.'],
  ['idle writer watch', ['unsettled launched', 'turn.*end.*only', 'schedule_task', 'bindToCurrentThread:true', 'everyMs:600000', 'reconcile', 'failed.*hold'],
    'With an unsettled launched writer the turn must end only after schedule_task bindToCurrentThread:true everyMs:600000 is armed; wakes reconcile and failed writers hold.'],
  ['watch deletion', ['nothing.*unsettled', 'delete_scheduled_task', 'list_scheduled_tasks', 'read.back.*absence'],
    'When nothing is unsettled the driver must delete_scheduled_task and use list_scheduled_tasks to read back absence.'],
  ['cleanup preflight', ['worktreeCleanup', 'off', 't3_project_read', 'where exposed', 'otherwise.*record.*limitation', 'setup'],
    'worktreeCleanup must be off; t3_project_read verifies it where exposed, otherwise record a limitation referencing setup.'],
  ['run record', ['driver threadId', 'projectId', 'host', 'T3 version', 'installed Axstack SHA', 'capabilities JSON path', 'scheduledTaskIds'],
    'The run record must include driver threadId, projectId, host, T3 version, installed Axstack SHA, capabilities JSON path and scheduledTaskIds.'],
  ['dispatch record', ['key', 'mechanism', 'requested target', 'read.back', 'taskId/childThreadId/childRunId', 'threadId/runId/worktree/branch/base SHA', 'checkout', 'candidate', 'evidence folder'],
    'Each dispatch record must include key, mechanism, requested target and read-back, taskId/childThreadId/childRunId or threadId/runId/worktree/branch/base SHA, checkout path and candidate SHA, and evidence folder.'],
  ['temporary evidence guard', ['TMPDIR', '0700', 'real path', 'inside.*recorded.*evidence', 'no symlink', 'owner', 'before.*use', 'cleanup', 'uncertain.*preserv'],
    'Before use or cleanup, TMPDIR must be 0700 with its real path inside recorded evidence, no symlink and a matching owner; uncertain paths are preserved.'],
  ['safe deletion', ['exact.*validated.*owned path', 'literal absolute', '\\$\\{VAR:\\?\\}', 'no glob', 'no parent.root', 'never.*general cache'],
    'Deletion must target an exact validated owned path using a literal absolute path or ${VAR:?} guard, no glob and no parent-root deletion; never wipe a general cache.'],
  ['brief confirmation', ['confirm.*brief.*once', 're.verif.*started', 'second.*hold', 'never.*trust or permission', 'no.*authority'],
    'The owner must confirm the brief once and re-verify started; a second question holds, never answer trust or permission dialogs, and confirmation adds no authority.'],
  ['prompt refusal hold', ['permission prompt', 'provider safety refusal', 'held.*incomplete', 'never.*bypass', 'another model'],
    'A permission prompt or provider safety refusal must be held and incomplete; never bypass via another model.'],
  ['review evidence isolation', ['each reviewer', 'separate.*checkout', 'private.*evidence folder', 'no first.pass cross.read', 'tracked.*read.only', 'read back.*before.*remov'],
    'Each reviewer must have a separate checkout and private evidence folder, no first-pass cross-read and tracked files read-only; read back evidence before removal.'],
  ['acceptance distinct from start', ['input acceptance', 'started', 'completed', 'distinct evidence', 'silence.*never.*exit', 'same owner'],
    'Input acceptance, started and completed must remain distinct evidence; silence never proves exit and resume preserves the same owner.'],
  ['ownership transfer', ['explicit.*transfer', 'recipient acceptance', 'scope', 'revision', 'authority', 'before.*ownership', 'current owner'],
    'An explicit transfer must validate recipient acceptance against scope, revision and authority before ownership changes; until then the current owner remains accountable.'],
  ['native runtime boundary', ['no Axstack daemon', 'DB', 'lock', 'scheduler', 'private evidence', 'explicit publication authority', 'no merge.*release.*authority'],
    'The runtime must provide no Axstack daemon, DB, lock or scheduler; private evidence needs explicit publication authority and receipts grant no merge or release authority.'],
];

for (const [name, patterns, paraphrase] of rules) {
  test(`T3 contract: ${name} rejects removal/inversion and accepts rewording`, () => {
    const source = blocks(runtime());
    const matching = source.filter((block) => satisfies(block, patterns));
    expect(matching.length, `missing binding rule: ${name}`).toBeGreaterThan(0);
    expect(source.filter((block) => !matching.includes(block)).some((block) => satisfies(block, patterns))).toBe(false);
    for (const block of matching) {
      expect(satisfies(block.replace(/\bmust\b/gi, 'need not'), patterns), `inverted ${name}`).toBe(false);
    }
    expect(satisfies(paraphrase, patterns), `paraphrase ${name}`).toBe(true);
    expect(satisfies(paraphrase.replace(/\bmust\b/gi, 'need not'), patterns)).toBe(false);
  });
}

test('AC2 runtime recovery scenarios depend on removal-sensitive contracts', () => {
  const scenarios = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json'));
  const expected = ['lost-launch-response', 'silent-provisioning-failure', 'writer-death-after-idle', 'stale-completion', 'child-question-resume'];
  expect(scenarios.cases.slice(0, expected.length).map(({ id }) => id)).toEqual(expected);
  for (const scenario of scenarios.cases.slice(0, expected.length)) {
    expect(scenario.input).toBeTruthy();
    expect(scenario.expected.action).toBeTruthy();
    expect(scenario.contracts.length).toBeGreaterThan(0);
    for (const name of scenario.contracts) {
      const entry = rules.find(([id]) => id === name);
      expect(entry, `unbound scenario contract: ${name}`).toBeDefined();
      const [, patterns, paraphrase] = entry;
      const source = blocks(runtime());
      expect(source.some((block) => satisfies(block, patterns)), scenario.id).toBe(true);
      expect(source.filter((block) => !satisfies(block, patterns)).some((block) => satisfies(block, patterns))).toBe(false);
      expect(source.map((block) => satisfies(block, patterns) ? block.replace(/\bmust\b/gi, 'need not') : block)
        .some((block) => satisfies(block, patterns))).toBe(false);
      expect(satisfies(paraphrase, patterns)).toBe(true);
    }
  }
});
