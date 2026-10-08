import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/dispatch-plan.js`;
const resolver = `${import.meta.dir}/../../skills/axstack/scripts/resolve-models.js`;
const fixture = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/dispatch-plan.json`, 'utf8'));
const catalog = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/t3-capabilities.json`, 'utf8'));
catalog.providers.find((p) => p.driverKind === 'antigravity').models = fixture.antigravityModels;
const roots = [];
afterEach(() => { for (const dir of roots.splice(0)) rmSync(dir, { recursive: true }); });

function setup() {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/dispatch-plan-`);
  roots.push(dir);
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

for (const [index, [field, change]] of [
  ['instance', (data) => { data.modelSelection.instanceId = 'codex'; }],
  ['provider', (data) => { data.modelSelection.provider = 'grok'; }],
  ['model', (data) => { data.modelSelection.model = 'gpt-6-sol'; }],
  ['options', (data) => { data.modelSelection.options[0].value = 'low'; }],
  ['options', (data) => { data.modelSelection.options = [{ id: 'effort', value: 'high' }]; }],
  ['options', (data) => { data.modelSelection.options = []; }],
  ['options', (data) => { data.modelSelection.options.push({ id: 'reasoningEffort', value: 'high' }); }],
  ['runtimeMode', (data) => { data.runtimeMode = 'approval-required'; }],
].entries()) {
  test(`verification holds and names a mismatched ${field} (case ${index + 1})`, () => {
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

test('--help lists every flag, exit meaning and read-only side effect contract', () => {
  const result = invoke(['--help']);
  expect(result.status).toBe(0);
  for (const flag of ['--role', '--roles', '--capabilities', '--picker', '--kind', '--verify', '--help']) {
    expect(result.output).toContain(flag);
  }
  expect(result.output).toMatch(/0.*ok.*1.*error.*2.*hold/i);
  expect(result.output).toMatch(/read.only/i);
});

for (const [index, [field, change]] of [
  ['role', (f) => { f.roles.roles = []; }],
  ['role', (f) => { f.roles.roles.push(f.roles.roles[0]); }],
  ['mode', (f) => { f.roles.roles[0].modeId = 'unavailable'; }],
  ['mode', (f) => { delete f.roles.roles[0].modeId; }],
  ['mode', (f) => { f.roles.roles[0].modeId = 'bypassPermissions'; }],
  ['effort', (f) => { delete f.roles.roles[0].thinkingOptionId; }],
  ['model', (f) => { delete f.roles.roles[0].modelClass; }],
  ['instance', (f) => { f.picker.chosenInstanceId = null; }],
  ['instance', (f) => { f.picker.chosenInstanceId = 'grok'; }],
].entries()) {
  test(`unavailable ${field} holds without emitting a dispatch (case ${index + 1})`, () => {
    const f = setup(); change(f);
    const result = f.run();
    expect(result.status).toBe(2);
    expect(result.output).toBe('');
    expect(result.error).toContain(field);
  });
}

test('a catalog-advertised sibling must have the same provider and model/effort', () => {
  for (const change of [
    (p) => { p.driverKind = 'grok'; },
    (p) => { p.models = []; },
    (p) => { p.models[0].options[0].options = [{ id: 'low' }]; },
  ]) {
    const f = setup();
    const sibling = f.capabilities.providers.find((p) => p.providerInstanceId === 'codexAlt');
    change(sibling);
    const result = f.run();
    expect(result.status).toBe(2);
    expect(result.output).toBe('');
    expect(result.error).toMatch(/provider|model|effort/);
  }
});

test('CLI usage and unreadable JSON are errors rather than holds', () => {
  for (const args of [[], ['--unknown', 'value'], ['--role'], ['--role', 'a', '--role', 'b']]) {
    const result = invoke(args);
    expect(result.status).toBe(1);
    expect(result.output).toBe('');
    expect(result.error).toMatch(/argument|expected/);
  }
  const f = setup();
  const args = ['--role', 'axstack-author', '--roles', `${f.dir}/missing.json`,
    '--capabilities', f.save('capabilities', catalog), '--picker', f.save('picker', fixture.picker), '--kind', 'launch'];
  expect(invoke(args).status).toBe(1);
  args[3] = f.save('roles', f.roles); args[9] = 'other';
  expect(invoke(args).status).toBe(1);
});

test('malformed capabilities holds with the resolver diagnostic preserved', () => {
  const f = setup(); f.capabilities.providers = null;
  const result = f.run();
  expect(result.status).toBe(2);
  expect(result.output).toBe('');
  expect(result.error).toBe('model capabilities resolution hold: malformed capabilities providers\n');
});

for (const instanceId of ['claudeAgent', 'codexx', 'codexAlt']) {
  for (const kind of ['launch', 'task']) {
    for (const verifying of [false, true]) {
      test(`unadvertised ${instanceId} holds for ${kind}${verifying ? ' verification' : ' planning'}`, () => {
        const f = setup();
        // Keep only the canonical Codex catalog, as in the reviewer's saved subset.
        f.capabilities.providers = f.capabilities.providers.filter((p) => p.providerInstanceId === 'codex');
        f.picker.chosenInstanceId = instanceId;
        const data = configuration(); data.modelSelection.instanceId = instanceId;
        const result = f.run('axstack-author', kind, verifying ? data : undefined);
        expect(result.status).toBe(2);
        expect(result.output).toBe('');
        expect(result.error).toContain('instance');
        expect(result.error).toContain(instanceId);
      });
    }
  }
}

test('--help also succeeds when combined with other flags', () => {
  const expected = invoke(['--help']);
  for (const args of [['--help', '--role', 'axstack-author'], ['--role', 'axstack-author', '--help']]) {
    expect(invoke(args)).toEqual(expected);
  }
});

test('the test runner removes each fixture directory after its test', () => {
  const f = setup();
  const nestedRoot = `${f.dir}/nested-tests`;
  mkdirSync(nestedRoot);
  const result = Bun.spawnSync([process.execPath, 'test', import.meta.path, '-t', 'a recorded exact model pin'], {
    env: { ...process.env, TMPDIR: nestedRoot }, stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.exitCode).toBe(0);
  expect(readdirSync(nestedRoot)).toEqual([]);
});
