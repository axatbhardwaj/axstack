import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const path = `${import.meta.dir}/../../skills/axstack-improve/SKILL.md`;
const lens = () => (readFileSync(path, 'utf8').split(/### Readiness lens\b/i)[1] ?? '')
  .split(/\n## /)[0].replace(/[`*]/g, '').replace(/\s+/g, ' ');

// These protect the declared agent instructions, not live agent compliance.
// Every rule mutates the real lens in memory: removal/inversion red and
// equivalent rewording green. No new production seam is needed.
const rules = [
  ['run the helper', (s) => requires(s, /\b(?:run|execute)\b/i,
    /bun \.\.\/axstack\/scripts\/readiness\.js/, /--repo <repo>/),
    'Execute bun ../axstack/scripts/readiness.js --repo <repo>.',
    [[/\b(?:run|execute)\b/i, 'skip']], [/scripts\/readiness\.js/, /--repo <repo>/]],
  ['archive by UTC and revision', (s) => requires(s, /--out <git-common-dir>\/axstack\/readiness\/<UTC>-<rev>\.json/),
    'Save with --out <git-common-dir>/axstack/readiness/<UTC>-<rev>.json.',
    [[/--out <git-common-dir>/, '--out <repo>']], [/<UTC>/, /<rev>/, /axstack\/readiness/]],
  ['explicit previous baseline', (s) => requires(s, /\b(?:pass|supply)\b/i,
    /previous report/i, /explicitly/i, /--baseline/),
    'Explicitly supply the previous report as --baseline.',
    [[/\b(?:pass|supply)\b/i, 'ignore']], [/previous report/i, /--baseline/]],
  ['rank gaps', (s) => requires(s, /\b(?:return|report)\b/i, /\b(?:ranked|prioritized) gaps/i),
    'Report prioritized gaps.', [[/(?:ranked|prioritized)/i, 'unranked']], [/gaps/i]],
  ['testing route', (s) => requires(s, /\b(?:route|send)\b/i, /testing/i, /gaps/i, /to axstack-verify/),
    'Send testing gaps to axstack-verify.',
    [[/to axstack-verify/, 'to axstack-implement']], [/testing/i]],
  ['development environment route', (s) => requires(s, /\b(?:route|send)\b/i,
    /(?:dev-environment|development environment)/i, /gaps/i, /to axstack-verify/),
    'Send development environment gaps to axstack-verify.',
    [[/to axstack-verify/, 'to axstack-implement']], [/(?:dev-environment|development environment)/i]],
  ['remaining repair route', (s) => requires(s, /\b(?:route|send)\b/i,
    /(?:others|remaining gaps)/i, /to axstack-implement/),
    'Send remaining gaps to axstack-implement.',
    [[/to axstack-implement/, 'to axstack-verify']], [/(?:others|remaining gaps)/i]],
  ['coherent PR boundary', (s) => requires(s, /(?:one|a single) PR per coherent repair/i),
    'Use a single PR per coherent repair.',
    [[/(?:one|a single) PR per coherent repair/i, 'one PR for all repairs']], [/coherent/i]],
  ['admin route', (s) => requires(s, /\b(?:escalate|send)\b/i, /needs admin/i, /gaps/i, /to the user/i),
    'Send needs admin gaps to the user.',
    [[/to the user/i, 'to axstack-implement']], [/needs admin/i]],
  ['repair authority', (s) => prohibits(s, /(?:never|do not) repair without authority/i),
    'Do not repair without authority.',
    [[/(?:never|do not) repair without authority/i, 'Repair without authority']]],
  ['execution authorization', (s) => requires(s, /(?:use|execute) --run only/i,
    /repositories/i, /the user owns or authorizes/i),
    'Execute --run only for repositories the user owns or authorizes.',
    [[/(?:use|execute) --run only/i, 'Use --run freely']], [/owns/i, /authorizes/i]],
  ['sandbox boundary', (s) => prohibits(s, /(?:not a sandbox|does not provide sandboxing)/i),
    'Execution does not provide sandboxing.',
    [[/(?:not a sandbox|does not provide sandboxing)/i, 'provides sandboxing']]],
  ['credential exposure', (s) => prohibits(s, /(?:not a sandbox|does not provide sandboxing)/i,
    /(?:can read|can access) on-disk credentials/i),
    'Execution does not provide sandboxing: repository code can access on-disk credentials.',
    [[/(?:can read|can access) on-disk credentials/i, 'cannot access on-disk credentials']], [/credentials/i]],
  ['writes beyond scratch', (s) => prohibits(s, /(?:not a sandbox|does not provide sandboxing)/i,
    /(?:can |and )write outside scratch/i),
    'Execution does not provide sandboxing: repository code can write outside scratch.',
    [[/write outside scratch/i, 'write only inside scratch']], [/scratch/i]],
];

for (const [name, accepts, rewording, inversions, concepts] of rules) {
  test(`readiness lens: ${name} survives rewording and rejects removal/inversion`, () => {
    checkRule(lens(), accepts, rewording, inversions, concepts);
  });
}

test('readiness lens supplies one literal invocation, output contract and help pointer', () => {
  const source = readFileSync(path, 'utf8').split(/### Readiness lens\b/i)[1]?.split(/\n## /)[0] ?? '';
  expect(Buffer.byteLength(`### Readiness lens${source}`)).toBeLessThanOrEqual(1000);
  const invocations = [...source.matchAll(/```sh\n([^`]+)\n```/g)];
  expect(invocations).toHaveLength(1);
  expect(invocations[0][1]).toMatch(/^bun \.\.\/axstack\/scripts\/readiness\.js /);
  checkRule(lens(), (s) => requires(s, /(?:outputs|prints)/i, /criterion evidence/i,
    /revision/i, /pillar counts/i, /(?:full JSON report path|path to the full JSON report)/i),
    'Prints the revision, criterion evidence, pillar counts and path to the full JSON report.',
    [[/(?:outputs|prints)/i, 'hides']]);
  checkRule(lens(), (s) => requires(s, /(?:flags|options)/i, /(?:live|documented) in --help/i),
    'Options are documented in --help.', [[/--help/, 'this prose']]);
});
