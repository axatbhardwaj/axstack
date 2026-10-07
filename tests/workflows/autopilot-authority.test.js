import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const autopilot = 'skills/axstack/references/autopilot.md';
const spec = 'skills/axstack-spec/SKILL.md';
const read = (path) => sentences(readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')).join('. ');

// These contracts protect shipped instructions, not live release or merge behavior.
// Mutate each accepted real-source sentence only in memory, including qualifiers.
function rule(name, path, concepts, rewording, inversions, prohibition) {
  test(name, () => checkRule(read(path), (source) => sentences(source).some((sentence) =>
    !/\b(?:unless|except|cannot)\b/i.test(sentence)
    && (prohibition ? prohibits(sentence, prohibition, ...concepts) : requires(sentence, ...concepts))),
  rewording, [...inversions, [/\.?$/, ' unless convenient']], concepts));
}

rule('AGENTS can grant standing release and install authority with trigger and hosts', autopilot,
  [/AGENTS\.md/i, /can grant/i, /standing release and install authority/i, /trigger/i, /named hosts/i],
  'With a trigger and named hosts, AGENTS.md can grant standing release and install authority.',
  [[/can grant/i, 'cannot grant'], [/standing/i, 'per-run-only']]);
rule('matching runs copy standing authority without a per-run question', autopilot,
  [/run matches/i, /trigger/i, /copy/i, /standing authority/i, /Release:/i, /Authority:/i, /without a per-run question/i],
  'Copy standing authority into Release: and Authority: without a per-run question when a run matches that trigger.',
  [[/copy/i, 'Omit'], [/without a per-run question/i, 'after a per-run question'], [/run matches/i, 'run ignores']]);
rule('standing release authority stays within its repository', autopilot,
  [/standing authority/i, /applies only/i, /that repository/i],
  'Standing authority applies only within that repository.',
  [[/applies only/i, 'applies broadly'], [/that repository/i, 'every repository']]);
rule('this repository releases shipped skill or src changes on io, iobook and vps', 'AGENTS.md',
  [/when a run changes/i, /shipped skills/i, /or `?src\/`?/i, /release and reinstall/i,
    /on `?io`?\b/i, /desktop/i, /\biobook\b/i, /laptop/i, /`?vps`?/i, /SSH alias/i],
  'On io (desktop), iobook (laptop, SSH alias) and vps (SSH alias), release and reinstall when a run changes shipped skills or src/.',
  [[/release and reinstall/i, 'skip release and reinstall'], [/when a run changes/i, 'when a run preserves'],
    [/or `?src\/`?/i, 'and src/'], [/on `?io`?\b/i, 'on a guessed host'],
    [/\biobook\b/i, 'a guessed host'], [/laptop/i, 'unknown device']]);
rule('docs-only runs do not release', 'AGENTS.md',
  [/docs-only run/i, /release/i],
  'A docs-only run does not trigger a release.', [[/does not/i, 'does']], /does not/i);
rule('every resume applies standing merge delegation', autopilot,
  [/every resume/i, /apply/i, /standing merge delegation/i, /watch §5/i],
  'Apply standing merge delegation under watch §5 on every resume.',
  [[/apply/i, 'Discard'], [/every resume/i, 'initial entry only']]);
rule('merge delegation narrows only by user instruction', autopilot,
  [/narrow/i, /standing merge delegation/i, /without a user instruction/i],
  'Without a user instruction, never narrow standing merge delegation.',
  [[/never/i, 'Always'], [/without a user instruction/i, 'at driver discretion']], /never/i);
rule('spec cannot invent extra user-merge decisions', spec,
  [/add/i, /driver-invented spec decision/i, /user merge PRs/i, /outside/i, /watch §5/i, /user-merge categories/i],
  "Outside watch §5's user-merge categories, never add a driver-invented spec decision that makes the user merge PRs.",
  [[/never/i, 'Always'], [/outside/i, 'inside']], /never/i);
for (const path of [spec, autopilot]) {
  rule(`${path}: explicit user merge restrictions win`, path,
    [/explicit user restrictions/i, /Auto-merge: off/i, /chat holds/i, /user instructions/i, /always win/i],
    'Explicit user restrictions always win, including Auto-merge: off, chat holds, and user instructions.',
    [[/always win/i, 'are overridden'], [/explicit user restrictions/i, 'driver preferences']]);
}

rule('publish, tag, and install failures retain release holds', autopilot,
  [/existing version or tag/i, /failed publish/i, /pending approval/i, /uncertain registry result/i,
    /missing host access/i, /failed install verification/i, /resumable hold/i],
  'An existing version or tag, failed publish, pending approval, uncertain registry result, missing host access, or failed install verification retains a resumable hold, never success.',
  [[/resumable hold/i, 'success'], [/never success/i, 'success']], /never success/i);

rule('public release authority includes standing grants copied into the run', 'docs/workflows.md',
  [/release and install/i, /require/i, /recorded authority/i, /standing authority/i, /from AGENTS\.md/i,
    /copied into the run/i, /Release:/i, /Authority:/i, /or explicit per-run authority/i],
  "Recorded authority is required for release and install: standing authority from AGENTS.md copied into the run's Authority: and Release:, or explicit per-run authority.",
  [[/require/i, 'skip'], [/standing authority/i, 'unrecorded authority'],
    [/copied into the run/i, 'omitted from the run'], [/or explicit per-run authority/i, 'only explicit per-run authority']]);
rule('release actions accept the run recorded authority and keep existing checks', autopilot,
  [/tagging/i, /publishing/i, /installation/i, /host mutation/i, /require/i, /run.s recorded authority/i, /existing checks/i],
  "The run's recorded authority and existing checks are required for tagging, publishing, installation, and host mutation.",
  [[/require/i, 'skip'], [/run.s recorded authority/i, 'recorded per-run authority']]);
