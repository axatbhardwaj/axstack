import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/dispatch-plan.js`;
const resolver = `${import.meta.dir}/../../skills/axstack/scripts/resolve-models.js`;
const fixture = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/dispatch-plan.json`, 'utf8'));
const catalog = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/t3-capabilities.json`, 'utf8'));
catalog.providers.find((p) => p.driverKind === 'antigravity').models = fixture.antigravityModels;

function setup() {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/dispatch-plan-`);
  const roles = { version: fixture.version, preset: fixture.preset, roles: structuredClone(fixture.roles) };
  const capabilities = structuredClone(catalog);
  const picker = structuredClone(fixture.picker);
  const save = (name, data) => {
    const path = `${dir}/${name}.json`;
    writeFileSync(path, JSON.stringify(data));
    return path;
  };
  function run(role = 'axstack-author', kind = 'launch', configuration) {
    const args = ['--role', role, '--roles', save('roles', roles),
      '--capabilities', save('capabilities', capabilities), '--picker', save('picker', picker), '--kind', kind];
    if (configuration !== undefined) args.push('--verify', save('configuration', configuration));
    return invoke(args);
  }
  return { dir, roles, capabilities, picker, save, run };
}

function invoke(args) {
  const result = Bun.spawnSync([process.execPath, script, ...args], { stdout: 'pipe', stderr: 'pipe' });
  return { status: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString() };
}

test('dispatch plans equal hand-built payloads for every provider and both tool kinds', () => {
  const cases = [
    ['axstack-author', 'codexAlt', 'gpt-6.1-sol', [{ id: 'reasoningEffort', value: 'high' }]],
    ['axstack-reviewer', 'claudeAgent', 'claude-opus-5-5', [{ id: 'effort', value: 'medium' }]],
    ['axstack-research-x', 'grok', 'grok-4.7', [{ id: 'reasoningEffort', value: 'high' }]],
    ['axstack-checker', 'antigravity', 'gemini-3.8-flash-low', []],
  ];
  for (const [role, instance, model, options] of cases) {
    const f = setup();
    f.picker.chosenInstanceId = instance;
    for (const kind of ['task', 'launch']) {
      const result = f.run(role, kind);
      expect(result.status).toBe(0);
      expect(result.error).toBe('');
      const selection = kind === 'launch' ? { instanceId: instance, model, options }
        : { providerInstanceId: instance, model, options };
      expect(JSON.parse(result.output)).toEqual({ [kind === 'launch' ? 'modelSelection' : 'target']: selection,
        runtimeMode: 'full-access' });
    }
  }
});

test('a recorded exact model pin wins over its class and a newer catalog model', () => {
  const f = setup();
  const result = f.run('axstack-pinned');
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output).modelSelection.model).toBe('gpt-6-sol');
});

test('resolver holds map exit 1 to exit 2 and preserve stderr byte for byte', () => {
  const f = setup();
  f.roles.roles[0].thinkingOptionId = 'unavailable';
  const path = f.save('capabilities', f.capabilities);
  const direct = Bun.spawnSync([process.execPath, resolver, '--provider', 'codex', '--capabilities', path,
    '--class', 'sol', '--effort', 'unavailable'], { stdout: 'pipe', stderr: 'pipe' });
  expect(direct.exitCode).toBe(1);
  const result = f.run();
  expect(result.status).toBe(2);
  expect(result.output).toBe('');
  expect(result.error).toBe(direct.stderr.toString());
});

const configuration = () => ({ modelSelection: { instanceId: 'codexAlt', model: 'gpt-6.1-sol',
  options: [{ id: 'reasoningEffort', value: 'high' }] }, runtimeMode: 'full-access' });

test('verification matches T3 read-back for either dispatch kind and normalizes option maps', () => {
  const f = setup();
  for (const kind of ['launch', 'task']) {
    for (const options of [[{ id: 'reasoningEffort', value: 'high' }], { reasoningEffort: 'high' }]) {
      const data = configuration(); data.modelSelection.options = options;
      const result = f.run('axstack-author', kind, data);
      expect(result).toEqual({ status: 0, output: 'MATCH\n', error: '' });
    }
  }
});

for (const [field, change] of [
  ['instance', (data) => { data.modelSelection.instanceId = 'codex'; }],
  ['provider', (data) => { data.modelSelection.provider = 'grok'; }],
  ['model', (data) => { data.modelSelection.model = 'gpt-6-sol'; }],
  ['options', (data) => { data.modelSelection.options[0].value = 'low'; }],
  ['options', (data) => { data.modelSelection.options = [{ id: 'effort', value: 'high' }]; }],
  ['options', (data) => { data.modelSelection.options = []; }],
  ['options', (data) => { data.modelSelection.options.push({ id: 'reasoningEffort', value: 'high' }); }],
  ['runtimeMode', (data) => { data.runtimeMode = 'approval-required'; }],
]) {
  test(`verification holds and names a mismatched ${field} (${change})`, () => {
    const data = configuration(); change(data);
    const result = setup().run('axstack-author', 'launch', data);
    expect(result.status).toBe(2);
    expect(result.output).toContain(field);
    expect(result.output).toContain('fail');
    expect(result.output).not.toContain('MATCH');
  });
}

for (const field of ['instanceId', 'model', 'options', 'runtimeMode']) {
  test(`verification holds unknown when ${field} read-back is missing`, () => {
    const data = configuration();
    if (field === 'runtimeMode') delete data.runtimeMode;
    else delete data.modelSelection[field];
    const result = setup().run('axstack-author', 'task', data);
    expect(result.status).toBe(2);
    expect(result.output).toContain(field);
    expect(result.output).toContain('unknown');
  });
}

test('verification prints every mismatch with expected and observed evidence', () => {
  const result = setup().run('axstack-author', 'launch', {
    modelSelection: { instanceId: 'wrong', model: 'wrong', options: [] }, runtimeMode: 'auto',
  });
  expect(result.status).toBe(2);
  for (const field of ['instanceId', 'model', 'options', 'runtimeMode']) expect(result.output).toContain(field);
  expect(result.output).toContain('gpt-6.1-sol');
  expect(result.output).toContain('wrong');
});

test('Antigravity verifies effort through its model suffix with no effort option', () => {
  const f = setup(); f.picker.chosenInstanceId = 'antigravity';
  const data = { modelSelection: { instanceId: 'antigravity', model: 'gemini-3.8-flash-low', options: [] },
    runtimeMode: 'full-access' };
  expect(f.run('axstack-checker', 'launch', data).output).toBe('MATCH\n');
  data.modelSelection.model = 'gemini-3.8-flash-high';
  const result = f.run('axstack-checker', 'launch', data);
  expect(result.status).toBe(2);
  expect(result.output).toContain('model');
});
