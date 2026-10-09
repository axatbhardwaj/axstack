import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = () => readFileSync(`${import.meta.dir}/../../AGENTS.md`, 'utf8');
const bullets = (text) => (text.split('## Operating rules')[1] ?? '').split('\n## ')[0]
  .split(/\n(?=- )/).map(block => block.replace(/`/g, '').replace(/\s+/g, ' ').trim());

// Independent permission contract, not proof of live agent/API compliance.
const driver = /an? agent driver (?:may|can) merge/i;
const workflow = /(?:the ci workflow has run at the head|ci has executed on that head)/i;
const checkCount = /(?:at least one check|one or more checks)/i;
const ci = /(?:every (?:CI )?check at the head has completed|all (?:CI )?checks on that head have finished) successfully \((?:at least one check|one or more checks)[;,] (?:none pending, failed or cancelled|no pending, failed or cancelled checks)\)/i;
const claim = /for (?:each changed|every modified) action, (?:the claim is the version named|take the version stated) in the PR title, body or commit message/i;
const release = /a release tag (?:is|means) a published GitHub Release tag,? or its vN\/vN\.N major\/minor alias (?:resolving to the same|pointing to that same) commit/i;
const uncertain = /if either claim or tag cannot be (?:determined|established) or verified, (?:leave the PR for the user|the user handles the PR)/i;
const watch = /this is not a watch merge: watch §5 and (?:the )?peer rules (?:do not apply|are inapplicable)[;,] (?:these guards are the whole merge authority|only these guards grant merge authority)/i;
const guards = [
  ['repository scope', /(?:in|for) this repository/i, 'in any repository'],
  ['driver permission', driver, 'any worker must merge'],
  ['all guards mandatory', /only (?:when|if) (?:all hold|every condition holds)/i, 'when any condition holds'],
  ['bot author', /(?:author is|authored by) dependabot\[bot\]/i, 'author is any account'],
  ['Actions branch', /(?:head )?branch (?:is|matches) dependabot\/github_actions\/\*/i, 'branch matches any Dependabot ecosystem'],
  ['workflow-only changes', /(?:only \.github\/workflows\/ files change|all changed files are under \.github\/workflows\/)/i, 'workflow and source files may change'],
  ['both rename paths', /(?:old and new|source and destination) rename paths/i, 'new rename paths only'],
  ['all changed uses pins', /(?:every changed|each modified) uses: SHA pin/i, 'one uses: SHA pin'],
  ['pin resolves to claimed release', /(?:resolves|maps) to the release tag (?:the PR claims|claimed by the PR)/i, 'maps to an arbitrary commit'],
  ['GitHub API verification', /(?:verified via|checked through) the GitHub API/i, 'assumed from the PR description'],
  ['every tag is a release tag', /(?:every|each) tag ref is a release tag/i, 'any tag ref is acceptable'],
  ['per-action claim source', claim, 'accept any suggested version'],
  ['published release definition', /a release tag (?:is|means) a published GitHub Release tag/i, 'a release tag is any Git tag'],
  ['major/minor release alias', /or its vN\/vN\.N major\/minor alias/i, 'or any branch alias'],
  ['alias commit equality', /(?:resolving to the same|pointing to that same) commit/i, 'pointing to any commit'],
  ['ci workflow ran at head', workflow, 'ci has not run on this head'],
  ['nonempty head check set', checkCount, 'zero checks are enough'],
  ['every CI check successful at head', ci, 'required CI is green at the head'],
  ['guarded merge command', /gh pr merge <(?:n|number)> --merge --match-head-commit <sha>/, 'gh pr merge <n> --merge'],
  ['user fallback', /otherwise (?:leave the PR for the user|the user handles the PR)/i, 'otherwise merge the PR anyway'],
  ['undetermined or unverified claims and tags', uncertain, 'if verification is unclear, merge anyway'],
  ['watch and peer rules excluded', /this is not a watch merge: watch §5 and (?:the )?peer rules (?:do not apply|are inapplicable)/i, 'watch §5 and the peer rules also apply'],
  ['whole merge authority', /(?:these guards are the whole merge authority|only these guards grant merge authority)/i, 'other rules can also grant merge authority'],
];
const grantsMerge = (rule) => /\b(?:may|can|must|shall|should) (?:also )?(?:be )?merge(?:d)?\b|\b(?:free|fine) to merge\b|\b(?:permit\w*|allow\w*|authoriz\w*)\b[^.;]*\bmerge\b|^- merge\b/i.test(rule);
const accepts = (text) => {
  const candidates = bullets(text).filter(rule => guards.every(([, guard]) => guard.test(rule))
    // Mask only the bounded, legitimate alternatives and watch exclusion.
    && !/\b(?:or|waiv\w*|not|never|without|skip\w*|ignore\w*|unless|except|optional|regardless)\b|also merge/i
      .test([ci, claim, release, uncertain, watch].reduce((rest, clause) => rest.replace(clause, ''), rule))
    && !grantsMerge(rule.replace(driver, '')));
  if (candidates.length !== 1) return false;
  return !text.replace(/^#{1,6} .*$/gm, '').split(/\n(?=-\s)/).some(block => {
    const rule = block.replace(/`/g, '').replace(/\s+/g, ' ').trim();
    return rule !== candidates[0] && /dependabot/i.test(rule) && grantsMerge(rule);
  });
};
const target = (text) => bullets(text).find(rule => /dependabot\/github_actions\//.test(rule));

test('repository allows the driver to merge Dependabot Actions PRs only under every guard', () => {
  expect(accepts(source())).toBe(true);
});

const rewording = `- For this repository, an agent driver can merge a Dependabot GitHub Actions PR only if every condition holds:
  authored by dependabot[bot], head branch matches dependabot/github_actions/*, all changed files are under .github/workflows/ including source and destination rename paths;
  each modified uses: SHA pin maps to the release tag claimed by the PR, checked through the GitHub API, and each tag ref is a release tag; for every modified action, take the version stated in the PR title, body or commit message.
  A release tag means a published GitHub Release tag or its vN/vN.N major/minor alias pointing to that same commit.
  ci has executed on that head and all checks on that head have finished successfully (one or more checks; no pending, failed or cancelled checks), then use gh pr merge <number> --merge --match-head-commit <sha>.
  Otherwise the user handles the PR; if either claim or tag cannot be established or verified, the user handles the PR.
  This is not a watch merge: watch §5 and peer rules are inapplicable; only these guards grant merge authority.`;

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

test('CI wording cannot be vacuous, negated or optional', () => {
  const original = target(source());
  expect(original).toBeDefined();
  const currentCI = original.match(ci)?.[0];
  expect(currentCI).toBeDefined();
  for (const weakened of ['required CI is green at the head', 'required CI passes for that head',
    'Every CI check at the head has completed successfully (none pending, failed or cancelled)',
    currentCI.replace('completed successfully', 'not completed successfully'),
    `${currentCI} but optional`, `${currentCI} unless the driver overrides it`]) {
    expect(accepts(`## Operating rules\n${original.replace(ci, weakened)}`)).toBe(false);
  }
});

test('an escape clause cannot broaden the real merge authority', () => {
  expect(accepts(source())).toBe(true);
  const original = target(source());
  for (const [from, to] of [
    ['completed successfully', 'completed successfully or red'],
    ['the PR claims', 'the PR claims or any commit'],
    ['only when all hold:', 'only when all hold (the driver may waive any):'],
    ['Otherwise', 'Agents may also merge any Dependabot PR. Otherwise'],
    ['Otherwise leave the PR for the user.', 'Otherwise leave the PR for the user. Or merge without verification.'],
    ['body or commit message', 'body or commit message or any suggestion'],
    ['same commit', 'same commit or any commit'],
    ['verified, leave the PR for the user', 'verified, leave the PR for the user or merge anyway'],
    ['Otherwise', 'Agents can merge any Dependabot PR. Otherwise'],
  ]) {
    expect(original.includes(from)).toBe(true);
    expect(accepts(`## Operating rules\n${original.replace(from, to)}`), to).toBe(false);
  }
});

test('no other AGENTS bullet may grant Dependabot merges', () => {
  const doc = source();
  expect(accepts(doc)).toBe(true);
  for (const extra of ['- Agents may also merge any Dependabot PR.', '- Merge all Dependabot PRs.',
    '- Dependabot PRs may be merged by any agent.', '- Permit agents to merge any Dependabot PR.']) {
    expect(accepts(`${doc}\n${extra}`), extra).toBe(false);
    expect(accepts(doc.replace('## Engineering', `${extra}\n\n## Engineering`)), extra).toBe(false);
  }
  expect(accepts(`${doc}\n- Never merge Dependabot PRs without verification.`)).toBe(true);
});

for (const [placement, grant] of [
  ['inside', 'Drivers should merge any other Dependabot PR too.'],
  ['inside', 'It is fine to merge any Dependabot PR.'],
  ['separate', 'Agent drivers should merge Dependabot PRs once CI is green.'],
  ['separate', 'Drivers are free to merge Dependabot PRs.'],
  ['inside', 'Drivers are free to merge Dependabot PRs.'],
  ['separate', 'It is fine to merge any Dependabot PR.'],
]) {
  test(`${placement} authority cannot be broadened with: ${grant}`, () => {
    const doc = source();
    expect(accepts(doc)).toBe(true);
    if (placement === 'inside') {
      const original = target(doc);
      expect(accepts(`## Operating rules\n${original.replace('Otherwise', `${grant} Otherwise`)}`)).toBe(false);
    } else {
      expect(accepts(`${doc}\n- ${grant}`)).toBe(false);
      expect(accepts(doc.replace('## Engineering', `- ${grant}\n\n## Engineering`))).toBe(false);
    }
  });
}
