import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const preview = 'axstack/references/preview.md';
// An absent guidance file means absent instructions, rather than an import error.
const read = (path) => existsSync(`${import.meta.dir}/../../skills/${path}`)
  ? readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8') : '';
const text = () => read(preview).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// D1-D9 protect shipped prompt obligations. Existing watch and UI tests do not
// cover preview authority or lifecycle. No test claims live host compliance.
// Each rule removes concepts and inverts real-source instructions in memory.
// Equivalent variants change incidental verbs while preserving policy concepts.
const prohibition = /never|do not|does not/i;
const rules = [
  ['D1 VPS host only', [/preview/i, /only when/i, /run.s T3 host/i, /VPS/i],
    "Launch a preview only when the run's T3 host is the VPS."],
  ['D1 other host records and continues', [/other host/i, /no preview: run host is not the VPS/i, /continue|proceed/i],
    'On every other host, log "no preview: run host is not the VPS" and proceed.', /no preview: run host is not the VPS/i],
  ['D2 owner decides each own PR', [/each|every/i, /own PR/i, /owner/i, /decid|assess|determin/i, /preview/i, /makes sense|appropriate/i],
    'For every own PR, the owner assesses whether a preview is appropriate.'],
  ['D2 requires base command and visible change', [/both/i, /runnable dev-server command/i, /base branch/i, /AGENTS.md/i, /or/i, /README/i, /user-visible change/i, /PR/i],
    "Demand both a user-visible change in the PR and a runnable dev-server command documented in the base branch's README or AGENTS.md."],
  ['D2 command comes from base', [/command/i, /only/i, /base/i],
    'Obtain the command only from the base.'],
  ['D2 never command from head', [/command/i, /PR head/i],
    'Do not obtain the command from the PR head.', prohibition],
  ['D2 absent requirement skips preview', [/either requirement/i, /missing/i, /no preview/i],
    'If either requirement is missing, log no preview.', /no preview/i],
  ['D3 isolated head user unit', [/owner/i, /preview/i, /isolated checkout/i, /PR head/i, /systemd user unit/i],
    'The owner launches the preview as a systemd user unit from an isolated checkout of the PR head.'],
  ['D3 resource and time limits', [/RuntimeMaxSec=4h/i, /MemoryMax=2G/i, /CPUQuota=200%/i],
    'Apply CPUQuota=200%, MemoryMax=2G, and RuntimeMaxSec=4h.'],
  ['D3 documented dev or test environment only', [/only/i, /repository-documented/i, /dev or test/i, /environment sources/i],
    'Choose only repository-documented dev or test environment sources.'],
  ['D3 confirm listener after start', [/after start|after launch/i, /process/i, /(?:listens only on|binds only to) loopback/i],
    'After launch, verify the process binds only to loopback.'],
  ['D3 confirm serve target after start', [/after start|after launch/i, /tailscale serve/i, /target|endpoint/i, /127\.0\.0\.1:<port>/i],
    'After launch, verify the tailscale serve endpoint is 127.0.0.1:<port>.'],
  ['D3 failed loopback checks tear down and record', [/either loopback check/i, /fails/i, /tear down|dismantle/i, /no preview: not loopback-only/i],
    'If either loopback check fails, dismantle the preview and log "no preview: not loopback-only".', /no preview: not loopback-only/i],
  ['D3 never Funnel', [/Tailscale Funnel/i],
    'Do not enable Tailscale Funnel.', prohibition],
  ['D4 missing prerequisites recorded', [/missing/i, /systemd user lingering/i, /Tailscale operator rights/i, /no preview/i],
    'Mark missing Tailscale operator rights or systemd user lingering as no preview.', /no preview/i],
  ['D4 prerequisites never changed', [/systemd user lingering/i, /Tailscale operator rights/i],
    'Do not alter Tailscale operator rights or systemd user lingering.', prohibition],
  ['D4 unrelated host configuration untouched', [/unrelated host/i, /service/i, /configuration/i],
    'Do not alter unrelated host services or configuration.', prohibition],
  ['D5 two per host', [/at most two/i, /previews/i, /per host/i],
    'Limit previews to at most two per host.'],
  ['D5 third waits', [/third preview/i, /wait|queued/i, /slot frees/i],
    'A third preview is queued until a slot frees.'],
  ['authority limited to unit and route', [/preview authority/i, /only/i, /preview unit/i, /tailscale serve/i, /route/i, /VPS/i],
    'Preview authority covers only the preview unit and its tailscale serve route on the VPS.'],
  ['no release, publish or install authority', [/procedure/i, /release/i, /npm publish/i, /host install/i, /authority/i],
    'This procedure confers no release, npm publish, or host install authority.',
    /no release, npm publish, or host install authority/i],
  ['D6 record and driver thread', [/Preview: <url> @ <served-sha>/i, /run record/i, /driver thread/i],
    'Save `Preview: <url> @ <served-sha>` in the driver thread and the run record.'],
  ['D6 served revision distinct from PR head', [/served revision/i, /distinct from|separate from/i, /PR head SHA/i],
    'Identify it as the served revision, separate from the PR head SHA.'],
  ['D6 private PR descriptions only', [/Preview line/i, /preview queued/i, /note/i, /PR description/i, /only/i, /private repositories/i],
    'Include the Preview line and any preview queued note in the PR description only for private repositories.'],
  ['D6 private body records updated', [/restart or teardown/i, /update or remove|refresh or delete/i, /Preview line/i, /preview queued/i, /note/i, /private PR description/i],
    'After each restart or teardown, refresh or delete the Preview line and any preview queued note in the private PR description.'],
  ['D7 remove both resources', [/teardown/i, /remove|delete/i, /both/i, /unit/i, /tailscale serve/i, /route/i],
    'At teardown, delete both the unit and its tailscale serve route.'],
  ['D7 read back both absent', [/read back|verify/i, /absence/i, /both/i, /unit/i, /tailscale serve/i, /route/i],
    'Verify the absence of both the unit and its tailscale serve route.'],
  ['D7 teardown triggers', [/teardown/i, /PR merges or closes/i, /watch ends/i, /time limit stops the unit/i],
    'Perform teardown when the watch ends, the PR merges or closes, or the time limit stops the unit.'],
  ['D7 time-limit route removal', [/ExecStopPost/i, /remove|delete/i, /route/i, /time limit/i, /stops the unit/i],
    'Configure ExecStopPost to delete the route when the time limit stops the unit.'],
  ['D7 head change restarts', [/PR head changes/i, /restart|relaunch/i, /preview/i, /new head/i],
    'When the PR head changes, relaunch the preview on the new head.'],
  ['D7 failed teardown holds with receipt', [/teardown fails/i, /hold|block progress/i, /receipt/i],
    'If teardown fails, block progress and log a receipt.'],
  ['D8 production secrets prohibited everywhere', [/production secrets/i, /preview/i, /any repository/i],
    'Do not bring production secrets into a preview in any repository.', prohibition],
  ['D9 verifier can use URL', [/axstack-ui-verifier/i, /can use/i, /preview URL/i],
    'The axstack-ui-verifier may use the preview URL.', undefined, /may use/gi],
  ['D9 preview never replaces UI verification', [/preview/i, /replace|substitut/i, /UI verification/i],
    'A preview does not substitute for UI verification.', prohibition],
];
// Opposites preserve policy subjects while reversing the action or boundary.
// These probes use neither 'not' nor 'never'; substitutions stay in memory.
const inversionProbes = {
  'D1 VPS host only': [[/\b(?:start|launch) a preview\b/i], "Stop a preview only when the run's T3 host is the VPS."],
  'D1 other host records and continues': [[/\b(?:record|log)\b/i], 'On every other host, suppress the no preview report and halt.'],
  'D2 owner decides each own PR': [[/\bowner (?:decides|assesses|determines)\b/i], 'For every own PR, the owner delegates deciding whether a preview makes sense to the author.'],
  'D2 requires base command and visible change': [[/\b(?:require|demand) both\b/i], "Waive both a runnable dev-server command documented in the base branch's AGENTS.md or README and a user-visible change in the PR."],
  'D2 command comes from base': [[/\b(?:read|obtain) the command only from the base\b/i], 'Read the command only from the PR head instead of the base.'],
  'D2 never command from head': [[/\b(?:read|obtain) the command\b/i], 'Read the command from the PR head.'],
  'D2 absent requirement skips preview': [[/\b(?:record|log)\b/i], 'If either requirement is missing, discard no preview.'],
  'D3 isolated head user unit': [[/\bowner (?:starts|launches) the preview\b/i], 'The owner stops the preview as a systemd user unit from an isolated checkout of the PR head.'],
  'D3 resource and time limits': [[/\b(?:set|apply)\b/i], 'Disable RuntimeMaxSec=4h, MemoryMax=2G, and CPUQuota=200%.'],
  'D3 documented dev or test environment only': [[/\b(?:use|choose) only\b/i], 'Reject only repository-documented dev or test environment sources.'],
  'D3 confirm listener after start': [[/\b(?:confirm|verify) (?:the )?process\b/i], 'After start, disregard whether the process listens only on loopback.'],
  'D3 confirm serve target after start': [[/\b(?:confirm|verify) (?:the )?`?tailscale serve\b/i], 'After start, ignore the tailscale serve target 127.0.0.1:<port>.'],
  'D3 failed loopback checks tear down and record': [[/\b(?:tear down|dismantle)\b/i, /\b(?:record|log)\b/i], 'If either loopback check fails, retain the preview and discard the no preview report.'],
  'D3 never Funnel': [[/\b(?:use|enable) Tailscale Funnel\b/i], 'Use Tailscale Funnel.'],
  'D4 missing prerequisites recorded': [[/\b(?:report|mark) missing\b/i], 'Discard missing Tailscale operator rights or systemd user lingering as no preview.'],
  'D4 prerequisites never changed': [[/\b(?:change|alter)\b/i], 'Change systemd user lingering and Tailscale operator rights.'],
  'D4 unrelated host configuration untouched': [[/\b(?:change|alter) unrelated host\b/i], 'Change unrelated host services or configuration.'],
  'D5 two per host': [[/\b(?:run at most two|limit previews to at most two)\b/i], 'Run unlimited previews per host.'],
  'D5 third waits': [[/\b(?:waits|is queued) until a slot frees\b/i], 'A third preview bypasses waiting and launches before a slot frees.'],
  'authority limited to unit and route': [[/\b(?:covers|includes) only\b/i], 'Preview authority exceeds only the preview unit and its tailscale serve route on the VPS.'],
  'no release, publish or install authority': [[/\b(?:grants|confers)\b/i], 'This procedure grants full release, npm publish, and host install authority.'],
  'D6 record and driver thread': [[/\b(?:record|save) `?Preview:/i], 'Discard `Preview: <url> @ <served-sha>` in the run record and the driver thread.'],
  'D6 served revision distinct from PR head': [[/\b(?:label|identify) it as the served revision\b/i], 'Label it as the served revision, identical to the PR head SHA.'],
  'D6 private PR descriptions only': [[/\b(?:put|include) the Preview line\b/i], 'Withhold the Preview line and any preview queued note from the PR description only for private repositories.'],
  'D6 private body records updated': [[/\b(?:update or remove|refresh or delete) the Preview line\b/i], 'After each restart or teardown, suspend update or remove operations on the Preview line and any preview queued note in the private PR description.'],
  'D7 remove both resources': [[/\b(?:remove|delete) both the unit\b/i], 'At teardown, retain both the unit and its tailscale serve route.'],
  'D7 read back both absent': [[/\b(?:read back|verify) the absence\b/i], 'Claim the absence of both the unit and its tailscale serve route instead of read back.'],
  'D7 teardown triggers': [[/\b(?:run|perform) teardown when\b/i], 'Postpone teardown when the PR merges or closes, the watch ends, or the time limit stops the unit.'],
  'D7 time-limit route removal': [[/\b(?:remove|delete) the route\b/i], 'Use ExecStopPost to retain the route when the time limit stops the unit.'],
  'D7 head change restarts': [[/\b(?:restart|relaunch) the preview on the new head\b/i], 'When the PR head changes, defer restart of the preview on the new head.'],
  'D7 failed teardown holds with receipt': [[/\b(?:hold|block progress) and (?:record|log) a receipt\b/i], 'If teardown fails, bypass the hold and discard the receipt.'],
  'D8 production secrets prohibited everywhere': [[/\b(?:use|bring) production secrets\b/i], 'Use production secrets for a preview in any repository.'],
  'D9 verifier can use URL': [[/\baxstack-ui-verifier`? can use\b/i], 'The axstack-ui-verifier loses permission to use the preview URL.'],
  'D9 preview never replaces UI verification': [[/\b(?:replaces|substitutes? for) UI verification\b/i], 'A preview replaces UI verification.'],
};
const requiredConcepts = ([name, concepts]) => [...concepts, ...inversionProbes[name][0]];
const accepts = (row) => (source) => {
  const [, , , negative, permission] = row;
  const concepts = requiredConcepts(row);
  // Only the verifier permission treats 'may use' as equivalent to 'can use'.
  // Mandatory rules still reject optional wording; all rules reject negation.
  const normalized = permission ? source.replace(permission, 'can use') : source;
  return negative ? prohibits(normalized, negative, ...concepts) : requires(normalized, ...concepts);
};

for (const row of rules) {
  const [name, , rewording, negative] = row;
  const concepts = requiredConcepts(row);
  const inversion = negative === prohibition ? [prohibition, 'always'] : [/^/, 'Never '];
  const [, opposite] = inversionProbes[name];
  test(`PR preview semantic inversion and removal: ${name} -> ${opposite}`, () => {
    expect(opposite).not.toMatch(/\b(?:not|never)\b/i);
    checkRule(text(), accepts(row), rewording, [inversion, [/^.*$/, opposite]], concepts);
  });
  test(`PR preview real-source rewording: ${name}`, () => {
    const source = text();
    const targets = sentences(source).filter(accepts(row));
    expect(targets.length).toBeGreaterThan(0);
    const reworded = targets.reduce((result, target) => result.replace(target, rewording), source);
    for (const sibling of rules) expect(accepts(sibling)(reworded), sibling[0]).toBe(true);
  });
}

for (const [name, opposite] of [
  ['D3 confirm listener after start', 'After start, confirm the process listens on all interfaces.'],
  ['D3 confirm serve target after start', 'After start, confirm the tailscale serve target is 0.0.0.0:<port>.'],
]) {
  test(`PR preview semantic inversion: ${name} -> ${opposite}`, () => {
    expect(opposite).not.toMatch(/\b(?:not|never)\b/i);
    const row = rules.find(([ruleName]) => ruleName === name);
    const source = text();
    const targets = sentences(source).filter(accepts(row));
    expect(targets.length).toBeGreaterThan(0);
    const inverted = targets.reduce((result, target) => result.replace(target, opposite), source);
    expect(accepts(row)(inverted)).toBe(false);
  });
}

for (const [path, link] of [
  ['axstack/references/ui-verification.md', 'preview.md'],
  ['axstack-watch/references/watch-runtime.md', '../../axstack/references/preview.md'],
  ['axstack-watch/references/repair-publication.md', '../../axstack/references/preview.md'],
  ['axstack-implement/SKILL.md', '../axstack/references/preview.md'],
]) {
  test(`PR preview procedure loaded at ${path}`, () => {
    const source = read(path);
    const directive = source.split(/\n\s*\n/).find((paragraph) => paragraph.includes(`](${link})`));
    expect(loadedReferences(source)).toContain(link);
    expect(directive).toBeDefined();
    expect(loadedReferences(source.replace(directive, ''))).not.toContain(link);
    expect(loadedReferences(source.replace(directive, `Consult [PR previews](${link}).`))).toContain(link);
    expect(loadedReferences(source.replace(directive, `Never follow [PR previews](${link}).`))).not.toContain(link);
    expect(existsSync(`${import.meta.dir}/../../skills/${path.slice(0, path.lastIndexOf('/'))}/${link}`)).toBe(true);
  });
  test(`PR preview semantic inversion: load ${path} -> Ignore [PR previews](${link}).`, () => {
    const source = read(path);
    const directive = source.split(/\n\s*\n/).find((paragraph) => paragraph.includes(`](${link})`));
    expect(loadedReferences(source)).toContain(link);
    expect(directive).toBeDefined();
    expect(loadedReferences(source.replace(directive, `Ignore [PR previews](${link}).`))).not.toContain(link);
  });
}
