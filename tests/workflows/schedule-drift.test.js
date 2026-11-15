import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
const script = `${import.meta.dir}/../../skills/axstack/scripts/schedule-drift.js`;
const fixture = await Bun.file(`${import.meta.dir}/fixtures/schedule-drift.json`).json();
const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true }); });
function snapshot(dir) {
  return readdirSync(dir, { withFileTypes: true }).map((e) => [e.name,
    e.isDirectory() ? snapshot(`${dir}/${e.name}`) : readFileSync(`${dir}/${e.name}`, 'utf8')]);
}
function run(change = () => {}) {
  const data = structuredClone(fixture);
  change(data);
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/schedule-drift-`);
  roots.push(dir);
  for (const [name, prompt] of Object.entries(data.prompts)) writeFileSync(`${dir}/${name}`, prompt);
  for (const name of ['export', 'bindings']) writeFileSync(`${dir}/${name}.json`, JSON.stringify(data[name]));
  mkdirSync(`${dir}/.bun/install/cache`, { recursive: true }); // Bun creates its empty runtime cache on startup.
  const before = snapshot(dir);
  const result = Bun.spawnSync([process.execPath, script, '--export', `${dir}/export.json`,
    '--bindings', `${dir}/bindings.json`, '--prompts', dir, '--now', data.now],
  { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: dir, BUN_INSTALL_CACHE_DIR: dir, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' } });
  expect(snapshot(dir)).toEqual(before);
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
  ['added UTF-8 BOM', (d) => { d.prompts['review-manager-prompt.md'] = `\uFEFF${d.prompts['review-manager-prompt.md']}`; }, 'review-manager-prompt.md.prompt'],
  ['edited packaged bytes', (d) => { d.prompts['review-manager-prompt.md'] += 'extra'; }, 'review-manager-prompt.md.prompt'],
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

for (const [name, keepTask, expected] of [
  ['declared absent', false, 'n/a'],
  ['declared absent identity exists', true, 'fail'],
  ['undeclared missing', false, 'unknown'],
]) test(`${name} schedule has explicit per-term facts`, () => {
  const { code, report } = run((d) => {
    if (name !== 'undeclared missing') d.bindings.schedules[2].absent = true;
    if (!keepTask) d.export.tasks.pop();
  });
  expect(code).toBe(expected === 'unknown' ? 2 : 0);
  for (const suffix of ['binding', 'prompt', 'cadence', 'enabled']) {
    expect(status(report, `test-audit-weekly.md.${suffix}`)).toBe(expected);
  }
  expect(report.counts['n/a']).toBe(expected === 'n/a' ? 4 : 0);
});
test('host may exclude a never-created schedule without inventing a task ID', () => {
  const { code, report } = run((d) => {
    d.bindings.schedules[2] = { promptFile: 'test-audit-weekly.md', absent: true };
    d.export.tasks.pop();
  });
  expect(code).toBe(0);
  expect(report.counts['n/a']).toBe(4);
});
for (const [name, change] of [
  ['stale', (d) => { d.export.exportedAt = '2026-11-15T23:00:00Z'; }],
  ['incomplete', (d) => { d.export.complete = false; }],
  ['unavailable', (d) => { d.export = null; }],
  ['different host', (d) => { d.export.host = 'different-host'; }],
]) test(`declared absence stays unknown with ${name} export`, () => {
  const { code, report } = run((d) => {
    d.bindings.schedules[2].absent = true;
    change(d);
  });
  expect(code).toBe(2);
  for (const suffix of ['binding', 'prompt', 'cadence', 'enabled']) {
    expect(status(report, `test-audit-weekly.md.${suffix}`)).toBe('unknown');
  }
});
