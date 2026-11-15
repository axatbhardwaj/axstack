import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
const script = `${import.meta.dir}/../../skills/axstack/scripts/schedule-drift.js`;
const fixture = await Bun.file(`${import.meta.dir}/fixtures/schedule-drift.json`).json();
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true }); });
function run(change = () => {}) {
  const data = structuredClone(fixture);
  change(data);
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/schedule-drift-`);
  roots.push(dir);
  for (const [name, prompt] of Object.entries(data.prompts)) writeFileSync(`${dir}/${name}`, prompt);
  for (const name of ['export', 'bindings']) writeFileSync(`${dir}/${name}.json`, JSON.stringify(data[name]));
  const before = readdirSync(dir).map((p) => [p, readFileSync(`${dir}/${p}`, 'utf8')]);
  const result = Bun.spawnSync([process.execPath, script, '--export', `${dir}/export.json`,
    '--bindings', `${dir}/bindings.json`, '--prompts', dir, '--now', data.now],
  { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: dir } });
  expect(readdirSync(dir).map((p) => [p, readFileSync(`${dir}/${p}`, 'utf8')])).toEqual(before);
  return { code: result.exitCode, report: JSON.parse(result.stdout.toString()), dir };
}
const status = (report, id) => report.terms.find((t) => t.id === id)?.status;
test('fresh complete export compares bound bytes, cadence and enabled state without writes', () => {
  const { code, report } = run();
  expect(code).toBe(0);
  expect(report.terms.every((t) => t.status === 'pass')).toBe(true);
  expect(report.terms.length).toBeGreaterThanOrEqual(13);
  expect(report.exportSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(report).not.toHaveProperty('verdict');
});
for (const [name, change, id] of [
  ['edited prompt', (d) => { d.export.tasks[0].prompt += 'extra'; }, 'review-manager-prompt.md.prompt'],
  ['cadence mismatch', (d) => { d.export.tasks[0].schedule.everyMs = 3600000; }, 'review-manager-prompt.md.cadence'],
  ['false host cadence declaration', (d) => { d.bindings.schedules[0].schedule.everyMs = d.export.tasks[0].schedule.everyMs = 3600000; }, 'review-manager-prompt.md.cadence'],
  ['disabled schedule', (d) => { d.export.tasks[0].enabled = false; }, 'review-manager-prompt.md.enabled'],
  ['project mismatch', (d) => { d.export.tasks[0].projectId = 'other-project'; }, 'review-manager-prompt.md.binding'],
  ['host mismatch', (d) => { d.export.host = 'other-host'; }, 'host'],
]) test(name, () => {
  const { code, report } = run(change);
  expect(code).toBe(0); // Failed facts are measured, never an aggregate authority verdict.
  expect(status(report, id)).toBe('fail');
});
for (const [name, change] of [
  ['stale', (d) => { d.export.exportedAt = '2026-11-15T23:00:00Z'; }],
  ['future', (d) => { d.export.exportedAt = '2026-11-16T00:00:01Z'; }],
  ['incomplete', (d) => { d.export.complete = false; }],
  ['unavailable', (d) => { d.export = null; }],
  ['missing schedule', (d) => { d.export.tasks.pop(); }],
  ['missing prompt', (d) => { delete d.export.tasks[0].prompt; }],
  ['missing enabled', (d) => { delete d.export.tasks[0].enabled; }],
  ['duplicate identity', (d) => { d.export.tasks.push(d.export.tasks[0]); }],
  ['missing binding', (d) => { d.bindings.schedules.pop(); }],
  ['unbound host token', (d) => { delete d.bindings.schedules[0].values.HOST_HOME; }],
]) test(`${name} evidence cannot pass`, () => {
  const { code, report } = run(change);
  expect(code).toBe(2);
  expect(report.terms.some((t) => t.status === 'unknown')).toBe(true);
  if (['stale', 'future', 'incomplete', 'unavailable'].includes(name)) {
    expect(report.terms.some((t) => t.status === 'pass')).toBe(false);
  }
});
test('help documents flags and effects; invalid options exit 1', () => {
  const help = Bun.spawnSync([process.execPath, script, '--help']);
  expect(help.exitCode).toBe(0);
  for (const flag of ['--export', '--bindings', '--prompts', '--now', '--max-age-seconds', '--help']) expect(help.stdout.toString()).toContain(flag);
  expect(help.stdout.toString()).toContain('No writes');
  expect(Bun.spawnSync([process.execPath, script, '--bad']).exitCode).toBe(1);
});
