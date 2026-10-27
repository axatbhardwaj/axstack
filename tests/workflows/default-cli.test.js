import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import { fixture, now } from './default-routing-fixtures.js';
const script = `${import.meta.dir}/../../skills/axstack/scripts/sync-default.js`;

test('real CLI resolves relative settings, dry-run writes nothing, apply preserves overrides', () => {
  const dir = fs.mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/default-cli-`);
  try {
    const f = fixture();
    fs.mkdirSync(`${dir}/userdata`); fs.mkdirSync(`${dir}/caches`);
    for (const c of f.catalogs) fs.writeFileSync(`${dir}/caches/${c.instanceId}.json`, JSON.stringify(c));
    fs.writeFileSync(`${dir}/usage.json`, JSON.stringify(f.usage));
    const before = JSON.stringify(f.settings);
    fs.writeFileSync(`${dir}/userdata/settings.json`, before, { mode: 0o600 });
    const args = [process.execPath, script, '--settings', 'settings.json', '--usage-file', '../usage.json', '--now', new Date(now).toISOString()];
    const invoke = (...extra) => Bun.spawnSync([...args, ...extra], { cwd: `${dir}/userdata`, stdout: 'pipe', stderr: 'pipe' });
    const dry = invoke();
    expect(dry.exitCode).toBe(0);
    expect(JSON.parse(dry.stdout.toString()).action).toBe('update');
    expect(fs.readFileSync(`${dir}/userdata/settings.json`, 'utf8')).toBe(before);
    expect(fs.readdirSync(`${dir}/userdata`)).toEqual(['settings.json']);
    const apply = invoke('--apply');
    expect(apply.exitCode).toBe(0);
    const after = JSON.parse(fs.readFileSync(`${dir}/userdata/settings.json`, 'utf8'));
    expect(after.defaultModelSelection.model).toBe('gpt-6-astra');
    expect(after.projectSettingsOverrides).toEqual(f.settings.projectSettingsOverrides);
    expect(after.textGenerationModelSelection).toEqual(f.settings.textGenerationModelSelection);
    expect(apply.stdout.toString()).not.toContain('fixture-secret');
    const repeated = invoke('--apply');
    expect(JSON.parse(repeated.stdout.toString()).action).toBe('unchanged');
    expect(fs.readdirSync(`${dir}/userdata`)).toEqual(['settings.json']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
