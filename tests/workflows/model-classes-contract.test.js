import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('run snapshot records class resolution and reuses it on resume', () => {
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/for each role[^.]*class[^.]*exact ID[^.]*source[^.]*time/i);
  expect(routing).toMatch(/resume[^.]*reuse[^.]*snapshot[^.]*never re-resolve/i);
  expect(routing).toMatch(/provider\/model class/i);
});

test('pre-turn Codex rejection alone amends the routing snapshot with retry lineage', () => {
  const routing = compact('skills/axstack/references/routing.md');
  const runtime = compact('skills/axstack/references/orca-runtime.md');
  for (const text of [routing, runtime]) {
    expect(text).toMatch(/pre-turn Codex rejection[^.]*amend[^.]*routing snapshot/i);
    expect(text).toMatch(/--exclude[^.]*rejected slug/i);
    expect(text).toMatch(/--retry-of[^.]*lineage/i);
    expect(text).toMatch(/same class[^.]*provider[^.]*effort/i);
    expect(text).toMatch(/timeout[^.]*quota[^.]*auth[^.]*hold/i);
  }
});

const modelRules = [
  {
    name: 'resolution provenance', path: 'routing.md',
    concepts: [/record|log/i, /class|famil/i, /exact|resolved|precise/i, /\b(?:ID|identifier)s?\b/i, /source|provenance/i, /capabilities/i, /time(?:stamp)?/i],
    rewording: 'Log the time, source capabilities, class and exact ID for every role.',
  },
  {
    name: 'both provider classes', path: 'routing.md',
    concepts: [/resolv/i, /Codex/i, /Claude/i, /class/i, /saved/i, /capabilities/i, /--provider/i, /--capabilities/i],
    rewording: 'With --capabilities and --provider, resolve the Claude and Codex classes from saved capabilities.',
  },
  {
    name: 'transcript retirement', path: 'routing.md',
    concepts: [/Claude/i, /exact|resolved|precise/i, /\b(?:ID|identifier)s?\b/i, /capabilities/i, /replac|retir|supersed/i, /transcript/i],
    rewording: 'Capabilities supply each Claude exact ID and retire transcript read-back.',
  },
  {
    name: 'trust preflight exemption', path: 'automations.md',
    concepts: [/T3/i, /session/i, /Claude/i, /trust/i, /preflight/i, /exempt|unnecessary|dispens/i],
    rewording: 'Claude trust preflight is unnecessary for sessions running in T3.',
  },
];

for (const { name, path, concepts, rewording } of modelRules) {
  test(`T3 model rule: ${name} rejects removal and generic negation, accepts independent wording`, () => {
    const text = read(`skills/axstack/references/${path}`);
    const matches = sentences(text).filter((sentence) => requires(sentence, ...concepts));
    expect(matches, name).toHaveLength(1);
    expect(requires(text, ...concepts)).toBe(true);
    expect(requires(sentences(text).filter((sentence) => !matches.includes(sentence)).join('. '), ...concepts)).toBe(false);
    // One shared inversion for all rules, rather than hand-picked per-rule flips.
    expect(requires(`Do not ${matches[0]}`, ...concepts)).toBe(false);
    expect(requires(rewording, ...concepts)).toBe(true);
  });
}

test('only explicit pre-turn Codex model rejection permits recorded within-class retry', () => {
  for (const path of [
    'skills/axstack/references/contracts.md',
    'skills/axstack/references/routing.md',
    'skills/axstack/references/orca-runtime.md',
    'skills/axstack-review/SKILL.md',
  ]) {
    const text = compact(path);
    expect(text, path).toMatch(/explicit model rejection[^.]*before[^.]*first turn/i);
    expect(text, path).toMatch(/--retry-of/);
    expect(text, path).toMatch(/same class[^.]*provider[^.]*effort/i);
    expect(text, path).toMatch(/Claude rejection[^.]*hold/i);
    expect(text, path).toMatch(/timeout[^.]*quota[^.]*auth[^.]*hold/i);
  }
  for (const path of ['docs/installation.md', 'docs/workflows.md']) {
    expect(compact(path), path).toMatch(/timeout[^.]*quota[^.]*auth[^.]*hold/i);
  }
  const contracts = compact('skills/axstack/references/contracts.md');
  expect(contracts).toContain('pause affected work, record the gap, and ask the user');
  expect(contracts).toContain("Every substitution requires the user's decision: configured alternatives and native fallback prose are not defaults.");
  expect(contracts).toMatch(/except[^.]*within-class|within-class[^.]*exception/i);
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/timeout[^.]*quota[^.]*hold/i);
  expect(routing).toMatch(/tried ID[^.]*error[^.]*fallback ID/i);
});
