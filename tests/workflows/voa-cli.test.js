import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';
import { fixture, key, thread } from './voa-fixtures.js';

const CLI = `${import.meta.dir}/../../skills/voa/scripts/voa.js`;
function drive(root, args) {
  return Bun.spawnSync([process.execPath, CLI, ...args], { cwd: root,
    env: { PATH: '/nonexistent', HOME: `${root}/home`, TMPDIR: root, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' },
    stdout: 'pipe', stderr: 'pipe', timeout: 5000 });
}

test('saved CLI modes stay stateless, deterministic and offline with no provider CLI on PATH', () => {
  const root = makeTempRoot('voa-cli-'); mkdirSync(`${root}/home`);
  const input = fixture(); const path = `${root}/snapshot.json`;
  writeFileSync(path, JSON.stringify(input));
  const before = readFileSync(path, 'utf8'); const files = readdirSync(root).sort();
  const status = drive(root, ['--input', path]);
  expect(status.exitCode).toBe(0);
  expect(JSON.parse(status.stdout.toString()).continuations).toEqual([]);
  const recovery = drive(root, ['--input', path, '--mode', 'recovery']);
  expect(recovery.exitCode).toBe(0);
  expect(JSON.parse(recovery.stdout.toString()).continuations[0].key).toEqual(key);
  expect(drive(root, ['--mode', 'recovery', '--input', path]).stdout.toString()).toBe(recovery.stdout.toString());
  input.deliveryHistory.entries.push({ key, outcome: 'ambiguous', id: 'native:ambiguous', evidence: 'native:receipt' });
  writeFileSync(path, JSON.stringify(input));
  expect(JSON.parse(drive(root, ['--mode', 'recovery', '--input', path]).stdout.toString()).continuations).toEqual([]);
  writeFileSync(path, before);
  const cleanup = drive(root, ['--mode', 'cleanup', '--input', path]);
  expect(cleanup.exitCode).toBe(2); // absent cleanup ownership cannot be invented
  expect(JSON.parse(cleanup.stdout.toString()).continuations).toEqual([]);
  expect(readFileSync(path, 'utf8')).toBe(before);
  expect(readdirSync(root).sort()).toEqual(files);
  expect(readdirSync(`${root}/home`)).toEqual([]);
});

test('CLI discloses flags and returns incomplete for unknown coverage rather than a verdict', () => {
  const root = makeTempRoot('voa-cli-errors-');
  const help = drive(root, ['--help']);
  expect(help.exitCode).toBe(0);
  expect(help.stdout.toString()).toMatch(/--mode[\s\S]*--input[\s\S]*--help/);
  for (const args of [[], ['--mode', 'unknown'], ['--send'], ['--input'], ['--input', 'a', '--input', 'b']]) {
    expect(drive(root, args).exitCode).toBe(1);
  }
  const path = `${root}/snapshot.json`;
  const input = fixture(); input.hosts[3].reachable = false;
  writeFileSync(path, JSON.stringify(input));
  const unknown = drive(root, ['--input', path]);
  expect(unknown.exitCode).toBe(2);
  const report = JSON.parse(unknown.stdout.toString());
  expect(report.coverage).toContainEqual(expect.objectContaining({ term: 'iosatellite', state: 'unknown' }));
  expect(report).not.toHaveProperty('verdict');
  expect(report).not.toHaveProperty('authority');
  const unknownActivity = fixture(); thread(unknownActivity).childActivity = 'unknown';
  writeFileSync(path, JSON.stringify(unknownActivity));
  expect(drive(root, ['--input', path]).exitCode).toBe(2);
  input.hosts[3].reachable = true; thread(input).blocker.state = 'open';
  writeFileSync(path, JSON.stringify(input));
  expect(drive(root, ['--mode', 'recovery', '--input', path]).exitCode).toBe(0); // failed criterion is still a complete report
});
