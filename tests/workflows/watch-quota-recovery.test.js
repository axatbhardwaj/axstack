import { test } from 'bun:test';
import { readSkillFile as readFileSync } from './skill-source.js';
import { checkRule, requires, prohibits, sentences } from './prose-contract.js';

const read = (path) => sentences(readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')).join('. ');
const runtime = () => read('axstack-watch/references/watch-runtime.md');

test('quota recovery records the reset deadline', () => {
  const concepts = [/GraphQL/i, /reset time|reset timestamp/i, /run record/i, /record the GraphQL|save the GraphQL/i];
  checkRule(read('axstack/references/t3-runtime.md'), (text) => requires(text, ...concepts),
    'Save the GraphQL reset timestamp in the run record.',
    [[/record the GraphQL|save the GraphQL/i, 'discard the GraphQL']], concepts);
});

test('rate-limited schedule wakes defer the digest until reset then resume', () => {
  const concepts = [/5-minute|five-minute/i, /schedule wakes/i,
    /before the recorded GraphQL reset time|until the saved GraphQL reset timestamp/i,
    /pr-digest\.js/i, /affected repository|rate-limited repository/i];
  const defer = /skip|defer/i;
  checkRule(sentences(runtime()).join('. '), (text) => prohibits(text, defer, ...concepts),
    'Until the saved GraphQL reset timestamp, defer pr-digest.js on five-minute schedule wakes for the rate-limited repository.',
    [[defer, 'execute']], concepts);
  const resume = [/first schedule wake/i, /at or after/i, /recorded GraphQL reset time|saved GraphQL reset timestamp/i,
    /resume|restart/i, /digest/i, /re-arm|rearm/i];
  checkRule(sentences(runtime()).join('. '), (text) => requires(text, ...resume),
    'On the first schedule wake at or after the saved GraphQL reset timestamp, restart the digest and rearm.',
    [[/at or after/i, 'before'], [/resume|restart/i, 'skip']], resume);
});
