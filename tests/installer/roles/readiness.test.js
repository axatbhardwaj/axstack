import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from '../../../src/posixpath.js';
import { assessInstalledRoleSnapshot, assessRoleReadiness, installedRoleBytes } from '../../../src/roles.js';

const role = (id, model = 'model') => ({
  id,
  name: id,
  provider: 'codex',
  model,
});

const root = import.meta.dir.slice(0, -'/tests/installer/roles'.length);

test('installed readiness compares role IDs with the selected bundle', () => {
  const expectedRoles = [
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    role('axstack-reviewer-secondary', 'claude-opus-5-5'),
    { ...role('axstack-checker', null), provider: 'claude', modelClass: 'sonnet' },
  ];
  const installed = installedRoleBytes('mixed', [
    { ...role('axstack-checker', null), provider: 'claude', modelClass: 'sonnet' },
  ]);

  const result = assessInstalledRoleSnapshot(installed, 'mixed', expectedRoles);

  expect(result.ready).toBe(false);
  expect(result.gaps).toEqual([
    'missing selected bundle role: axstack-author',
    'missing selected bundle role: axstack-reviewer-primary',
    'missing selected bundle role: axstack-reviewer-secondary',
  ]);
});

test('single-provider readiness accepts only the intentionally unavailable adviser', () => {
  const roles = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', null), thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-6.1-terra'), thinkingOptionId: 'high' },
  ];

  expect(assessRoleReadiness(roles, 'codex-only')).toEqual({ ready: true, gaps: [] });
  roles.find(({ id }) => id === 'axstack-author').model = null;
  expect(assessRoleReadiness(roles, 'codex-only').gaps).toContain(
    'axstack-author requires a configured model',
  );
});

test('authored pairing accepts all four class routes and newer exact author IDs', () => {
  for (const [preset, author, primary, secondary] of [
    ['mixed', ['codex', 'sol', 'gpt-5.6-sol'], ['codex', 'sol', 'high'], ['claude', 'opus', 'high']],
    ['mixed', ['claude', 'opus', 'claude-opus-5-6'], ['codex', 'sol', 'high'], ['claude', 'opus', 'high']],
    ['codex-only', ['codex', 'sol', 'gpt-6.1-sol'], ['codex', 'sol', 'high'], ['codex', 'terra', 'high']],
    ['claude-only', ['claude', 'opus', 'claude-opus-5-6'], ['claude', 'opus', 'medium'], ['claude', 'sonnet', 'high']],
  ]) {
    const rows = [
      { ...role('axstack-author', author[2]), provider: author[0] },
      { id: 'axstack-reviewer-primary', name: 'Primary', provider: primary[0], modelClass: primary[1], thinkingOptionId: primary[2] },
      { id: 'axstack-reviewer-secondary', name: 'Secondary', provider: secondary[0], modelClass: secondary[1], thinkingOptionId: secondary[2] },
    ];
    expect(assessRoleReadiness(rows, preset), `${preset}: ${author[2]}`).toEqual({ ready: true, gaps: [] });
    rows[0] = { ...rows[0], modelClass: author[1] };
    expect(assessRoleReadiness(rows, preset).ready).toBe(true);
    rows[0] = { id: 'axstack-author', name: 'Author', provider: author[0], modelClass: author[1] };
    expect(assessRoleReadiness(rows, preset)).toEqual({ ready: true, gaps: [] });
  }
});

test('authored pairing rejects unsupported author routes and wrong reviewer class or effort', () => {
  const rows = [
    { ...role('axstack-author', 'gpt-5.6-terra'), thinkingOptionId: 'high' },
    { ...role('axstack-reviewer-primary', null), modelClass: 'sol', thinkingOptionId: 'high' },
    { ...role('axstack-reviewer-secondary', null), provider: 'claude', modelClass: 'opus', thinkingOptionId: 'high' },
  ];
  for (const [model, route] of [['gpt-5.6-terra', 'terra'], ['unknown', 'unknown']]) {
    rows[0].model = model;
    expect(assessRoleReadiness(rows, 'mixed').gaps).toContain(`authored routing gap: unsupported axstack-author route codex/${route}`);
  }
  rows[0].model = 'gpt-5.6-sol';
  rows[2] = { ...rows[2], provider: 'codex', modelClass: 'luna' };
  expect(assessRoleReadiness(rows, 'mixed').gaps.some((gap) => gap.includes('axstack-reviewer-secondary must be claude/opus/high'))).toBe(true);
  rows[2] = { ...rows[2], provider: 'claude', modelClass: 'opus', thinkingOptionId: 'medium' };
  expect(assessRoleReadiness(rows, 'mixed').gaps.some((gap) => gap.includes('axstack-reviewer-secondary must be claude/opus/high'))).toBe(true);
});

test('reviewer distinctness compares resolved IDs or unresolved classes', () => {
  const rows = [
    { ...role('axstack-reviewer-primary', null), modelClass: 'sol' },
    { ...role('axstack-reviewer-secondary', null), modelClass: 'luna' },
  ];
  expect(assessRoleReadiness(rows, 'codex-only')).toEqual({ ready: true, gaps: [] });
  rows[1].modelClass = 'sol';
  expect(assessRoleReadiness(rows, 'codex-only').gaps).toContain('reviewer pair must use two distinct models');

  rows[0] = role('axstack-reviewer-primary', 'gpt-6-sol');
  rows[1] = role('axstack-reviewer-secondary', 'gpt-6.1-sol');
  expect(assessRoleReadiness(rows, 'codex-only')).toEqual({ ready: true, gaps: [] });
  rows[1].model = 'gpt-6-sol';
  expect(assessRoleReadiness(rows, 'codex-only').gaps).toContain('reviewer pair must use two distinct models');

  rows[0].model = null;
  rows[1].model = null;
  expect(assessRoleReadiness(rows, 'codex-only').gaps).not.toContain('reviewer pair must use two distinct models');
});

test('readiness accepts the intentionally unavailable X research route', () => {
  const mixed = [
    role('axstack-research-x', null),
  ];
  mixed[0].provider = 'grok';
  expect(assessRoleReadiness(mixed, 'mixed')).toEqual({ ready: true, gaps: [] });

  for (const preset of ['codex-only', 'claude-only']) {
    const provider = preset === 'codex-only' ? 'codex' : 'claude';
    expect(assessRoleReadiness([
      { ...role('axstack-research-x', null), provider },
    ], preset)).toEqual({ ready: true, gaps: [] });
  }
});

test('mixed X research null model is launchable only through the Grok provider', () => {
  expect(assessRoleReadiness([
    { ...role('axstack-research-x', null), provider: 'claude' },
  ], 'mixed').gaps).toContain(
    'axstack-research-x requires a configured model',
  );
});

test('preset readiness accepts the configured research routes', () => {
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const { roles } = JSON.parse(readFileSync(`${root}/profiles/presets/${preset}.json`, 'utf8'));
    expect(assessRoleReadiness(roles, preset), preset).toEqual({ ready: true, gaps: [] });
  }
});

test('claude-only intentional-absence allowlist contains exactly the accepted IDs', () => {
  const source = readFileSync(`${root}/src/roles.js`, 'utf8');
  const clause = source.match(/\(preset === 'claude-only' && \[([^\]]+)\]\.includes\(role\.id\)\)/)?.[1];
  expect(clause).toBeTruthy();
  const ids = [...clause.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  expect(ids).toEqual([
    'axstack-advisor-astra', 'axstack-arena-judge-astra',
    'axstack-research-x',
    'axstack-arena-candidate-grok',
    'axstack-auditor-sol', 'axstack-research-code-sol', 'axstack-explore-execution-sol',
    'axstack-explore-codebase-luna', 'axstack-research-web-sol',
  ]);
  expect(assessRoleReadiness([
    { id: 'axstack-auditor', name: 'Auditor', provider: 'claude', model: null },
  ], 'claude-only').gaps).toContain('axstack-auditor requires a configured model');
});

test('mixed readiness rejects the retired workflow provider', () => {
  const result = assessRoleReadiness([
    { ...role('axstack-checker', 'configured-model'), provider: 'antigravity' },
  ], 'mixed');
  expect(result.ready).toBe(false);
  expect(result.gaps.join(' ')).toMatch(/outside mixed bounds/);
});

test('arena candidate null models follow their configured family or intentional single-provider absence', () => {
  for (const [id, provider] of [
    ['axstack-arena-candidate-grok', 'grok'],
  ]) {
    expect(assessRoleReadiness([{ ...role(id, null), provider }], 'mixed')).toEqual({ ready: true, gaps: [] });
    expect(assessRoleReadiness([{ ...role(id, null), provider: 'codex' }], 'mixed').gaps).toContain(`${id} requires a configured model`);
    for (const preset of ['codex-only', 'claude-only']) {
      const singleProvider = preset === 'codex-only' ? 'codex' : 'claude';
      expect(assessRoleReadiness([{ ...role(id, null), provider: singleProvider }], preset)).toEqual({ ready: true, gaps: [] });
    }
  }
});

test('claude-only readiness permits the unavailable Astra slot', () => {
  const roles = [
    { ...role('axstack-advisor-astra', null), provider: 'claude', thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', 'claude-opus-5-5'), provider: 'claude', thinkingOptionId: 'xhigh' },
    { ...role('axstack-author', 'claude-opus-5-5'), provider: 'claude' },
    { ...role('axstack-reviewer-primary', 'claude-opus-5-5'), provider: 'claude' },
    {
      ...role('axstack-reviewer-secondary', 'claude-sonnet-5-5'),
      provider: 'claude', thinkingOptionId: 'high',
    },
  ];

  expect(assessRoleReadiness(roles, 'claude-only')).toEqual({ ready: true, gaps: [] });
});

test('arena judge seats follow the adviser absence rule per provider preset', () => {
  const codex = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', null), thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-6.1-terra'), thinkingOptionId: 'high' },
    { ...role('axstack-arena-judge-astra', 'gpt-6-astra'), thinkingOptionId: 'xhigh' },
    { ...role('axstack-escalation-fable', null), thinkingOptionId: 'xhigh' },
  ];
  expect(assessRoleReadiness(codex, 'codex-only')).toEqual({ ready: true, gaps: [] });
  codex.find(({ id }) => id === 'axstack-arena-judge-astra').model = null;
  expect(assessRoleReadiness(codex, 'codex-only').gaps).toEqual([
    'axstack-arena-judge-astra requires a configured model',
  ]);

  const mixed = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', 'claude-opus-5-5'), provider: 'claude', thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'claude-opus-5-5'), provider: 'claude', thinkingOptionId: 'high' },
    { ...role('axstack-escalation-fable', null), provider: 'claude', thinkingOptionId: 'xhigh' },
  ];
  expect(assessRoleReadiness(mixed, 'mixed').gaps).toEqual([
    'axstack-escalation-fable requires a configured model',
  ]);
});

test('Opus judge is absent only in codex-only readiness', () => {
  const opus = { ...role('axstack-arena-judge-opus', null), provider: 'codex', thinkingOptionId: 'xhigh' };
  expect(assessRoleReadiness([opus], 'codex-only')).toEqual({ ready: true, gaps: [] });
  expect(assessRoleReadiness([{ ...opus, provider: 'claude' }], 'mixed').gaps).toContain(
    'axstack-arena-judge-opus requires a configured model',
  );
  expect(assessRoleReadiness([{ ...opus, provider: 'claude' }], 'claude-only').gaps).toContain(
    'axstack-arena-judge-opus requires a configured model',
  );
});

test('readiness rejects a null model on a non-intentional row such as an investigator seat', () => {
  const roles = [
    { ...role('axstack-advisor-astra', 'gpt-6-astra'), thinkingOptionId: 'high' },
    { ...role('axstack-advisor-opus', null), thinkingOptionId: 'xhigh' },
    role('axstack-author', 'gpt-6-sol'),
    role('axstack-reviewer-primary', 'gpt-6-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-6.1-terra'), thinkingOptionId: 'high' },
    role('axstack-debug-investigator-1', null),
  ];
  expect(assessRoleReadiness(roles, 'codex-only').gaps).toEqual([
    'axstack-debug-investigator-1 requires a configured model',
  ]);
});

test('mixed checker needs a configured model or class', () => {
  expect(assessRoleReadiness([{ ...role('axstack-checker', null), provider: 'claude' }], 'mixed').gaps)
    .toContain('axstack-checker requires a configured model');
});

test('codex-only authored route holds a Luna reviewer', () => {
  const rows = [
    role('axstack-author', 'gpt-6.1-sol'),
    { ...role('axstack-reviewer-secondary', 'gpt-6.1-terra'), thinkingOptionId: 'high' },
  ];
  expect(assessRoleReadiness(rows, 'codex-only')).toEqual({ ready: true, gaps: [] });
  rows[1] = { ...rows[1], model: 'gpt-6-luna', thinkingOptionId: 'xhigh' };
  expect(assessRoleReadiness(rows, 'codex-only').gaps).toContain(
    'authored routing gap: axstack-reviewer-secondary must be codex/terra/high for author codex/sol',
  );
});


test('installed snapshot readiness holds tampered Terra effort', () => {
  const expected = [{ ...role('axstack-custom', 'gpt-6.1-terra'), thinkingOptionId: 'high' }];
  for (const effort of [undefined, 'medium', 'xhigh']) {
    const bytes = installedRoleBytes('mixed', [{ ...expected[0], thinkingOptionId: effort }]);
    const readback = assessInstalledRoleSnapshot(bytes, 'mixed', expected);
    expect(readback.ready).toBe(false);
    expect(readback.gaps.join(' ')).toMatch(/Terra.*high/i);
  }
});
