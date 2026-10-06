import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');
const autopilot = () => read('skills/axstack/references/autopilot.md');
const implement = () => read('skills/axstack-implement/SKILL.md');
const watch = () => read('skills/axstack-watch/SKILL.md');
const runtime = () => read('skills/axstack-watch/references/watch-runtime.md');

// Bound each assertion to the sentence containing its decision. This is
// contract-text evidence, not a model or live-runtime result.
function sentence(text, anchor) {
  const at = text.indexOf(anchor);
  expect(at, `missing decision sentence: ${anchor}`).toBeGreaterThanOrEqual(0);
  const tail = text.slice(at, at + 600);
  const end = tail.search(/\.(?=\s|$)/);
  expect(end, `unbounded decision sentence: ${anchor}`).toBeGreaterThanOrEqual(0);
  return tail.slice(0, end + 1);
}

function rule(name, source, anchor, pattern) {
  test(name, () => expect(sentence(source(), anchor)).toMatch(pattern));
}

rule('spec advances to Tickets', () => read('skills/axstack-spec/SKILL.md'), 'In an eligible delivery run', /continue to Tickets in the same driver chat/);
rule('Tickets advances to Implement', () => read('skills/axstack-tickets/SKILL.md'), 'With a complete map', /continues to Implement in the same driver chat/);
// automatic-own-pr-watch.test.js owns every-phase readback/arming/joining.
rule('maintain is default', watch, 'authorized maintain mode', /default for run-created PRs/);
rule('implement Close-out waits for Release', implement, 'Run Close-out once only', /Release step is settled or not applicable/);
rule('implement run done waits for Release', implement, 'The run is done only', /Release step is settled or not applicable/);
rule('watch Close-out waits for Release', watch, 'When every required PR is merged', /Release step is settled or not applicable/);
rule('watch end waits for Release', watch, 'End a chat-run watch', /release step is settled or not applicable/);
rule('runtime end waits for Release', runtime, 'Stop the chosen wake only', /release step is settled or not applicable/);
rule('implement notification allowlist', implement, '`axstack-relay` sends only', /serious risk immediately.*genuine blocked operation/);
rule('watch notification allowlist', watch, '[axstack-relay](../axstack-relay/SKILL.md) only', /serious risk immediately.*genuine blocked operation/);
rule('runtime notification allowlist and budget', runtime, 'The driver records one Notification policy:', /only for a user-decision hold.*at most two.*serious-risk hold/);
rule('relay policy exception', () => read('skills/axstack-relay/SKILL.md'), 'merge-ready, merged, and completion stay in the driver conversation', /unless the recorded Notification policy names it/);
rule('relay shared milestone budget', () => read('skills/axstack-relay/SKILL.md'), 'A policy may name', /at most two merge-ready\/merged milestones per run/);
rule('relay categories remain bounded', () => read('skills/axstack-relay/SKILL.md'), 'A policy may name only', /user-decision holds.*at most two merge-ready\/merged milestones/);
rule('AGENTS human npm gate', () => read('AGENTS.md'), 'The human merges the release PR', /approves the npm stage; agents never run/);
rule('AGENTS per-run host authority', () => read('AGENTS.md'), 'VPS only under release', /authority recorded for that run/);
rule('run-wide hold stops the run', autopilot, 'Run-wide holds', /authority.*scope.*cancellation.*serious risk stop the run/);
rule('scoped hold blocks dependants', autopilot, 'A task, PR, resource, or operation hold', /blocks only its dependants; continue independent authorized work/);
for (const item of ['tracker access', 'adviser or arena-seat availability', 'CI-wait timeout', 'readiness UNKNOWN', 'dismissed approval', 'wake or cleanup uncertainty', 'single-provider routing', 'existing tag or version', 'failed publish']) {
  test(`hold example: ${item}`, () => expect(autopilot()).toContain(item));
}
rule('silence cannot resume', autopilot, 'A user answer to the hold', /silence does not/);
rule('spec approval cannot be inferred', autopilot, 'Spec approval is always', /human's decision/);
rule('guarded merge actor', autopilot, 'The recorded owning watch thread', /merge actor.*axstack-owner.*standalone.*small or adopted/);
rule('human approval is not re-requested', autopilot, 'After merge-ready', /without re-requesting human review/);
rule('relay does not grant authority', autopilot, 'A relay message is only', /never authority to approve, merge, or publish/);
rule('tag publish install authority', autopilot, 'Tagging, publishing, installation, and host mutation', /recorded per-run authority/);
rule('hosts are not inferred', autopilot, 'Install hosts come only', /absent host list is a decision hold, not permission to infer hosts/);
rule('cancellation settles with guards', autopilot, 'Cancel sets', /stops new actions.*guarded settlement/);
// Chat-run schedule renewal is covered by automatic-own-pr-watch.test.js; standalone expiry stays separate.
rule('recordless watch treats release as not applicable', watch, 'Without an Autopilot or Release record', /release step is not applicable/);
rule('recordless runtime treats release as not applicable', runtime, 'Without an Autopilot or Release record', /release step is not applicable/);
rule('manual and scheduled resume coexist', implement, "driver resumes on the user's next message", /`\/axstack-watch`.*armed chat-run watch wake/);
rule('implement diligence repairs before hold', autopilot, 'Diligence FINDINGS during implement', /repair route.*recorded hold/);
rule('spec gate records paused state', autopilot, 'Awaiting human spec approval', /Autopilot: paused.*decision hold/);
rule('missing hosts hold at Align or spec', autopilot, 'A missing install host list', /Align or spec time.*decision hold/);
rule('running author survives cancellation until settlement', autopilot, 'Cancellation does not cancel', /running author run.*settle/);
rule('Close-out records installed version', autopilot, 'Close-out last', /release and install receipts.*installed version/);
rule('closed-unmerged watch holds and continues wake', watch, 'A required PR closed without merging', /decision hold.*wake remains active/);
rule('closed-unmerged runtime holds and continues wake', runtime, 'A required PR closed without merging', /decision hold.*wake remains active/);

rule('silence cannot grant release authority', autopilot, 'The small-work Align read-back names', /silence cannot fill a missing authority or target/);
rule('relay never sends policy-enabled progress', () => read('skills/axstack-relay/SKILL.md'), 'Progress, CI pending, and completion are never eligible', /merely because a policy exists/);
rule('implement verifies forge state on wake', implement, "driver resumes on the user's next message", /verify merge state through the forge on wake/);
rule('tag follows confirmed release merge', autopilot, 'Once the forge confirms that merge', /tag and wait for the staged publish/);
rule('only original driver advances', autopilot, 'Only the original driver advances', /^Only the original driver advances\.$/);
rule('original driver owns run record and routing', autopilot, 'The original driver remains', /sole run-record writer and phase router/);
rule('explicit stop after Align is honored', () => read('skills/axstack-align/SKILL.md'), 'an explicit stop-after-Align request', /ends here/);
rule('workflow human gate remains human', () => read('docs/workflows.md'), 'The human approves substantial specs', /release PRs, peer and deploying-base merges, and the npm stage/);
rule('routing preparation advances', () => read('skills/axstack/references/routing.md'), 'Prepare via `axstack-align`', /handoff, then continue under autopilot when eligible/);
rule('routing substantial work advances', () => read('skills/axstack/references/routing.md'), 'Preparation: substantial work', /handoff path above, then continues under autopilot when eligible/);
rule('workflow notifications have only bounded categories', () => read('docs/workflows.md'), 'An applicable `Notification policy`', /only for a user-decision hold.*serious-risk hold.*at most two merge-ready\/merged milestones per run/);
rule('recordless implement release is inapplicable', implement, 'Without an Autopilot or Release record', /Release step is not applicable/);
rule('diligence repairs at owning phase', autopilot, 'Diligence FINDINGS during implement', /§6 repair route.*spec, tickets, or release preparation.*resolves them before advancing/);
rule('diligence pauses only for recorded hold', autopilot, 'Diligence FINDINGS during implement', /only a recorded hold pauses autopilot/);
rule('workflow routine events always stay in T3', () => read('docs/workflows.md'), 'Progress, CI pending, and completion', /always stay in the T3 driver thread/);
rule('implement routine events always stay in T3', implement, 'Progress, CI pending, and completion', /always stay in the T3 driver thread/);
rule('watch routine events always stay in T3', watch, 'Progress, CI pending, and completion', /always stay in the T3 driver thread/);
rule('workflow relay remains bounded', () => read('docs/workflows.md'), 'Only the bounded categories', /user-decision holds.*serious-risk holds.*at most two merge-ready\/merged milestones.*recorded Notification policy/);
rule('implement relay remains bounded', implement, 'Only the bounded categories', /user-decision holds.*serious-risk holds.*at most two merge-ready\/merged milestones.*recorded Notification policy/);
rule('watch relay remains bounded', watch, 'Only the bounded categories', /user-decision holds.*serious-risk holds.*at most two merge-ready\/merged milestones.*recorded Notification policy/);
rule('Release line appears at gate 1', autopilot, 'Show the `Release:` line', /spec for human approval at gate 1.*small work Align read-back/);
rule('release applicability is decided once', autopilot, 'Detect applicability once', /Align or spec time/);
rule('release bump defaults to patch', autopilot, 'Default to a patch', /minor if a `feat` commit landed since the last tag/);
rule('registry wake verifies package and version', autopilot, 'A wake verifies the registry', /expected package and version/);
rule('adopted PR requires maintenance snapshot', autopilot, 'An explicitly adopted PR joins', /only with its maintenance snapshot/);
rule('healthy ticks stay quiet', autopilot, 'Healthy ticks stay quiet', /^Healthy ticks stay quiet\.$/);
rule('relay deduplicates by purpose and revision', autopilot, 'Across implementation and release', /deduplicate by purpose and revision/);
rule('milestone cap spans implementation and release', autopilot, 'Across implementation and release', /merge-ready and merged notifications together are capped at two per run/);
rule('relay shares budget across implementation and release', () => read('skills/axstack-relay/SKILL.md'), 'A policy may name only', /deduplicate across implementation and release/);
// Each verified publication arms or joins; the semantic contract owns that check.
rule('Align continues small work to Implement', () => read('skills/axstack-align/SKILL.md'), 'Substantial work continues to', /small work continues from its small-change intent to Implement/);
// own-pr-watch-docs.test.js owns every-phase publication on all three public docs.

test('run record requires a Release decision line', () => {
  expect(readFileSync(`${root}/skills/axstack/references/run-record.md`, 'utf8'))
    .toMatch(/^Release: <AGENTS\.md file:line \+ tag-triggered workflow path \+ named install hosts> \| not applicable \(<reason>\)$/m);
});

test('a scoped hold leaves independent authorized work available', () => {
  expect(autopilot()).toContain('continue independent authorized work');
});

test('holdout: human approval and merge authority stay explicit', () => {
  expect(sentence(read('skills/axstack-spec/SKILL.md'), 'The driver owns the draft')).toMatch(/user approves it/);
  expect(sentence(autopilot(), 'Spec approval is always')).toMatch(/human's decision/);
  expect(sentence(watch(), 'Promotion, release,')).toMatch(/deploying.*peer PRs.*user.*forge/);
  expect(sentence(read('AGENTS.md'), 'The human merges the release PR')).toMatch(/approves the npm stage; agents never run/);
  expect(sentence(autopilot(), 'Human npm stage approval')).toMatch(/agents never run `npm stage approve`/);
  expect(sentence(watch(), 'Never re-request a collaborator')).toMatch(/approval still counts.*carryover rule/);
});

test('Tickets no longer directs an eligible run to stop', () => {
  expect(read('skills/axstack-tickets/SKILL.md')).not.toContain('stop before implementation');
});

test('Align heading describes routing', () => {
  expect(read('skills/axstack-align/SKILL.md')).not.toContain('Read back, classify, and stop');
});

for (const name of ['audit', 'cleanup', 'debug', 'explain', 'improve', 'research', 'review']) {
  test(`${name} has no Autopilot pointer`, () => {
    expect(read(`skills/axstack-${name}/SKILL.md`)).not.toContain('references/autopilot.md');
  });
}

test('evaluator inputs describe one applicability decision and both corpora', () => {
  const corpus = JSON.parse(read('tests/workflows/implement-loop-evaluator-inputs.json'));
  expect(corpus.note).toMatch(/input-only implement-loop and autopilot/i);
  const release = corpus.cases.find(({ id }) => id === 'autopilot-release-not-applicable');
  expect(release.input.run_state).toMatch(/decide once at Align or spec time.*recorded result/i);
});
