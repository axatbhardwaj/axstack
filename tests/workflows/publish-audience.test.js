import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const source = readFileSync(`${import.meta.dir}/../../skills/axstack-publish/SKILL.md`, 'utf8');
const page = sentences(source).join('. ');

// Each semantic contract proves removal-red, inversion-red and rewording-green
// against the actual skill sentences in memory, without changing shipped bytes.
function rule(name, concepts, rewording, inversions, prohibition) {
  test(name, () => checkRule(page,
    (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
    rewording, inversions, concepts));
}

rule('audience discovery runs privately on the validated host with JSON and no TTY',
  [/private mode/i, /run/i, /ssh <publish host> notes audience list/i, /validated/i, /one JSON line/i],
  'On the validated host, run ssh <publish host> notes audience list in private mode with no TTY, accepting one JSON line.',
  [[/run/i, 'skip'], [/private mode/i, 'public mode'], [/one JSON line/i, 'free-form output']], /no TTY/i);

rule('ask once only in private mode while binding before publishing',
  [/private mode only/i, /ask once/i, /binding the request/i, /before publishing/i],
  'While binding the request, ask once in private mode only, before publishing.',
  [[/private mode only/i, 'either mode'], [/before publishing/i, 'after publishing'], [/ask once/i, 'ask repeatedly']]);

rule('audience question requires enabled complete audiences and an unshared status',
  [/ask/i, /only (?:if|when)/i, /enabled/i, /complete/i, /disabled`?: false/i,
    /pending`?: null/i, /notes status --slug <slug>/i, /unshared/i],
  'Ask only when enabled, complete audiences exist (disabled: false, pending: null) and notes status --slug <slug> shows the slug unshared.',
  [[/only (?:if|when)/i, 'even unless'], [/unshared/i, 'already shared'], [/disabled`?: false/i, 'disabled: true']]);

rule('a new private-null slug counts as unshared',
  [/private`?: null/i, /new slug/i, /counts as unshared/i],
  'A new slug with private: null counts as unshared.',
  [[/counts as unshared/i, 'counts as shared']]);

rule('audience prompts offer one title or several titles with none',
  [/one audience/i, /Is this for <title>\?/i, /several/i, /For which audience: <titles> or none\?/i],
  'With one audience, use “Is this for <title>?” and with several, use “For which audience: <titles> or none?”.',
  [[/or none/i, 'without opting out']]);

rule('an existing publication question warns about earlier versions',
  [/already.published slug/i, /question/i, /team/i, /also see earlier versions/i],
  'For an already-published slug, the question warns that the team will also see earlier versions.',
  [[/also see earlier versions/i, 'only see the latest version']]);

rule('the answer authorizes exactly one slug and one audience',
  [/answer/i, /explicit grant request/i, /exactly (?:that|one) slug/i, /(?:that|one) audience/i],
  'The answer supplies the explicit grant request for exactly one slug and one audience.',
  [[/exactly (?:that|one) slug/i, 'every slug'], [/(?:that|one) audience/i, 'all audiences'], [/explicit/i, 'implicit']]);

rule('audiences are never inferred from slug title repository or label',
  [/infer/i, /audience/i, /slug/i, /title/i, /repository/i, /label/i],
  'Never infer an audience from the repository, label, title or slug.',
  [[/never/i, 'always']], /never/i);

test('no never revokes access', () => checkRule(page,
  // The quoted answer is a noun; preserve the separate instruction negation.
  (text) => prohibits(text.replace(/“no”|"no"/gi, 'negative answer'), /never/i,
    /negative answer/i, /revokes access/i),
  'Choosing “no” never revokes access.', [[/never/i, 'always']], [/“no”|"no"/i, /revokes access/i]));

rule('state the current audience from status before republishing',
  [/before/i, /republish/i, /state|report/i, /current audience/i, /status/i],
  'Before a republish, report the current audience from status.',
  [[/before/i, 'after'], [/current audience/i, 'guessed audience']]);

rule('public mode never asks or takes an audience',
  [/public mode/i, /asks/i, /takes/i, /audience/i],
  'In public mode, the flow never asks for or takes an audience.',
  [[/never/i, 'always']], /never/i);

rule('public promotion warns shared articles become world-readable',
  [/before/i, /promot/i, /shared slug/i, /public/i, /warn/i, /world.readable/i],
  'For a shared slug, warn before promoting to public that the article becomes world-readable.',
  [[/before/i, 'after'], [/warn/i, 'hide']]);

rule('audience list failures hold sharing with only the old-help exception',
  [/audience list/i, /failure/i, /holds sharing/i, /reported/i,
    /unless/i, /notes --help/i, /lacks/i, /notes audience list/i, /usage entry/i],
  'An audience list failure is reported and holds sharing unless notes --help lacks the notes audience list usage entry.',
  [[/holds sharing/i, 'continues sharing'], [/unless/i, 'even when'], [/lacks/i, 'contains']]);

rule('old hosts ask nothing new when help lacks audience list',
  [/notes --help/i, /lacks/i, /notes audience list/i, /entry/i, /ask/i],
  'Ask nothing new when notes --help lacks a notes audience list entry.',
  [[/nothing new/i, 'for an audience']], /nothing new/i);

rule('yes shares only after the verified private publish',
  [/yes/i, /only after/i, /verified private publish/i, /§3/i, /§4/i, /run/i,
    /ssh <publish host> notes grant add --slug <slug> --audience <audience>/i],
  'Only after the verified private publish (§3 and §4), on yes, run ssh <publish host> notes grant add --slug <slug> --audience <audience>.',
  [[/only after/i, 'before'], [/verified private publish/i, 'attempted upload'], [/yes/i, 'any answer']]);

rule('grant JSON is checked against the slug audience document and folder',
  [/check|validate/i, /grant/i, /JSON/i, /slug/i, /audience/i, /doc/i, /folder/i,
    /match/i, /requested/i, /published/i, /selected/i],
  'Validate grant JSON fields slug, audience, doc and folder match the requested slug and audience, published doc and selected folder.',
  [[/check|validate/i, 'ignore'], [/match/i, 'differ from']]);

rule('failed or held shares remain incomplete while private publish stays valid',
  [/report/i, /failed or held share/i, /incomplete/i, /private publish/i, /valid/i],
  'Report a failed or held share as incomplete while the private publish remains valid.',
  [[/incomplete/i, 'successful'], [/report/i, 'hide']]);

test('packaged publish guidance uses audience placeholders and excludes service IDs', () => {
  const safe = (text) => text.includes('<audience>') && !/\b(?:fld|doc|usr)_[A-Za-z0-9-]+/.test(text);
  expect(safe(source)).toBe(true);
  expect(safe(source.replaceAll('<audience>', 'example'))).toBe(false);
  for (const prefix of ['fld', 'doc', 'usr']) expect(safe(`${source}\n${prefix}_fixture`)).toBe(false);
  expect(safe(`${source}\nUse the chosen <audience>.`)).toBe(true);
});
