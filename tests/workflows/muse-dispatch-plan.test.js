import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const script = `${root}/skills/axstack/scripts/dispatch-plan.js`;
const roles = `${root}/profiles/presets/mixed.json`;

test('mixed Muse seats plan through the synthetic muse instance with exact medium options', () => {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/muse-plan-`);
  try {
    const catalog = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/t3-capabilities.json`, 'utf8'));
    catalog.providers.push({ providerInstanceId: 'muse', driverKind: 'muse', models: [
      { id: 'muse-wonder-full-1.0', options: [{ id: 'reasoningEffort', options: [{ id: 'medium' }] }] },
      { id: 'muse-spark-1.3', options: [{ id: 'reasoningEffort', options: [{ id: 'medium' }] }] },
    ] });
    const capabilities = `${dir}/capabilities.json`, picker = `${dir}/picker.json`;
    writeFileSync(picker, JSON.stringify({ chosenInstanceId: 'muse' }));
    const run = (role) => {
      writeFileSync(capabilities, JSON.stringify(catalog));
      const result = Bun.spawnSync([process.execPath, script, '--role', role, '--roles', roles,
        '--capabilities', capabilities, '--picker', picker, '--kind', 'task'], { stdout: 'pipe', stderr: 'pipe' });
      return { status: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString() };
    };
    for (const [role, model] of [
      ['axstack-advisor-muse', 'muse-wonder-full-1.0'],
      ['axstack-reviewer-muse', 'muse-wonder-full-1.0'],
      ['axstack-arena-judge-muse', 'muse-wonder-full-1.0'],
      ['axstack-explore-codebase-spark', 'muse-spark-1.3'],
      ['axstack-research-code-spark', 'muse-spark-1.3'],
      ['axstack-debug-investigator-4', 'muse-wonder-full-1.0'],
    ]) {
      const result = run(role);
      expect(result.status, `${role}: ${result.error}`).toBe(0);
      expect(JSON.parse(result.output)).toMatchObject({ target: { providerInstanceId: 'muse', model,
        options: [{ id: 'reasoningEffort', value: 'medium' }] }, runtimeMode: 'full-access' });
    }
    catalog.providers.push({ ...catalog.providers.at(-1), providerInstanceId: 'museAlt' });
    writeFileSync(picker, JSON.stringify({ chosenInstanceId: 'museAlt' }));
    const wrongInstance = run('axstack-advisor-muse');
    expect(wrongInstance.status).toBe(2);
    expect(wrongInstance.output).toBe('');
    expect(wrongInstance.error).toContain('picker instance museAlt does not bind provider muse');
    writeFileSync(picker, JSON.stringify({ chosenInstanceId: 'muse' }));
    catalog.providers.find((provider) => provider.providerInstanceId === 'muse').models[0]
      .options[0].options = [{ id: 'low' }];
    const unavailable = run('axstack-advisor-muse');
    expect(unavailable.status).toBe(2);
    expect(unavailable.error).toContain('unsupported effort medium');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
