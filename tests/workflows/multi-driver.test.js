import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8');
const runtime = read('axstack/references/t3-runtime.md')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').replace(/\s+/g, ' ');

// Instruction contracts, not a simulated T3 implementation or proof of compliance.
// Existing runtime tests cover provider discipline and isolated author bootstrap.
function rule(name, concepts, rewording, direction, inverse, ban, source = runtime) {
  test(`multi-driver: ${name}; removal/inversion red, rewording green`, () => {
    checkRule(source, (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts),
      rewording, [[direction, inverse]], concepts);
  });
}

rule('Coordinator coordinates project Drivers with scoped Workers',
  [/logical/i, /Coordinator/i, /can coordinate|supports/i, /multiple project-bound drivers/i, /each/i, /multiple scoped Workers/i, /T3 delegation/i],
  'A logical Coordinator supports multiple project-bound drivers, each using T3 delegation for multiple scoped Workers.',
  /can coordinate|supports/i, 'must not coordinate');
rule('reuse a suitable current Coordinator',
  [/reuse|retain/i, /suitable|appropriate/i, /current Coordinator/i],
  'Retain the appropriate current Coordinator.', /reuse|retain/i, 'replace');
rule('suggest a new Coordinator only when useful',
  [/suggest|propose/i, /new Coordinator/i, /only/i, /useful|helps/i],
  'Propose a new Coordinator only when it helps.', /only/i, 'even when it is not');
rule('every top-level launch requires explicit user request',
  [/every|each/i, /top-level/i, /thread launch/i, /requires?|needs?/i, /explicit user request/i],
  'Each top-level thread launch needs an explicit user request.', /requires?|needs?/i, 'does not require');
rule('resume preserves accepted explicit launch authority',
  [/resume/i, /preserve|retain/i, /existing|prior/i, /explicit/i, /accepted authorization/i, /scope/i],
  'On resume, retain prior explicit accepted authorization within its scope.', /preserve|retain/i, 'discard');
rule('skill grants no blanket launch permission',
  [/skill/i, /grant/i, /blanket/i, /launch permission/i],
  'The skill never grants blanket launch permission.', /never grants?/i, 'grants', /never grants?/i);
rule('cross-project work uses the right bound driver',
  [/cross-project work/i, /use|route/i, /correct|matching/i, /project-bound driver/i, /t3_thread_launch/i, /workspaceStrategy/i],
  'Route cross-project work through the matching project-bound driver using t3_thread_launch with workspaceStrategy.',
  /correct|matching/i, 'arbitrary');
rule('a local task cannot select another project',
  [/local/i, /delegate_task/i, /select/i, /another project/i],
  'A local delegate_task cannot select another project.', /cannot/i, 'can', /cannot/i);
rule('invalid project routing is not retried unchanged',
  [/retry/i, /same|unchanged/i, /invalid/i, /project/i, /request/i],
  'Never retry an unchanged invalid project request.', /never/i, 'always', /never/i);
rule('missing launch authorization holds only that launch',
  [/missing|absent/i, /launch authorization/i, /hold/i, /only/i, /affected launch/i],
  'With absent launch authorization, hold only the affected launch.', /only/i, 'everything including');
rule('one blocked launch leaves independent authorized work running',
  [/blocked launch/i, /continue|advance/i, /independent authorized work/i],
  'After a blocked launch, advance independent authorized work.', /continue|advance/i, 'stop');
rule('logical ownership survives null native parent',
  [/record|store/i, /logical coordinator link/i, /separately/i, /native parentThreadId/i, /null/i],
  'Store the logical coordinator link separately from native parentThreadId, including when null.', /separately/i, 'only as');
rule('driver inventory pins links and responsibility',
  [/(?:record|store) (?:its|the)/i, /each driver/i, /exact/i, /link/i, /project/i, /worktree/i, /scope/i, /owner/i, /record pointer/i],
  'For each driver, store its exact link, project, worktree, scope, owner and record pointer.', /(?:record|store) (?:its|the)/i, 'omit');
rule('handbacks carry acceptance, completion, dependencies and holds',
  [/record|store/i, /acceptance/i, /completion/i, /handbacks/i, /dependencies/i, /held state/i, /resume condition/i],
  'Store acceptance and completion handbacks, dependencies, held state and resume condition.', /record|store/i, 'omit');
rule('each driver owns its forge, watch and record',
  [/each driver/i, /owns/i, /own PR mutations/i, /watches/i, /sole/i, /own run record/i],
  'Each driver owns its own PR mutations and watches and is sole writer of its own run record.', /owns/i, 'must not own');
rule('Coordinator owns aggregate coordination',
  [/Coordinator/i, /owns/i, /aggregate coordination/i],
  'Aggregate coordination is what the Coordinator owns.', /owns/i, 'must not own');
rule('competing writers stay forbidden',
  [/competing writers/i, /candidate/i, /record/i, /across drivers/i],
  'Never allow competing writers for a candidate or record across drivers.', /never allow/i, 'allow', /never allow/i);
rule('Implement waits only after remaining work is held',
  [/end the turn waiting on the decision/i, /when|once/i, /all remaining authorized work/i, /is held/i],
  'Once all remaining authorized work is held, end the turn waiting on the decision.',
  /when|once/i, 'even before', undefined, read('axstack-implement/SKILL.md').replace(/\s+/g, ' '));

test('multi-driver guidance is loaded through existing shared entry points', () => {
  for (const path of ['axstack/references/routing.md', 'axstack/references/lifecycle.md',
    'axstack/references/run-record.md', 'axstack-implement/SKILL.md']) {
    const links = loadedReferences(read(path));
    expect(links.some((link) => /t3-runtime\.md#coordinating-multiple-drivers$/.test(link)), path).toBe(true);
  }
});

rule('Coordinator owns overall outcome across projects',
  [/Coordinator/i, /owns/i, /overall outcome/i, /coordinates/i, /across projects/i],
  'The Coordinator owns the overall outcome and coordinates work across projects.', /owns/i, 'abandons');
rule('Driver owns project delivery',
  [/Driver/i, /owns/i, /delivery/i, /one project/i, /implementation/i, /review/i, /merge/i, /deployment/i],
  'A Driver owns delivery within one project: implementation, review, merge and deployment.', /owns/i, 'abandons');
rule('Worker performs bounded driver task',
  [/Worker/i, /performs/i, /bounded task/i, /for a Driver/i, /authoring/i, /research/i, /review/i],
  'A Worker performs a bounded task for a Driver, including authoring, research or review.', /performs/i, 'rejects');
rule('parent is a relationship rather than role',
  [/parent/i, /describes/i, /relationship/i, /not/i, /role name/i],
  'Parent describes a relationship, not a role name.', /not/i, 'also', /not/i);
