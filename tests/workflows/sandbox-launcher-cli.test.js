import { expect, test } from 'bun:test';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fixture, image, planners } from './sandbox-launcher-fixture.js';

const launcher = `${import.meta.dir}/../../skills/axstack/sandbox/launcher.js`;
test('help discloses owned resources, per-run probes and the caller timeout', () => {
  const result = Bun.spawnSync([process.execPath, launcher, '--help']);
  expect(result.exitCode).toBe(0);
  const text = result.stdout.toString();
  for (const word of ['plan', 'run', 'reap', 'image file', 'loop device', 'volume', '/var/lib/axstack/sandbox', 'per-run', '910', 'SIGINT', 'SIGHUP', 'exit 2']) expect(text).toContain(word);
});

test('unknown CLI options fail instead of silently doing nothing', () => {
  const result = Bun.spawnSync([process.execPath, launcher, 'run', '--privileged']);
  expect(result.exitCode).toBe(1);
});
test('packaged CLI prints exact plan argv/rules with interface fakes and wrong-host writers exit 2', () => {
  const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/launcher-cli-`); chmodSync(root, 0o700);
  try {
    cpSync(`${import.meta.dir}/../../skills/axstack/sandbox`, `${root}/sandbox`, { recursive: true });
    mkdirSync(`${root}/scripts`);
    for (const file of ['capture-identity.js', 'command-capture.js', 'git-argv.js']) cpSync(`${import.meta.dir}/../../skills/axstack/scripts/${file}`, `${root}/scripts/${file}`);
    const fake = planners();
    for (const [file, name] of [['network', 'planNetwork'], ['storage', 'planStorage'], ['probes', 'planProbes']]) {
      cpSync(`${root}/sandbox/${file}.js`, `${root}/sandbox/${file}-real.js`);
      writeFileSync(`${root}/sandbox/${file}.js`, `export * from './${file}-real.js'; const image = ${JSON.stringify(image)}; export const ${name} = ${fake[name].toString()};\n`);
    }
    writeFileSync(`${root}/input.json`, JSON.stringify(fixture()));
    const argv = [process.execPath, `${root}/sandbox/launcher.js`];
    const result = Bun.spawnSync([...argv, 'plan', '--input', `${root}/input.json`]);
    expect(result.exitCode).toBe(0);
    const p = JSON.parse(result.stdout.toString());
    expect(p.rules).toEqual(fake.planNetwork({ runId: 'r1' }).rules);
    for (const c of p.containers) expect(c.argv.slice(0, 2)).toEqual(['docker', 'create']);
    writeFileSync(`${root}/sandbox/launcher-host.json`, JSON.stringify({ schemaVersion: 1, hostname: 'axat-vps', machineIdSha256: '0'.repeat(64) }));
    mkdirSync(`${root}/evidence`, { mode: 0o700 });
    for (const args of [['run', '--input', `${root}/input.json`, '--evidence-dir', `${root}/evidence`], ['reap']]) {
      const held = Bun.spawnSync([...argv, ...args]);
      expect(held.exitCode).toBe(2); expect(held.stderr.toString()).toContain('wrong host');
    }
    expect(readdirSync(`${root}/evidence`)).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
