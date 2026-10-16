import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
function files(path) {
  return readdirSync(`${root}/${path}`, { withFileTypes: true }).flatMap((entry) => {
    const name = `${path}/${entry.name}`;
    return entry.isDirectory() ? files(name) : [name];
  });
}

test('the shipped workflow has no removed notification transport', () => {
  expect(existsSync(`${root}/skills/axstack-relay`)).toBe(false);
  const shipped = ['skills', 'profiles', 'src', 'bin', '.agents/skills/verify-axstack'].flatMap(files);
  shipped.push('README.md', ...files('docs').filter((path) => /^docs\/[^/]+\.md$/.test(path)));
  const hits = shipped.filter((path) => /axstack-relay|hermes|telegram|notification policy|machines\.json/i.test(readFileSync(`${root}/${path}`, 'utf8')));
  expect(hits).toEqual([]);
});

test('watch raises user decisions in the T3 driver thread and parks the turn', () => {
  const source = readFileSync(`${root}/skills/axstack-watch/SKILL.md`, 'utf8').replace(/\s+/g, ' ');
  const concepts = [/user-decision holds/i, /T3 driver thread/i, /ends? (?:its|the) turn/i, /parked on the decision/i];
  checkRule(source, (text) => requires(text, ...concepts),
    'Raise user-decision holds in the T3 driver thread; the driver ends its turn parked on the decision.',
    [[/parked on the decision/i, 'continuing without the decision']], concepts);
});
