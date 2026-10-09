import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = () => readFileSync(`${import.meta.dir}/../../AGENTS.md`, 'utf8');
const bullets = (text) => (text.split('## Operating rules')[1] ?? '').split('\n## ')[0]
  .split(/\n(?=- )/).map(block => block.replace(/`/g, '').replace(/\s+/g, ' ').trim());

// Independent permission contract, not proof of live agent/API compliance.
const guards = [
  ['repository scope', /(?:in|for) this repository/i, 'in any repository'],
  ['driver permission', /an? agent driver (?:may|can) merge/i, 'any worker must merge'],
  ['all guards mandatory', /only (?:when|if) (?:all hold|every condition holds)/i, 'when any condition holds'],
  ['bot author', /(?:author is|authored by) dependabot\[bot\]/i, 'author is any account'],
  ['Actions branch', /(?:head )?branch (?:is|matches) dependabot\/github_actions\/\*/i, 'branch matches any Dependabot ecosystem'],
  ['workflow-only changes', /(?:only \.github\/workflows\/ files change|all changed files are under \.github\/workflows\/)/i, 'workflow and source files may change'],
  ['both rename paths', /(?:old and new|source and destination) rename paths/i, 'new rename paths only'],
  ['all changed uses pins', /(?:every changed|each modified) uses: SHA pin/i, 'one uses: SHA pin'],
  ['pin resolves to claimed release', /(?:resolves|maps) to the release tag (?:the PR claims|claimed by the PR)/i, 'maps to an arbitrary commit'],
  ['GitHub API verification', /(?:verified via|checked through) the GitHub API/i, 'assumed from the PR description'],
  ['every tag is a release tag', /(?:every|each) tag ref is a release tag/i, 'any tag ref is acceptable'],
  ['CI green at head', /required CI (?:is green at the head|passes for that head)/i, 'CI may fail or pass on an old head'],
  ['guarded merge command', /gh pr merge <(?:n|number)> --merge --match-head-commit <sha>/, 'gh pr merge <n> --merge'],
  ['user fallback', /otherwise (?:leave the PR for the user|the user handles the PR)/i, 'otherwise merge the PR anyway'],
];
const accepts = (text) => bullets(text).some(rule =>
  guards.every(([, guard]) => guard.test(rule))
  && !/\b(?:not|never|without|skip\w*|ignore\w*|unless|except|optional|regardless)\b/i.test(rule));
const target = (text) => bullets(text).find(rule => /dependabot\/github_actions\//.test(rule));

test('repository allows the driver to merge Dependabot Actions PRs only under every guard', () => {
  expect(accepts(source())).toBe(true);
});

const rewording = `- For this repository, an agent driver can merge a Dependabot GitHub Actions PR only if every condition holds:
  authored by dependabot[bot], head branch matches dependabot/github_actions/*, all changed files are under .github/workflows/ including source and destination rename paths;
  each modified uses: SHA pin maps to the release tag claimed by the PR, checked through the GitHub API, and each tag ref is a release tag;
  required CI passes for that head, then use gh pr merge <number> --merge --match-head-commit <sha>.
  Otherwise the user handles the PR.`;

test('the real instruction contract survives equivalent rewording and reflow', () => {
  const original = target(source());
  expect(original).toBeDefined();
  expect(accepts(`## Operating rules\n${rewording}\n## Engineering`)).toBe(true);
  expect(accepts(`## Operating rules\n${original.replaceAll(';', ',').replaceAll(' ', '\n  ')}\n## Engineering`)).toBe(true);
});

test('removing the real instruction loses merge authority', () => {
  const original = target(source());
  expect(original).toBeDefined();
  const section = bullets(source()).filter(rule => rule !== original).join('\n');
  expect(accepts(`## Operating rules\n${section}\n## Engineering`)).toBe(false);
});

for (const [name, guard, inversion] of guards) {
  test(`removing or inverting ${name} cannot retain merge authority`, () => {
    const original = target(source());
    expect(original).toBeDefined();
    for (const rule of [original, rewording.replace(/\s+/g, ' ')]) {
      expect(guard.test(rule), name).toBe(true);
      expect(accepts(`## Operating rules\n${rule.replace(guard, '')}`), `removed ${name}`).toBe(false);
      expect(accepts(`## Operating rules\n${rule.replace(guard, inversion)}`), `inverted ${name}`).toBe(false);
    }
  });
}

test('CI wording cannot be retained as a negated or optional guard', () => {
  const original = target(source());
  expect(original).toBeDefined();
  for (const weakened of ['required CI is not green at the head', 'required CI is green at the head but optional',
    'merge without required CI being green at the head', 'required CI is green at the head unless the driver overrides it']) {
    expect(accepts(`## Operating rules\n${original.replace(guards[11][1], weakened)}`)).toBe(false);
  }
});
