import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const compact = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const watchPath = 'skills/axstack-watch/SKILL.md';
const contracts = 'skills/axstack/references/contracts.md';
const documented = [watchPath, 'README.md', 'docs/workflows.md'];
const surfaces = [contracts, 'skills/axstack/references/autopilot.md',
  'skills/axstack/references/lifecycle.md', 'skills/axstack/references/routing.md',
  'skills/axstack/references/role-roster.md', 'skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/automations.md', 'skills/axstack/references/test-audit-weekly.md',
  watchPath, 'skills/axstack-watch/references/watch-runtime.md',
  'skills/axstack-implement/SKILL.md', 'skills/axstack-review/SKILL.md',
  'skills/axstack-audit/SKILL.md', 'AGENTS.md', 'docs/workflows.md', 'README.md'];

// Protect the shipped instruction boundary. Mutations stay in memory.
for (const path of ['README.md', 'docs/workflows.md']) {
  test(`solo card reply authorizes guarded integration merge: ${path}`, () => {
    const concepts = [/solo/i, /user.s merge-card reply/i, /authorizes/i, /guarded merge/i,
      /user-written PRs/i, /unknown or mixed provenance/i];
    checkRule(compact(read(path)), (text) => requires(text, ...concepts),
      "In solo mode the user's merge-card reply authorizes the guarded merge of user-written PRs or PRs with unknown or mixed provenance.",
      [[/authorizes/i, 'forbids']], concepts);
  });
}
for (const path of documented) {
  test(`merge causes are self-contained: ${path}`, () => {
    const text = read(path);
    expect(text).not.toMatch(/\b(?:A[1-7]|C4)\b/);
    expect(`${text}\nA reply clears A3.`).toMatch(/\b(?:A[1-7]|C4)\b/);
  });
  test(`merge instructions contain no dated run identity: ${path}`, () => {
    expect(read(path)).not.toMatch(/\b\d{8}-video-takeaways\b/);
  });
}

test('readiness never persists across repair while approval carryover remains bound', () => {
  const text = compact(read(watchPath));
  expect(text).not.toMatch(/merge-ready statement persists through repairs/i);
  expect(text).toMatch(/approval carries over only[^.]*unchanged[^.]*both heads[^.]*forge still counts/i);
  expect(text).toMatch(/fresh authored review, diligence, and CI on every new head/i);
});

const standing = [
  ['review votes grant no authority', [/review approval/i, /reviewer votes/i, /mutation/i, /merge authority/i],
    'Review approval and reviewer votes alone never grant mutation or merge authority.',
    [/never grant/i, 'grant'], /never grant/i],
  ['every tracker mutation belongs to driver', [/driver/i, /owns/i, /every/i, /selected external-tracker mutation/i],
    'The driver owns every selected external-tracker mutation.', [/every/i, 'some']],
  ['routine autonomous choices stay bounded', [/routine/i, /shape/i, /split/i, /fanout/i, /exception/i, /approved scope/i, /autonomous driver decisions/i],
    'Routine shape, split, fanout, and exception choices within approved scope are autonomous driver decisions.',
    [/routine/i, 'all']],
];
for (const [name, concepts, rewording, inversion, prohibition] of standing) {
  test(`standing authority: ${name}`, () => {
    const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(compact(read(contracts)), accepts, rewording, [inversion], concepts);
  });
}
for (const path of [contracts, 'AGENTS.md', ...documented, 'skills/axstack-implement/SKILL.md',
  'skills/axstack/references/autopilot.md', 'skills/axstack-review/SKILL.md',
  'skills/axstack/references/automations.md']) {
  test(`user merges stacks bottom-up: ${path}`, () => {
    const concepts = [/user merges/i, /bottom-up/i, /stack/i];
    checkRule(compact(read(path)), (text) => requires(text, ...concepts),
      'User merges are bottom-up for a stack.', [[/bottom-up/i, 'top-down']], concepts);
  });
}

const noHumanDefault = (text) => !sentences(text).some((unit) =>
  /\bhuman(?:s)? merge(?:s)? (?:PRs )?(?:by )?default|\bhuman merge (?:is|remains|stays) (?:the )?default|\bdefault (?:to|is) human merge/i.test(unit));
for (const path of surfaces) {
  test(`authority surface rejects an unconditional human-merge default: ${path}`, () => {
    const text = compact(read(path));
    expect(noHumanDefault(text)).toBe(true);
    for (const contradictory of ['The human merges by default.', 'Human merge is default.', 'Default to human merge.']) {
      expect(noHumanDefault(`${text}\n${contradictory}`)).toBe(false);
    }
    expect(noHumanDefault(`${text}\nThe human merges the release PR.`)).toBe(true);
  });
}

test('dated run identity stays out of shipped files and workflow tests', () => {
  const paths = [...surfaces,
    ...readdirSync(`${import.meta.dir}/../../skills`, { recursive: true })
      .filter((path) => path.endsWith('.md')).map((path) => `skills/${path}`),
    ...readdirSync(import.meta.dir, { recursive: true })
      .filter((path) => /\.(?:js|json)$/.test(path)).map((path) => `tests/workflows/${path}`)];
  for (const path of new Set(paths)) {
    expect(read(path), path).not.toMatch(/\b\d{8}-video-takeaways\b/);
  }
});
