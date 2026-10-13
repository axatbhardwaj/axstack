import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (name) => readFileSync(`${import.meta.dir}/../../skills/${name}/SKILL.md`, 'utf8');
const compact = (name) => read(name).replace(/\s+/g, ' ');
const routesBroadMapping = (source) => sentences(source).some((sentence) =>
  requires(sentence, /broad (?:codebase )?mapping/i,
    /\b(?:use|invoke|route|dispatch)\b.{0,100}axstack-scout/i));
const noDirectExplorer = (source) => sentences(source).some((sentence) =>
  prohibits(sentence, /\b(?:do not|never)\s+(?:directly\s+)?dispatch\s+`?axstack-explore-codebase`?\s*(?:directly)?/i,
    /broad (?:codebase )?mapping/i));
const profileDenial = /\b(?:(?:do not|never)\s+create\s+(?:a\s+)?new\s+profiles?|create\s+no\s+new\s+profiles?)\b/i;
const noNewProfile = (source) => sentences(source).some((sentence) =>
  prohibits(sentence, profileDenial));

test('research routes broad mapping through Scout, without direct explorer dispatch', () => {
  const text = compact('axstack-research');
  checkRule(text, routesBroadMapping,
    'For broad mapping, route exploration through axstack-scout.',
    [[/axstack-scout/i, 'axstack-explore-codebase']]);

  checkRule(text, noDirectExplorer,
    'Never dispatch axstack-explore-codebase directly for broad mapping.',
    [[/\b(?:Do not|Never)\b/i, 'Always'], [/axstack-explore-codebase/i, 'axstack-scout']]);
});

test.each([
  ['a backticked role ID', 'Never dispatch `axstack-explore-codebase` directly for broad mapping.'],
  ['directly before dispatch', 'Never directly dispatch axstack-explore-codebase for broad mapping.'],
])('research prohibition survives %s', (_case, rewording) => {
  checkRule(compact('axstack-research'), noDirectExplorer, rewording,
    [[/\b(?:Do not|Never)\b/i, 'Always'], [/axstack-explore-codebase/i, 'axstack-scout']]);
});

test('improve uses Scout for broad mapping without creating a profile', () => {
  const text = compact('axstack-improve');
  checkRule(text, routesBroadMapping,
    'For broad mapping, route exploration through axstack-scout.',
    [[/axstack-scout/i, 'axstack-explore-codebase']]);

  checkRule(text, noNewProfile,
    'Never create a new profile.',
    [[/\b(?:Do not|Never)\b/i, 'Always']]);
});

test('improve profile prohibition survives the original no-new-profile wording', () => {
  checkRule(compact('axstack-improve'), noNewProfile, 'Create no new profile.',
    [[profileDenial, 'Always create a new profile']]);
});

test('Scout description offers agent evidence gathering without Explain triggers', () => {
  const description = read('axstack-scout').match(/^description:\s*(.+)$/m)?.[1];
  expect(description, 'Scout needs a frontmatter description').toBeDefined();
  expect(requires(description, /agent/i, /(?:evidence|cited findings)/i,
    /\b(?:gather|collect|investigate|find)\w*/i)).toBe(true);
  expect(description).not.toMatch(/\b(?:how|why|explain|show)\b|does not understand/i);
});
