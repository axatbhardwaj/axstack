import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fixture, NOW } from './fleet-route-fixture.js';

const script = `${import.meta.dir}/../../skills/axstack/scripts/fleet-route.js`;
function setup() {
  const dir = mkdtempSync(`${process.env.TMPDIR}/fleet-cli-`);
  const f = fixture();
  const save = (name, value) => {
    const path = `${dir}/${name}`;
    writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
    return path;
  };
  const input = f.bind();
  const config = save('config.json', input.configText);
  const path = save('input.json', input);
  const args = ['recommend', '--input', path, '--config', config, '--now', String(NOW), '--json'];
  const run = (values = args, env = {}) => {
    const result = Bun.spawnSync([process.execPath, script, ...values], {
      stdout: 'pipe', stderr: 'pipe', env: { ...process.env, ...env },
    });
    return { status: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString() };
  };
  return { dir, f, input, config, path, save, args, run };
}

test('saved-input CLI returns deterministic destination facts without modifying files', () => {
  const f = setup();
  const before = readdirSync(f.dir).map((name) => [name, readFileSync(`${f.dir}/${name}`, 'utf8')]);
  const result = f.run();
  expect(result.status).toBe(0);
  const report = JSON.parse(result.output);
  expect(report).toMatchObject({ schemaVersion: 1, evaluatedAt: NOW, configDigest: f.input.configDigest,
    stage: 'balance', selected: { environmentId: 'worker-a', projectId: 'project-worker-a',
      destinationSnapshotId: 'snapshot-worker-a', execution: { model: 'fixture-model' } } });
  expect(result.error).toBe('');
  expect(f.run().output).toBe(result.output);
  expect(readdirSync(f.dir).map((name) => [name, readFileSync(`${f.dir}/${name}`, 'utf8')])).toEqual(before);
});

test('CLI uses the account-local default and accepts a run-pinned digest separately', () => {
  const f = setup();
  mkdirSync(`${f.dir}/.config/haoshoku`, { recursive: true });
  writeFileSync(`${f.dir}/.config/haoshoku/fleet-routing.json`, f.input.configText);
  delete f.input.configText;
  delete f.input.configDigest;
  f.save('input.json', f.input);
  const args = f.args.filter((_, i) => ![3, 4].includes(i));
  args.push('--config-digest', f.f.bind().configDigest);
  const result = f.run(args, { HOME: f.dir });
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output).selected.hostId).toBe('worker-a');
});

test('CLI task choice and reasoned exclusion retry use saved facts', () => {
  const f = setup();
  f.input.telemetry.forEach((s) => { s.cpuBp = 2000; });
  f.input.exclusions.routes['route-worker-c'] = 'unambiguous launch rejection';
  f.save('input.json', f.input);
  const result = f.run([...f.args, '--task', 'playwright']);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output)).toMatchObject({ request: { task: 'playwright' },
    selected: { hostId: 'worker-a' }, excluded: expect.arrayContaining([
      expect.objectContaining({ routeId: 'route-worker-c', reasons: ['excluded-route'],
        exclusion: 'unambiguous launch rejection' }),
    ]) });
});

test('no executable route has explicit JSON and hold status', () => {
  const f = setup();
  f.input.destinations = [];
  f.save('input.json', f.input);
  const result = f.run();
  expect(result.status).toBe(2);
  expect(JSON.parse(result.output)).toMatchObject({ stage: 'no-route', selected: null,
    excluded: expect.arrayContaining([expect.objectContaining({ reasons: expect.arrayContaining(['destination-unproven']) })]) });
});

test('CLI rejects missing, malformed, schema and digest inputs explicitly', () => {
  for (const [change, code] of [
    [(f) => { f.save('input.json', '{'); }, 'input-json'],
    [(f) => { f.input.schemaVersion = 9; f.save('input.json', f.input); }, 'schema-version'],
    [(f) => { delete f.input.configDigest; f.save('input.json', f.input); }, 'config-digest'],
    [(f) => { f.input.configDigest = '0'.repeat(64); f.save('input.json', f.input); }, 'config-digest-mismatch'],
    [(f) => { f.save('config.json', `${f.input.configText}\n`); }, 'config-digest-mismatch'],
    [(f) => { f.input.configText += '\n'; f.save('input.json', f.input); }, 'config-snapshot-mismatch'],
    [(f) => { f.args[4] = `${f.dir}/missing`; }, 'missing-config'],
    [(f) => { f.args[2] = `${f.dir}/missing`; }, 'missing-input'],
    [(f) => { f.args[6] = '-1'; }, 'evaluation-time'],
    [(f) => { f.args[6] = '1e5'; }, 'evaluation-time'],
    [(f) => { f.args.splice(5, 2); }, 'missing-argument'],
    [(f) => { f.args.push('--now', '100000'); }, 'duplicate-argument'],
    [(f) => { f.args.push('--dispatch'); }, 'unexpected-argument'],
  ]) {
    const f = setup(); change(f);
    const result = f.run();
    expect(result.status, code).toBe(1);
    expect(result.output, code).toBe('');
    expect(JSON.parse(result.error).error.code, code).toBe(code);
  }
});

test('help describes the offline interface; unsupported commands fail explicitly', () => {
  const f = setup();
  const help = f.run(['--help']);
  expect(help.status).toBe(0);
  for (const flag of ['recommend', '--input', '--now', '--config', '--config-digest', '--task', '--json']) {
    expect(help.output).toContain(flag);
  }
  expect(f.run(['sample', '--json']).status).toBe(1);
});
