import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (name) => readFileSync(`${import.meta.dir}/../../skills/${name}/SKILL.md`, 'utf8');
const compact = (name) => read(name).replace(/\s+/g, ' ');
const routesBroadMapping = (source) => sentences(source).some((sentence) =>
  requires(sentence, /broad (?:codebase )?mapping/i,
    /\b(?:use|invoke|route|dispatch)\b.{0,100}axstack-scout/i));

test('research routes broad mapping through Scout, without direct explorer dispatch', () => {
  const text = compact('axstack-research');
  checkRule(text, routesBroadMapping,
    'For broad mapping, route exploration through axstack-scout.',
    [[/axstack-scout/i, 'axstack-explore-codebase']]);

  const noDirectExplorer = (source) => sentences(source).some((sentence) =>
    prohibits(sentence, /\b(?:do not|never) dispatch axstack-explore-codebase directly/i,
      /broad (?:codebase )?mapping/i));
  checkRule(text, noDirectExplorer,
    'Never dispatch axstack-explore-codebase directly for broad mapping.',
    [[/\b(?:Do not|Never)\b/i, 'Always'], [/axstack-explore-codebase/i, 'axstack-scout']]);
});

test('improve uses Scout for broad mapping without creating a profile', () => {
  const text = compact('axstack-improve');
  checkRule(text, routesBroadMapping,
    'For broad mapping, route exploration through axstack-scout.',
    [[/axstack-scout/i, 'axstack-explore-codebase']]);

  const noNewProfile = (source) => sentences(source).some((sentence) =>
    prohibits(sentence, /\b(?:do not|never) create (?:a )?new profile/i));
  checkRule(text, noNewProfile,
    'Never create a new profile.',
    [[/\b(?:Do not|Never)\b/i, 'Always']]);
});

test('Scout description offers agent evidence gathering without Explain triggers', () => {
  const description = read('axstack-scout').match(/^description:\s*(.+)$/m)?.[1];
  expect(description, 'Scout needs a frontmatter description').toBeDefined();
  expect(requires(description, /agent/i, /(?:evidence|cited findings)/i,
    /\b(?:gather|collect|investigate|find)\w*/i)).toBe(true);
  expect(description).not.toMatch(/\b(?:how|why|explain|show)\b|does not understand/i);
});
