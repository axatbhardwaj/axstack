import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

test('run snapshot records class resolution and reuses it on resume', () => {
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/for each role[^.]*class[^.]*exact ID[^.]*source[^.]*time/i);
  expect(routing).toMatch(/resume[^.]*reuse[^.]*snapshot[^.]*no re-resolution/i);
  expect(routing).toMatch(/provider\/model class/i);
});

test('T3 rejection preserves the routing snapshot without an automatic retry', () => {
  const routing = compact('skills/axstack/references/routing.md');
  const runtime = compact('skills/axstack/references/t3-runtime.md');
  expect(runtime).toContain('Auth, quota, timeout and rejection do not select an alternative.');
  expect(routing).toContain('changes require the user’s explicit decision');
  for (const text of [routing, runtime]) expect(text).not.toMatch(/--retry-of|--exclude/);
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
    concepts: [/Claude/i, /exact|resolved|precise/i, /\b(?:ID|identifier)s?\b/i,
      /capabilities.*(?<!-)\b(?:replac|retir|supersed)\w*\b(?!\s+by\b).*transcript|transcript.*(?<!-)\b(?:replaced|retired|superseded)\b.*\bby\b.*capabilities/i],
    rewording: 'Capabilities supply each Claude exact ID and retire transcript read-back.',
  },
  {
    name: 'trust preflight exemption', path: 'automations.md',
    concepts: [/^\s*T3 sessions?\b/i, /Claude/i, /trust/i, /preflight/i, /(?<!-)\b(?:exempt|unnecessary|dispens\w*)\b/i],
    rewording: 'T3 sessions can dispense with Claude trust preflight.',
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

const holdouts = {
  'trust preflight exemption': 'T3 sessions treat Claude trust preflight as unnecessary.',
  'transcript retirement': 'Transcript read-back is replaced by capabilities as the source of Claude exact IDs.',
};

for (const { name, path, concepts } of modelRules.filter(({ name }) => name in holdouts)) {
  const rule = sentences(read(`skills/axstack/references/${path}`))
    .find((sentence) => requires(sentence, ...concepts));
  test(`T3 model rule: ${name} rejects antonym prefixes`, () => {
    for (const prefix of ['non', 'un', 'non-', 'un-']) {
      const inverted = rule.replace(/\b(exempt|unnecessary|dispens\w*|replac\w*|retir\w*|supersed\w*)\b/gi, `${prefix}$1`);
      expect(requires(inverted, ...concepts), inverted).toBe(false);
    }
  });
  test(`T3 model rule: ${name} rejects actor swaps and accepts a second holdout`, () => {
    // Swap the actors using the same operation for both semantic classes.
    const actors = name === 'trust preflight exemption' ? ['T3', 'Claude'] : ['capabilities', 'transcript read-back'];
    for (const sentence of [rule, holdouts[name]]) {
      const inverted = sentence.replace(new RegExp(actors[0], 'i'), '__actor__')
        .replace(new RegExp(actors[1], 'i'), actors[0]).replace('__actor__', actors[1]);
      expect(requires(inverted, ...concepts), inverted).toBe(false);
    }
    expect(requires(holdouts[name], ...concepts)).toBe(true);
  });
}

test('T3 model rejection holds without automatic within-class substitution', () => {
  for (const path of [
    'skills/axstack/references/contracts.md',
    'skills/axstack/references/routing.md',
    'skills/axstack/references/t3-runtime.md',
    'skills/axstack-review/SKILL.md',
  ]) {
    const text = compact(path);
    if (path.endsWith('/t3-runtime.md')) {
      expect(text).toContain('An unavailable provider, model, role, mode or effort must hold that role with no substitution.');
      expect(text).toContain('Auth, quota, timeout and rejection do not select an alternative.');
    } else expect(text, path).toMatch(/rejection[^.]*hold/i);
    expect(text, path).not.toMatch(/--retry-of/);
  }
  for (const path of ['docs/installation.md', 'docs/workflows.md']) {
    expect(compact(path), path).toMatch(/timeout[^.]*quota[^.]*auth[^.]*hold/i);
  }
  const contracts = compact('skills/axstack/references/contracts.md');
  expect(contracts).toContain('pause affected work, record the gap, and ask the user');
  expect(contracts).toContain("Every substitution requires the user's decision: configured alternatives are not defaults.");
  expect(contracts).not.toMatch(/within-class|--retry-of/);
  const routing = compact('skills/axstack/references/routing.md');
  expect(routing).toMatch(/timeout[^.]*quota[^.]*hold/i);
  expect(routing).toContain('no substitution');
});
