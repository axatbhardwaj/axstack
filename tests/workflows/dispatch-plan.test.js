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
      expect(JSON.parse(result.output)).toEqual({ inputs: { role, kind, roles: `${f.dir}/roles.json`,
        capabilities: `${f.dir}/capabilities.json`, picker: `${f.dir}/picker.json` },
        [kind === 'launch' ? 'modelSelection' : 'target']: selection,
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
      expect(result.status).toBe(0);
      expect(result.output).toContain('MATCH\n');
      expect(result.error).toBe('');
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
  const matched = f.run('axstack-checker', 'launch', data);
  expect(matched.status).toBe(0);
  expect(matched.output.split('\n').slice(-2)).toEqual(['MATCH', '']);
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

const planArgs = (f) => ['--role', 'axstack-author', '--roles', f.save('roles', f.roles),
  '--capabilities', f.save('capabilities', f.capabilities), '--picker', f.save('picker', f.picker), '--kind', 'launch'];

test('CLI example includes every required input', () => {
  expect(invoke(['--help']).output).toMatch(/Example: bun .* --role .* --roles .* --capabilities .* --picker .* --kind launch/);
});

test('usage/input errors tell the caller how to recover', () => {
  for (const args of [[], ['--kind', 'other'], planArgs(setup()).map((value) => value.endsWith('/roles.json') ? '/missing.json' : value)]) {
    const result = invoke(args);
    expect(result.status).toBe(1);
    expect(result.error).toMatch(/pass|use --help/);
  }
});

test('plan and verification name every supplied input path', () => {
  const f = setup(), args = planArgs(f);
  expect(JSON.parse(invoke(args).output).inputs).toEqual({ role: 'axstack-author', roles: args[3], capabilities: args[5], picker: args[7], kind: 'launch' });
  const path = f.save('configuration', configuration());
  expect(invoke([...args, '--verify', path]).output).toContain(path);
});

test('large verification uses a caller-given artifact and explicit omitted counts', () => {
  const f = setup(), args = planArgs(f), data = configuration();
  data.modelSelection.model = 'wrong'.repeat(2000);
  const verify = f.save('configuration', data), out = `${f.dir}/full.json`;
  const missingOut = invoke([...args, '--verify', verify]);
  expect(missingOut.status).toBe(2);
  expect(missingOut.output).toContain(data.modelSelection.model);
  expect(missingOut.error).toContain('pass --out <path>.json for the full list');
  const result = invoke([...args, '--verify', verify, '--out', out]);
  expect(result.status).toBe(2);
  const summary = JSON.parse(result.output), full = JSON.parse(readFileSync(out, 'utf8'));
  expect(summary.reportPath).toBe(out);
  expect(summary.omittedMismatches).toBe(1);
  expect(summary.omittedPayloadFields).toBe(1);
  expect(full.mismatches[0]).toContain(data.modelSelection.model);
  expect(result.output.length).toBeLessThan(2000);
});

test('main accepts argv and captures plan, verification and errors through io in process', async () => {
  const module = await import(script);
  expect(module.main).toBeFunction();
  const f = setup(), args = planArgs(f);
  let output = '', error = '';
  const io = { stdout: (text) => { output += text; }, stderr: (text) => { error += text; } };
  expect(module.main(args, io)).toBe(0);
  expect(JSON.parse(output).modelSelection.instanceId).toBe('codexAlt');
  output = '';
  expect(module.main([...args, '--verify', f.save('configuration', configuration())], io)).toBe(0);
  expect(output).toContain('MATCH');
  expect(module.main([], io)).toBe(1);
  expect(error).toContain('pass');
});
