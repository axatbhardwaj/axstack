import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
test('repository permits exactly the two opt-in systemd user timers', () => {
  const concepts = [/exception/i, /(?:exactly|only) (?:two|2)/i, /opt.in/i, /systemd user timers/i,
    /axstack-default-sync/, /axstack-single-server/];
  const allows = /\b(?:allow\w*|permit\w*)\b/i;
  checkRule(readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' '), (text) => requires(text, ...concepts, allows),
    'Exception: permit only two opt-in systemd user timers, axstack-default-sync and axstack-single-server.',
    [[allows, 'forbid']], [...concepts, allows]);
  const doc = readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' ');
  const noState = /(?:no|zero) workflow state/i;
  checkRule(doc, (text) => prohibits(text, noState, /timer/i),
    'Both timers keep zero workflow state.', [[noState, 'persistent workflow state']], [/timer/i, noState]);
  const noLaunch = /launch(?:es)? no|never launch(?:es)?/i;
  checkRule(doc, (text) => prohibits(text, noLaunch, /script/i, /agent/i),
    'The script never launches an agent.', [[noLaunch, 'launches']], [/script/i, /agent/i, noLaunch]);
});

test('default-sync remains confined to the stateless default-selection edit', () => {
  const concepts = [/axstack-default-sync/, /stateless script/i, /rewrites? only/i, /T3/, /defaultModelSelection(?!\.instanceId)/];
  checkRule(readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' '), (text) => requires(text, ...concepts),
    'The axstack-default-sync timer runs a stateless script that rewrites only T3 defaultModelSelection.',
    [[/rewrites? only/i, 'rewrites arbitrary fields including']], concepts);
});

test('single-server is stateless and prefers the ownership-lock keeper with a runtime fallback', () => {
  const concepts = [/axstack-single-server/, /stateless script/i, /(?:only SIGKILLs|SIGKILLs only)/i,
    /duplicate.*t3 serve/i, /one base dir/i, /(?:children|descendants)/i, /keep(?:s|ing)/i,
    /(?:holds?|holding) T3['’]s ownership lock/i, /(?:otherwise|else)/i, /server-runtime\.json/,
    /keep(?:s|ing).*(?:holds?|holding) T3['’]s ownership lock.*(?:otherwise|else).*server-runtime\.json/i];
  checkRule(readFileSync(`${root}/AGENTS.md`, 'utf8').replace(/\s+/g, ' '), (text) => requires(text, ...concepts),
    'The axstack-single-server timer runs a stateless script that SIGKILLs only duplicate t3 serve processes for one base dir and their descendants, keeping the server holding T3’s ownership lock, else the server recorded in server-runtime.json.',
    [[/(?:only SIGKILLs|SIGKILLs only)/i, 'SIGKILLs any'], [/keep(?:s|ing)/i, 'discarding'],
      [/(?:holds?|holding) T3['’]s ownership lock/i, 'ignores T3’s ownership lock'],
      [/(?:otherwise|else)/i, 'rather than'],
      [/keep(?:s|ing).*?(?:otherwise|else).*?server-runtime\.json/i,
        'keeping the server recorded in server-runtime.json, otherwise the server holding T3’s ownership lock']], concepts);
});


test('model discipline confines pooled sync to the New-chat default', () => {
  const doc = readFileSync(`${root}/skills/axstack/references/contracts.md`, 'utf8');
  const concepts = [/exception/i, /opt.in default sync/i, /only/i, /New.chat default/i, /user.configured pool/i];
  const permits = /\b(?:can|allows?|permits?)\b/i;
  checkRule(doc, (text) => requires(text, ...concepts, permits),
    'Exception: opt-in default sync permits changing only the New-chat default within the user-configured pool.',
    [[permits, 'forbids']], [...concepts, permits]);
  const boundaries = [/running threads/i, /dispatched roles/i, /schedules/i, /roles\.json/i];
  const unchanged = /(?:retain|keep) existing rules/i;
  checkRule(doc, (text) => requires(text, ...boundaries, unchanged),
    'Running threads, dispatched roles, schedules and roles.json retain existing rules.',
    [[unchanged, 'discard existing rules']], [...boundaries, unchanged]);
});

const modelRules = [
  ['driver account re-selection scope',
    [/\b(?:follow|consult)\b/i, /Provider bindings/i, /\bdriver\b/i, /\baccount\b/i, /re-selection/i, /turn boundaries/i],
    'Consult Provider bindings for driver account re-selection at turn boundaries.', /\b(?:follow|consult)\b/i, 'Skip the binding'],
  ['substitution excludes only that account selection',
    [/substitution/i, /chang(?:e|es|ing)/i, /provider/i, /model/i, /excluding/i, /\b(?:that|those)\b/i, /\baccount\b/i, /\b(?:selection|picks?)\b/i],
    'Substitution means a provider or model change, excluding those account picks.', /excluding/i, 'including'],
  ['configured binding at actual launch',
    [/\b(?:validate|check)\b/i, /\b(?:configured|specified)\b/i, /provider/i, /model/i, /\b(?:actual|real)\b/i, /\blaunch\b/i],
    'Check the specified provider and model at real launch.', /\b(?:validate|check)\b/i, 'Skip validation'],
  ['separate requested and effective settings checks',
    [/\b(?:verify|check)\b/i, /requested/i, /effective/i, /settings/i, /\b(?:separately|independently)\b/i],
    'Check requested and effective settings independently.', /\b(?:verify|check)\b/i, 'Skip verification'],
];
for (const [name, concepts, rewording, direction, inversion] of modelRules) {
  test(`model discipline preserves ${name}`, () => {
    const doc = readFileSync(`${root}/skills/axstack/references/contracts.md`, 'utf8')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
    checkRule(doc, (text) => requires(text, ...concepts), rewording,
      [[direction, inversion]], concepts);
  });
}

test('model discipline forbids only other quota-derived routes', () => {
  const doc = readFileSync(`${root}/skills/axstack/references/contracts.md`, 'utf8').replace(/\s+/g, ' ');
  const prohibition = /never infer|do not derive/i;
  const concepts = [/\bother\b/i, /\b(?:route|routing)\b/i, /quota(?: state)?/i, /(?:subscription )?entitlement/i];
  checkRule(doc, (text) => prohibits(text, prohibition, ...concepts),
    'Do not derive any other routing from quota state or subscription entitlement.',
    [[prohibition, 'Always infer']], [...concepts, prohibition]);
});
