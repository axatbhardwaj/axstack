import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/resolve-models.js`;
const catalog = (models) => ({ client_version: '0.157.1', fetched_at: '2026-09-29T19:05:03Z', models });
const model = (slug, visibility = 'list', levels = ['high']) => ({ slug, visibility, supported_reasoning_levels: levels.map((effort) => ({ effort })) });

function run(data, modelClass = 'sol', effort = 'high') {
  const dir = mkdtempSync(`${process.env.AXSTACK_TEST_TMP_ROOT ?? process.env.TMPDIR ?? '/tmp'}/axstack-model-catalog-`);
  const path = `${dir}/catalog.json`;
  if (data !== null) writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data));
  const result = Bun.spawnSync(['bun', script, '--catalog', path, '--class', modelClass, '--effort', effort], {
    stdout: 'pipe', stderr: 'pipe', env: { ...process.env, HOME: process.env.HOME },
  });
  return { status: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString(), path };
}

test('resolver returns ordered eligible candidates and catalog provenance', () => {
  const result = run(catalog([
    model('gpt-6.9-sol'), model('gpt-6-sol'), model('gpt-6.10-sol'), model('gpt-6.1-sol'),
    model('gpt-7-sol', 'hide'), model('gpt-8-sol', 'list', ['medium']),
    model('gpt-9-terra'), model('gpt-5.5'), model('gpt-10-sol-preview'),
  ]));
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output)).toEqual({
    provider: 'codex', modelClass: 'sol', effort: 'high', model: 'gpt-6.10-sol',
    candidates: ['gpt-6.10-sol', 'gpt-6.9-sol', 'gpt-6.1-sol', 'gpt-6-sol'],
    catalog: { path: result.path, client_version: '0.157.1', fetched_at: '2026-09-29T19:05:03Z' },
  });
});

test('resolver holds missing and malformed catalogs and empty eligible classes', () => {
  for (const data of [null, '{', {}, catalog([model('gpt-6-sol', 'hide')])]) {
    const result = run(data);
    expect(result.status).not.toBe(0);
    expect(result.error).toMatch(/catalog|eligible/i);
    expect(result.output).toBe('');
  }
});
