import { expect, test } from 'bun:test';
import { publicDocPaths } from './public-docs.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const readJson = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
const presetDir = `${root}/profiles/presets`;
const presetNames = ['mixed', 'codex-only', 'claude-only'];
test('presets: X research uses the Grok route only in mixed', () => {
  const research = readFileSync(`${root}/skills/axstack-research/SKILL.md`, 'utf8');
  expect(research).toContain(
    '`axstack-research-x`: X (Twitter) posts and threads via Grok; cite post URLs and dates.',
  );

  const mixed = readJson('profiles/presets/mixed.json').roles
    .find(({ id }) => id === 'axstack-research-x');
  expect(mixed?.provider).toBe('grok');
  expect(mixed?.model).toBeNull();
  for (const preset of ['codex-only', 'claude-only']) {
    const unavailable = readJson(`profiles/presets/${preset}.json`).roles
      .find(({ id }) => id === 'axstack-research-x');
    expect(unavailable?.model).toBeNull();
    expect(unavailable?.notes).toMatch(/intentional single-provider absence/i);
  }
});

test('presets: research sizes dispatch to claims and keeps independent source pairs', () => {
  const research = readFileSync(`${root}/skills/axstack-research/SKILL.md`, 'utf8');
  const fanout = research.split(/2\. \*\*[^\n]+\*\*/)[1]?.split(/3\. \*\*/)[0];
  expect(fanout).toBeDefined();
  const text = sentences(fanout).join('. ');
  const rules = [
    {
      concepts: [/single factual lookup/i, /(?:stays?|remains?) in (?:the current )?chat/i],
      rewording: 'A single factual lookup remains in the current chat.',
      inversions: [[/stays?|remains?/i, 'dispatches']],
    },
    {
      concepts: [/dispatch/i, /delegate_task/, /only/i, /branches/i, /source class/i,
        /execution/i, /needed|needs?|requires?/i, /open/i, /answer-changing claim/i],
      rewording: 'Dispatch via T3 delegate_task only the branches whose source class (including execution) an open answer-changing claim requires.',
      inversions: [[/only/i, 'all'], [/open/i, 'settled']],
    },
    {
      concepts: [/each needed source class/i, /retain|keep|requires?/i, /two/i,
        /isolated|independent/i, /where configured|when configured/i],
      rewording: 'Each needed source class requires two independent branches when configured.',
      inversions: [[/two/i, 'one'], [/isolated|independent/i, 'shared']],
    },
    {
      concepts: [/mixed/i, /each needed source class/i, /retains|requires?/i,
        /branches/i, /different providers/i],
      rewording: 'In mixed, each needed source class requires branches from different providers.',
      inversions: [[/mixed/i, 'codex-only'], [/different providers/i, 'the same provider']],
    },
    {
      concepts: [/dispatch execution/i, /when/i, /claim/i, /depends? on|requires?/i, /runtime behavior/i],
      rewording: 'Dispatch execution when a claim requires runtime behavior evidence.',
      inversions: [[/when/i, 'unless']],
    },
    {
      concepts: [/requirements/i, /only when|only if/i, /scope/i, /unclear|ambiguous/i],
      rewording: 'Dispatch requirements only if scope is ambiguous.',
      inversions: [[/only when|only if/i, 'even if'], [/unclear|ambiguous/i, 'clear']],
    },
    {
      concepts: [/\bX\b/, /only when|only if/i, /claim/i, /depends? on|requires?/i, /posts/i],
      rewording: 'Dispatch X only if a claim requires X posts.',
      inversions: [[/only when|only if/i, 'even if']],
    },
    {
      concepts: [/record/i, /each|every/i, /skipped branch/i, /not needed \(<reason>\)/i],
      rewording: 'Record every skipped branch as `not needed (<reason>)`.',
      inversions: [[/record/i, 'Do not record']],
    },
  ];
  for (const { concepts, rewording, inversions } of rules) {
    // Mask the required absence label so its "not" is not read as a negated directive.
    const accepts = (text) => sentences(text).some((sentence) =>
      concepts.every((concept) => concept.test(sentence))
      && requires(sentence.replace(/not needed \(<reason>\)/gi, 'absence label'), /^/));
    checkRule(text, accepts, rewording, inversions, concepts);
  }
  for (const pair of [
    [/code/i, /code-sol/i], [/web/i, /web-google/i],
    [/`axstack-explore-execution`/, /`axstack-explore-execution-sol`/],
  ]) expect(requires(fanout, ...pair, /pair/i)).toBe(true);
});

test('presets: research keeps Google routing, citations and failure fencing', () => {
  const research = readFileSync(`${root}/skills/axstack-research/SKILL.md`, 'utf8');
  expect(research).toContain('`axstack-research-web-google`');
  expect(research).toMatch(/URL (?:\+|and) access date per claim/i);
  expect(research).toMatch(/re-open sources and never trust a search\s+summary/i);
  expect(research).toMatch(/reconciles agreements\/disagreements per claim/i);
  expect(research).toMatch(/unconfigured branch[^.]*intentionally absent/i);
  expect(research).toMatch(/configured\s+optional branch that malfunctions[^.]*is fenced, recorded `absent \(<reason>\)`/i);
  expect(research).toMatch(/without relay or substitution/i);

  const mixed = readJson('profiles/presets/mixed.json').roles;
  expect(mixed.find(({ id }) => id === 'axstack-checker')).toMatchObject({
    provider: 'claude', modelClass: 'sonnet', thinkingOptionId: 'low',
  });
});
