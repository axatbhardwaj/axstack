import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const compact = (text) => text.replace(/`/g, '').replace(/\s+/g, ' ');
const concepts = () => compact(read('docs/concepts.md'));
const picker = read('skills/axstack/scripts/pick-instance.js');
const runtime = compact(read('skills/axstack/references/t3-runtime.md'));

test('concepts matches the picker tier weights and exclusion threshold', () => {
  const weights = [...picker.matchAll(/(default_claude_max_20x|default_claude_max_5x|pro|prolite): (\d+)/g)];
  expect(weights).toHaveLength(4);
  for (const [, tier, weight] of weights) {
    const pattern = new RegExp(`\\b${tier}\\s*\\|\\s*${weight}\\b`);
    const doc = concepts();
    expect(doc, tier).toMatch(pattern);
    expect(doc.replace(pattern, ''), tier).not.toMatch(pattern);
    expect(doc.replace(pattern, `${tier} | ${Number(weight) + 1}`), tier).not.toMatch(pattern);
    expect(doc.replace(pattern, `${tier}  |  ${weight}`), tier).toMatch(pattern);
  }
  const cutoff = picker.match(/value.utilization >= (\d+)/)?.[1];
  expect(cutoff).toBeDefined();
  const rules = [
    [[/known/i, /score/i, /\(100 (?:−|-) max known window utilization\) (?:×|\*|multiplied by) tier weight/i, /tier weight/i, /equals/i],
      'For known usage, the score equals (100 - max known window utilization) multiplied by tier weight.', /equals/i, 'differs from'],
    [[/unknown/i, /utilization/i, /score/i, /equals/i, /weight alone/i],
      'For unknown utilization, the score equals the tier weight alone.', /equals/i, 'differs from'],
    [[/unknown tier/i, /weight/i, /equals 1/i],
      'For an unknown tier, the weight equals 1.', /equals 1/i, 'equals 4'],
    [[new RegExp(`≥${cutoff}%`), /limit reached/i, /excluded/i],
      `An account with any window at ≥${cutoff}% or a reported limit reached is excluded.`, /excluded/i, 'eligible'],
    [[/missing credentials/i, /skipped/i],
      'Accounts with missing credentials are skipped.', /skipped/i, 'selected'],
  ];
  for (const [terms, rewording, direction, inverse] of rules) {
    checkRule(concepts(), (text) => requires(text, ...terms), rewording, [[direction, inverse]], terms);
  }
});

for (const [name, terms, rewording, direction, inverse] of [
  ['dispatch fallback', [/dispatched roles/i, /only error exit 1/i, /permits fallback/i, /canonical instance/i, /validating availability/i],
    'For dispatched roles, only error exit 1 permits fallback to the canonical instance after validating availability.', /permits fallback/i, 'forbids fallback'],
  ['exit 2 hold', [/exit 2/i, /hold/i, /without fallback/i],
    'Exit 2 must hold the work without fallback.', /must hold/i, 'can continue'],
  ['eligible driver stays', [/driver/i, /current instance/i, /eligible/i, /must stay/i, /headroom differences/i],
    "If the driver's own current instance is eligible, it must stay despite headroom differences.", /must stay/i, 'must switch'],
  ['error keeps driver', [/error exit 1/i, /driver/i, /must keep/i, /current instance/i],
    'On error exit 1, the driver must keep its current instance.', /must keep/i, 'must replace'],
]) {
  test(`account selection matches runtime: ${name}`, () => {
    const accepts = (text) => requires(text.replace(/no eligible/g, 'zero eligible'), ...terms);
    // Mask only the runtime's expected "no eligible" status, preserving other denials.
    checkRule(runtime, accepts, rewording, [[direction, inverse]], terms);
    checkRule(concepts(), accepts, rewording, [[direction, inverse]], terms);
  });
}

test('picker environment is documented and linked from installation', () => {
  for (const [variable, terms, rewording] of [
    ['XDG_CACHE_HOME', [/XDG_CACHE_HOME/, /selects/i, /cache/i],
      'XDG_CACHE_HOME selects the cache directory.'],
    ['AXSTACK_CLAUDE_USAGE_URL', [/AXSTACK_CLAUDE_USAGE_URL/, /is/i, /test-only/i, /endpoint override/i],
      'AXSTACK_CLAUDE_USAGE_URL is a test-only endpoint override.'],
    ['AXSTACK_CODEX_USAGE_URL', [/AXSTACK_CODEX_USAGE_URL/, /is/i, /test-only/i, /endpoint override/i],
      'AXSTACK_CODEX_USAGE_URL is a test-only endpoint override.'],
  ]) {
    expect(read('skills/axstack/scripts/account-usage.js'), variable).toContain(variable);
    checkRule(concepts(), (text) => requires(text, ...terms), rewording,
      [[/selects|\bis\b/i, 'does not select']], terms);
  }
  expect(read('docs/installation.md')).toContain('](concepts.md#account-selection-environment)');
});

test('getting started explains check rows and its live evidence limits', () => {
  const doc = read('docs/getting-started.md');
  for (const row of ['bun', 'git', 'gh', 't3']) expect(doc).toContain(`| \`${row}\` |`);
  const terms = [/check/i, /live provider readiness/i, /schedule activation/i, /mobile delivery/i];
  checkRule(compact(doc), (text) => prohibits(text, /does not prove/i, ...terms),
    'Check does not prove live provider readiness, schedule activation or mobile delivery.',
    [[/does not prove/i, 'proves']], terms);
  expect(doc).toContain('$axstack-implement');
  expect(doc).toContain('/axstack-implement');
  expect(doc).toContain('](guides.md#small-fix)');
});

test('concepts and guides cover the requested learning journeys', () => {
  for (const concept of ['Driver thread', 'Phases', 'Small and substantial work', 'Roles and presets', 'Holds', 'Run record', 'T3 runtime boundary', 'Account selection']) {
    expect(read('docs/concepts.md'), concept).toContain(`## ${concept}`);
  }
  for (const journey of ['Scope and build a feature', 'Small fix', 'Review a PR', 'Watch own PRs', 'Debug', 'Release']) {
    expect(read('docs/guides.md'), journey).toContain(`## ${journey}`);
  }
});
