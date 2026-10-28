import { afterEach } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../../skills/axstack/scripts/dispatch-plan.js`;
const resolver = `${import.meta.dir}/../../../skills/axstack/scripts/resolve-models.js`;
const fixture = JSON.parse(readFileSync(`${import.meta.dir}/../fixtures/dispatch-plan.json`, 'utf8'));
const catalog = JSON.parse(readFileSync(`${import.meta.dir}/../fixtures/t3-capabilities.json`, 'utf8'));
const roots = [];
afterEach(() => { for (const dir of roots.splice(0)) rmSync(dir, { recursive: true }); });

export function setup() {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/dispatch-plan-`);
  roots.push(dir);
  const roles = { version: fixture.version, preset: fixture.preset, roles: structuredClone(fixture.roles) };
  const capabilities = structuredClone(catalog);
  const save = (name, data) => {
    const path = `${dir}/${name}.json`;
    writeFileSync(path, JSON.stringify(data));
    return path;
  };
  function run(role = 'axstack-author', kind = 'launch', configuration) {
    const args = ['--role', role, '--roles', save('roles', roles),
      '--capabilities', save('capabilities', capabilities), '--kind', kind];
    if (configuration !== undefined) args.push('--verify', save('configuration', configuration));
    return invoke(args);
  }
  return { dir, roles, capabilities, save, run };
}

export function invoke(args) {
  const result = Bun.spawnSync([process.execPath, script, ...args], { stdout: 'pipe', stderr: 'pipe' });
  return { status: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString() };
}

export const configuration = () => ({ modelSelection: { instanceId: 'codex', model: 'gpt-6.1-sol',
  options: [{ id: 'reasoningEffort', value: 'high' }] }, runtimeMode: 'full-access' });
export const planArgs = (f) => ['--role', 'axstack-author', '--roles', f.save('roles', f.roles),
  '--capabilities', f.save('capabilities', f.capabilities), '--kind', 'launch'];
