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
