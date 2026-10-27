import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import { commit } from '../../skills/axstack/scripts/default-settings.js';
import { fixture, selection } from './default-routing-fixtures.js';

function withFile(run) {
  const dir = fs.mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/settings-`);
  try {
    const path = `${dir}/settings.json`;
    const before = JSON.stringify(fixture().settings);
    fs.writeFileSync(path, before, { mode: 0o640 });
    return run(path, before);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const next = selection('code', 'gpt-6-astra', 'medium');
test('atomic commit changes only default and preserves file mode', () => withFile((path, before) => {
  expect(commit(path, before, next)).toBe('updated');
  const after = JSON.parse(fs.readFileSync(path, 'utf8'));
  expect(after.defaultModelSelection).toEqual(next);
  after.defaultModelSelection = JSON.parse(before).defaultModelSelection;
  expect(after).toEqual(JSON.parse(before));
  expect(fs.statSync(path).mode & 0o777).toBe(0o640);
  expect(fs.readdirSync(path.slice(0, path.lastIndexOf('/')))).toEqual(['settings.json']);
}));

test('concurrent edits and existing lock preserve settings', () => withFile((path, before) => {
  fs.writeFileSync(path, `${before}\n`);
  expect(commit(path, before, next)).toBe('concurrent-edit');
  expect(fs.readFileSync(path, 'utf8')).toBe(`${before}\n`);
  fs.mkdirSync(`${path}.axstack-default-sync.lock`);
  expect(commit(path, before, next)).toBe('locked');
}));

test('symlink settings are explicitly rejected and target stays unchanged', () => withFile((path, before) => {
  fs.symlinkSync(path, `${path}.link`);
  expect(() => commit(`${path}.link`, before, next)).toThrow('regular file');
  expect(fs.readFileSync(path, 'utf8')).toBe(before);
}));
