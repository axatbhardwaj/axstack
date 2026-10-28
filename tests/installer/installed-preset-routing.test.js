import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli, writeFixtureBundle } from './helpers.js';
import { prohibits, requires } from '../workflows/prose-contract.js';

const CLI = join(import.meta.dir, '..', '..', 'bin', 'axstack.js');

test('installed mixed UI verifier dispatches Terra high and holds when unavailable', () => {
  const root = makeTempRoot('axstack-ui-routing-');
  const home = join(root, 'home');
  mkdirSync(home);
  const skillsDir = join(home, '.agents/skills');
  const bundle = join(import.meta.dir, '../..');
  const options = { env: { HOME: home } };
  runCli(CLI, ['install', '--preset', 'mixed', '--bundle', bundle,
    '--skills-dir', skillsDir, '--instructions', join(home, 'AGENTS.md'),
    '--no-claude-settings', '--yes'], options);
  const capabilities = JSON.parse(readFileSync(join(import.meta.dir,
    '../workflows/fixtures/t3-capabilities.json'), 'utf8'));
  const codex = capabilities.providers.find(({ providerInstanceId }) => providerInstanceId === 'codex');
  codex.models.push({ id: 'gpt-6.1-terra', options: [
    { id: 'reasoningEffort', options: [{ id: 'high' }] },
  ] });
  const caps = join(root, 'capabilities.json');
  writeFileSync(caps, JSON.stringify(capabilities));
  const script = join(skillsDir, 'axstack/scripts/dispatch-plan.js');
  const args = ['--role', 'axstack-ui-verifier', '--roles', join(skillsDir, 'axstack/roles.json'),
    '--capabilities', caps, '--kind', 'task'];
  const result = runCli(script, args, options);
  expect(JSON.parse(result.out)).toMatchObject({
    target: { providerInstanceId: 'codex', model: 'gpt-6.1-terra',
      options: [{ id: 'reasoningEffort', value: 'high' }] },
    runtimeMode: 'full-access',
  });
  // Sol and Claude remain available: neither may substitute for missing Terra/high.
  for (const models of [codex.models.filter(({ id }) => id !== 'gpt-6.1-terra'),
    codex.models.map((model) => model.id === 'gpt-6.1-terra'
      ? { ...model, options: [{ id: 'reasoningEffort', options: [{ id: 'medium' }] }] } : model)]) {
    writeFileSync(caps, JSON.stringify({ ...capabilities, providers: capabilities.providers.map(
      (provider) => provider === codex ? { ...provider, models } : provider) }));
    const held = Bun.spawnSync([process.execPath, script, ...args], {
      env: { ...process.env, HOME: home }, stdout: 'pipe', stderr: 'pipe',
    });
    expect(held.exitCode).toBe(2);
    expect(held.stdout.toString()).toBe('');
    expect(held.stderr.toString()).toMatch(/model|effort/);
  }
});
// Exercise the installed instruction boundary, including real manifest bytes.
// This proves the declared route is usable, not a live agent routing decision.
for (const legacy of [null, 'claude-only']) {
  test(`F3: installed preset remains the routing source with legacy preset ${legacy}`, () => {
    const home = makeTempRoot('axstack-installed-routing-');
    const routing = readFileSync(join(import.meta.dir, '../../skills/axstack/references/routing.md'), 'utf8');
    const bundle = writeFixtureBundle(home, { supportFiles: { 'routing.md': routing } });
    const selected = JSON.parse(readFileSync(join(bundle, 'profiles/presets/mixed.json'), 'utf8'));
    writeFileSync(join(bundle, 'profiles/presets/claude-only.json'), JSON.stringify({
      ...selected,
      roles: selected.roles.map((role) => ({ ...role, provider: 'claude', model: 'legacy-model' })),
    }));
    const skillsDir = join(home, 'installed');
    const args = ['install', '--bundle', bundle, '--skills-dir', skillsDir,
      '--yes'];
    const options = { env: { HOME: home } };
    runCli(CLI, [...args, '--preset', 'claude-only'], options);
    expect(JSON.parse(readFileSync(join(skillsDir, 'axstack/roles.json'), 'utf8')).preset).toBe('claude-only');
    const manifestPath = join(skillsDir, '.axstack-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.profiles.preset).toBeNull();
    if (legacy !== null) {
      manifest.profiles.preset = legacy;
      writeFileSync(manifestPath, JSON.stringify(manifest));
    }
    expect(JSON.parse(readFileSync(manifestPath, 'utf8')).profiles.preset).toBe(legacy);
    // Reinstall reads the injected manifest; legacy provenance cannot select the new roles.
    runCli(CLI, [...args, '--preset', 'mixed'], options);
    expect(JSON.parse(readFileSync(manifestPath, 'utf8')).profiles).toEqual(manifest.profiles);
    const snapshot = JSON.parse(readFileSync(join(skillsDir, 'axstack/roles.json'), 'utf8'));
    expect(snapshot.preset).toBe('mixed');
    expect(snapshot.roles).toEqual(selected.roles);
    const instruction = readFileSync(join(skillsDir, 'axstack-demo/routing.md'), 'utf8');
    expect(requires(instruction, /new runs/i, /preset/i, /skills\/axstack\/roles\.json/i)).toBe(true);
    expect(requires(instruction, /legacy manifest/i, /profiles\.preset/i, /inert/i, /ignored/i, /stale/i)).toBe(true);
    expect(prohibits(instruction, /does not create/i, /stale.*manifest/i, /contradiction/i)).toBe(true);
  });
}
