import { readSkillFile as readFileSync } from './skill-source.js';
import { test, expect } from 'bun:test';

import { checkRule, loadedReferences, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');
const autopilot = () => read('skills/axstack/references/autopilot.md');
const inheritedNotifications = (path, target) => {
  const own = read(path);
  expect(loadedReferences(own)).toContain(target);
  return own + read('skills/axstack-watch/SKILL.md');
};
const implement = () => inheritedNotifications('skills/axstack-implement/SKILL.md', '../axstack-watch/SKILL.md#4-route-each-wake');
const watch = () => read('skills/axstack-watch/SKILL.md');
const runtime = () => inheritedNotifications('skills/axstack-watch/references/watch-runtime.md', '../SKILL.md#4-route-each-wake');

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
// Watch owns decision delivery; these callers must positively inherit that rule.
for (const [name, source] of [['implement', implement], ['runtime', runtime]]) {
  test(`${name} keeps decision holds in the driver thread`, () => {
    const concepts = [/user-decision holds/i, /serious-risk holds/i, /T3 driver thread/i,
      /driver ends its turn parked on the decision/i];
    checkRule(source(), (text) => requires(text, ...concepts),
      'Raise user-decision holds and serious-risk holds in the T3 driver thread, and the driver ends its turn parked on the decision.',
      [[/parked on the decision/i, 'continuing without a decision']], concepts);
  });
}
test('watch raises serious risks immediately and attempts bounded safe recovery', () => {
  const concepts = [/raise serious risks immediately/i, /bounded safe recovery/i, /blocked operations/i];
  checkRule(watch().replace(/;(?= attempt bounded)/, ','), (text) => requires(text, ...concepts),
    'Raise serious risks immediately, and attempt bounded safe recovery for blocked operations.',
    [[/immediately/i, 'next week']], concepts);
});
for (const path of ['skills/axstack-watch/SKILL.md', 'skills/axstack-implement/SKILL.md', 'docs/workflows.md']) {
  test(`blocked operation still needing the user is raised after recovery: ${path}`, () => {
    const concepts = [/after bounded safe recovery/i, /raise/i, /genuine blocked operation/i,
      /still needs the user/i, /T3 driver thread/i, /driver ends its turn parked on (?:it|that blocker)/i];
    checkRule(read(path), (text) => requires(text, ...concepts),
      'Raise a genuine blocked operation that still needs the user in the T3 driver thread after bounded safe recovery, and the driver ends its turn parked on that blocker.',
      [[/raise/i, 'ignore'], [/after bounded safe recovery/i, 'before bounded safe recovery']], concepts);
  });
}
// default-auto-merge.test.js owns the AGENTS release merge and human npm gate.
rule('AGENTS per-run host authority', () => read('AGENTS.md'), 'VPS only under release', /authority recorded for that run/);
rule('run-wide hold stops the run', autopilot, 'Run-wide holds', /authority.*scope.*cancellation.*serious risk stop the run/);
rule('scoped hold blocks dependants', autopilot, 'A task, PR, resource, or operation hold', /blocks only its dependants; continue independent authorized work/);
for (const item of ['tracker access', 'adviser or arena-seat availability', 'CI-wait timeout', 'readiness UNKNOWN', 'dismissed approval', 'wake or cleanup uncertainty', 'single-provider routing', 'existing tag or version', 'failed publish']) {
  test(`hold example: ${item}`, () => {
    expect(autopilot()).toContain(item);
    if (item !== 'adviser or arena-seat availability') return;
    const concepts = [/\badviser or arena-seat availability\b/i, /\bholds? the work that needs them\b/i];
    checkRule(autopilot(), (text) => requires(text, ...concepts),
      'For example, adviser or arena-seat availability holds the work that needs them.',
      [[/\bholds?\b/i, 'never holds'],
        ...concepts.map((concept) => [new RegExp(concept.source, 'gi'), 'other$&wise'])], concepts);
    // Availability still holds dependent work; eligible hold cards inherit
    // their bounded wait and unavailable-seat exception from the contract.
    const source = readFileSync(`${root}/skills/axstack/references/autopilot.md`, 'utf8');
    const section = source.split('## Advance and hold')[1].split('## ')[0];
    const link = 'contracts.md#advised-holds';
    expect(loadedReferences(section)).toContain(link);
    const directive = section.match(/Follow \[Advised holds\]\([^)]*\)[^.]*\./)?.[0];
    expect(directive).toBeDefined();
    expect(loadedReferences(section.replace(directive, ''))).not.toContain(link);
    expect(loadedReferences(section.replace(directive, `Never ${directive}`))).not.toContain(link);
    expect(loadedReferences(section.replace(directive, directive.replace('Follow', 'Read')))).toContain(link);
  });
}
rule('silence cannot resume', autopilot, 'A user answer to the hold', /silence does not/);
rule('spec approval cannot be inferred', autopilot, 'Spec approval is always', /human's decision/);
rule('guarded merge actor', autopilot, 'The recorded owning watch thread', /merge actor.*axstack-owner.*standalone.*small or adopted/);
rule('human approval is not re-requested', autopilot, 'After merge-ready', /without re-requesting human review/);
// autopilot-authority.test.js owns recorded authority for tag, publish, and install.
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
rule('closed-unmerged watch holds scope', watch, 'A required PR closed without merging', /decision hold.*until the user resolves scope or cancels/);
rule('closed-unmerged runtime holds scope', runtime, 'A required PR closed without merging', /decision hold.*until the user resolves scope or cancels/);

rule('silence cannot grant release authority', autopilot, 'The small-change intent read-back names', /silence cannot fill a missing authority or target/);
rule('implement verifies forge state on wake', implement, "driver resumes on the user's next message", /verify merge state through the forge on wake/);
rule('tag follows confirmed release merge', autopilot, 'Once the forge confirms that merge', /tag and wait for the staged publish/);
rule('only original driver advances', autopilot, 'Only the original driver advances', /^Only the original driver advances\.$/);
rule('original driver owns run record and routing', autopilot, 'The original driver remains', /sole run-record writer and phase router/);
rule('explicit stop after Align is honored', () => read('skills/axstack-align/SKILL.md'), 'an explicit stop-after-Align request', /ends here/);
test('workflow human gate remains human', () => {
  const concepts = [/human/i, /approves/i, /substantial specs/i, /peer/i, /deploying-base merges/i, /npm stage/i];
  checkRule(read('docs/workflows.md'), (text) => requires(text, ...concepts),
    'The human approves substantial specs, peer and deploying-base merges, and the npm stage.',
    [[/human/i, 'agent']], concepts);
});
rule('routing preparation advances', () => read('skills/axstack/references/routing.md'), 'Prepare via `axstack-align`', /handoff, then continue under autopilot when eligible/);
rule('routing substantial work advances', () => read('skills/axstack/references/routing.md'), 'Preparation: substantial work', /handoff path above, then continues under autopilot when eligible/);
rule('recordless implement release is inapplicable', implement, 'Without an Autopilot or Release record', /Release step is not applicable/);
rule('diligence repairs at owning phase', autopilot, 'Diligence FINDINGS during implement', /§6 repair route.*spec, tickets, or release preparation.*resolves them before advancing/);
rule('diligence pauses only for recorded hold', autopilot, 'Diligence FINDINGS during implement', /only a recorded hold pauses autopilot/);
rule('workflow routine events always stay in T3', () => read('docs/workflows.md'), 'Progress, CI pending, and completion', /always stay in the T3 driver thread/);
rule('implement routine events always stay in T3', implement, 'Progress, CI pending, and completion', /always stay in the T3 driver thread/);
rule('watch routine events always stay in T3', watch, 'Progress, CI pending, and completion', /always stay in the T3 driver thread/);
rule('Release line appears at gate 1', autopilot, 'Show the `Release:` line', /spec for human approval at gate 1.*small-change intent read-back/);
rule('release applicability is decided once', autopilot, 'Detect applicability once', /Align or spec time/);
rule('release bump defaults to patch', autopilot, 'Default to a patch', /minor if a `feat` commit landed since the last tag/);
rule('registry wake verifies package and version', autopilot, 'A wake verifies the registry', /expected package and version/);
rule('adopted PR requires maintenance snapshot', autopilot, 'An explicitly adopted PR joins', /only with its maintenance snapshot/);
rule('healthy ticks stay quiet', autopilot, 'Healthy ticks stay quiet', /^Healthy ticks stay quiet\.$/);
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
  // default-auto-merge.test.js owns forge-only categories and both human npm gates.
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
