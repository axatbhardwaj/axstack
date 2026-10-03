import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack/scripts/resolve-models.js`;
const capabilities = JSON.parse(readFileSync(`${import.meta.dir}/fixtures/t3-capabilities.json`, 'utf8'));
const fresh = () => structuredClone(capabilities);
const entry = (id, optionId = 'reasoningEffort', values = ['high']) => ({
  id, options: [{ id: optionId, options: values.map((id) => ({ id })) }],
});

function resolve(data = capabilities, args = ['--class', 'sol'], provider = 'codex', effort = 'high') {
  const dir = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/axstack-capabilities-`);
  const path = `${dir}/capabilities.json`;
  if (data !== null) writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data));
  const result = Bun.spawnSync(['bun', script, '--provider', provider, '--capabilities', path,
    '--effort', effort, ...args], { stdout: 'pipe', stderr: 'pipe' });
  return { status: result.exitCode, output: result.stdout.toString(), error: result.stderr.toString(), path };
}

function held(result, reason) {
  expect(result.status).toBe(1);
  expect(result.output).toBe('');
  expect(result.error).toMatch(/hold/i);
  expect(result.error).toMatch(reason);
}

test('capabilities binds Codex and Claude classes with exact provenance and effort IDs', () => {
  for (const [provider, modelClass, model, providerInstanceId, optionId] of [
    ['codex', 'sol', 'gpt-6.1-sol', 'codex', 'reasoningEffort'],
    ['codex', 'astra', 'gpt-6-astra', 'codex', 'reasoningEffort'],
    ['claude', 'opus', 'claude-opus-5-5', 'claudeAgent', 'effort'],
    ['claude', 'sonnet', 'claude-sonnet-5-5', 'claudeAgent', 'effort'],
    ['claude', 'fable', 'claude-fable-5-1', 'claudeAgent', 'effort'],
  ]) {
    const result = resolve(capabilities, ['--class', modelClass], provider);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.output)).toEqual({ provider, providerInstanceId, model,
      effortOption: { id: optionId, value: 'high' }, source: 'capabilities', path: result.path });
  }
});

test('capabilities orders version components numerically and ignores other classes and previews', () => {
  for (const [provider, ids, expected] of [
    ['codex', ['gpt-6.9-sol', 'gpt-6.10-sol', 'gpt-6-sol', 'gpt-9-sol-preview', 'gpt-10-astra'], 'gpt-6.10-sol'],
    ['claude', ['claude-sol-5-9', 'claude-sol-5-10', 'claude-sol-4-99', 'claude-sol-8-2-preview'], 'claude-sol-5-10'],
  ]) {
    const data = fresh();
    data.providers.find((p) => p.providerInstanceId === (provider === 'claude' ? 'claudeAgent' : provider))
      .models = ids.map((id) => entry(id, provider === 'claude' ? 'effort' : 'reasoningEffort'));
    const result = resolve(data, ['--class', 'sol'], provider);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.output).model).toBe(expected);
  }
});

test('capabilities uses an explicit preset pin as given ahead of a class', () => {
  const result = resolve(capabilities, ['--model', 'gpt-6-sol', '--class', 'sol']);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output).model).toBe('gpt-6-sol');
  held(resolve(capabilities, ['--model', 'missing', '--class', 'sol']), /missing.*model|model.*missing/i);
});

test('capabilities model:null without class selects the first listed model without sorting', () => {
  const data = fresh();
  data.providers[0].models.reverse();
  for (const [provider, model, optionId] of [
    ['codex', 'gpt-6-sol', 'reasoningEffort'], ['claude', 'claude-opus-5-5', 'effort'],
    ['grok', 'grok-4.7', 'reasoningEffort'],
  ]) {
    const result = resolve(data, ['--model', 'null'], provider);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.output)).toMatchObject({ model, effortOption: { id: optionId, value: 'high' } });
  }
  const result = resolve(capabilities, ['--model', 'null', '--class', 'fable'], 'claude');
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output).model).toBe('claude-fable-5-1');
});

test('capabilities validates effort on the selected model without choosing an older model', () => {
  const data = fresh();
  data.providers[0].models[0].options[0].options = [{ id: 'low', isDefault: true }];
  held(resolve(data), /unsupported effort.*high/i);
  held(resolve(capabilities, ['--model', 'null'], 'grok', 'max'), /unsupported effort.*max/i);
  // Even a malformed advertisement cannot override Grok's max exclusion.
  data.providers[2].models[0].options[0].options.push({ id: 'max' });
  held(resolve(data, ['--model', 'null'], 'grok', 'max'), /unsupported effort.*max/i);
});

test('capabilities holds missing files, malformed JSON and malformed provider/model options', () => {
  const malformed = [null, '{', {}, { providers: {} }, { providers: [null] }];
  for (const change of [
    (p) => { p.models = {}; }, (p) => { p.models[0] = null; },
    (p) => { p.models[0].id = 42; }, (p) => { p.models[0].options = {}; },
    (p) => { p.models[0].options[0].options = {}; },
    (p) => { p.models[0].options[0].options = [{ id: null }]; },
  ]) {
    const data = fresh(); change(data.providers[0]); malformed.push(data);
  }
  for (const data of malformed) held(resolve(data), /capabilities/i);
});

test('capabilities holds unknown or ambiguous provider instances without substitution', () => {
  held(resolve(capabilities, ['--class', 'sol'], 'other'), /provider/i);
  const absent = fresh(); absent.providers = absent.providers.slice(1);
  held(resolve(absent), /provider instance/i);
  const wrong = fresh(); wrong.providers[0].driverKind = 'grok';
  held(resolve(wrong), /provider instance/i);
  const duplicate = fresh(); duplicate.providers.push(duplicate.providers[0]);
  held(resolve(duplicate), /provider instance/i);
});

test('capabilities holds empty catalogs, unknown classes and unsupported effort options', () => {
  held(resolve(capabilities, ['--class', 'terra']), /matching.*model/i);
  held(resolve(capabilities, ['--class', 'sol'], 'grok'), /class/i);
  held(resolve(capabilities, ['--model', 'null'], 'antigravity'), /model/i);
  const empty = fresh(); empty.providers[0].models = [];
  held(resolve(empty, ['--model', 'null']), /model/i);
  const noEffort = fresh(); noEffort.providers[0].models[0].options = [];
  held(resolve(noEffort), /unsupported effort/i);
  const wrongEffort = fresh(); wrongEffort.providers[0].models[0].options[0].id = 'effort';
  held(resolve(wrongEffort), /unsupported effort/i);
});

test('capabilities preserves explicit rejection exclusions and holds when all matches are fenced', () => {
  const result = resolve(capabilities, ['--class', 'sol', '--exclude', 'gpt-6.1-sol']);
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output).model).toBe('gpt-6-sol');
  held(resolve(capabilities, ['--class', 'sol', '--exclude', 'gpt-6.1-sol', '--exclude', 'gpt-6-sol']), /matching.*model/i);
  held(resolve(capabilities, ['--class', 'sol', '--exclude']), /exclude/i);
});

test('capabilities Antigravity uses only a uniquely advertised effort option', () => {
  const data = fresh();
  data.providers[3].models = [entry('gemini-example', 'effort')];
  const result = resolve(data, ['--model', 'null'], 'antigravity');
  expect(result.status).toBe(0);
  expect(JSON.parse(result.output)).toMatchObject({ providerInstanceId: 'antigravity',
    model: 'gemini-example', effortOption: { id: 'effort', value: 'high' } });
  data.providers[3].models[0].options = [];
  held(resolve(data, ['--model', 'null'], 'antigravity'), /unsupported effort/i);
  data.providers[3].models[0].options = [...entry('x').options, ...entry('x', 'effort').options];
  held(resolve(data, ['--model', 'null'], 'antigravity'), /effort/i);
});

test('capabilities rejects missing CLI values and unknown flags', () => {
  for (const args of [['--class'], ['--model'], ['--unknown', 'value'], ['--effort', ''], ['--capabilities', '']]) {
    held(resolve(capabilities, args), /expected|argument/i);
  }
});

test('capabilities holds an unconfigured model instead of silently treating it as model:null', () => {
  held(resolve(capabilities, []), /expected.*class.*model|missing.*model/i);
});
