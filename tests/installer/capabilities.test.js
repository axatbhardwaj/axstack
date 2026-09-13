// Capability checks use injected command execution; report gh stack and
// Paseo gaps and state the probe limits (no Linear MCP / quota proof).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkCapabilities } from '../../src/capabilities.js';

const CLI = fileURLToPath(new URL('../../bin/axstack.js', import.meta.url));

function fakeExec(overrides = {}) {
  const base = {
    node: { ok: true, stdout: 'v22.0.0' },
    git: { ok: true, stdout: 'git version 2.40.0' },
    gh: { ok: true, stdout: 'gh version 2.0.0' },
    'gh-stack': { ok: true, stdout: 'gh-stack available' },
    paseo: { ok: true, stdout: 'paseo 1.0.0' },
  };
  return async (name) => ({ ...base[name], ...overrides[name] } ?? { ok: false, stdout: '' });
}

test('all tools present reports ok with probe-limit disclaimer', async () => {
  const report = await checkCapabilities(fakeExec());
  assert.ok(report.checks.length >= 4);
  assert.deepEqual(report.gaps, []);
  assert.match(report.limitations.join(' '), /Linear/i);
  assert.match(report.limitations.join(' '), /quota|model/i);
});

test('missing gh stack extension is reported as a gap', async () => {
  const report = await checkCapabilities(fakeExec({ 'gh-stack': { ok: false, stdout: '' } }));
  assert.ok(report.gaps.some((g) => /stack/i.test(g)));
  assert.equal(report.checks.find((c) => c.name === 'gh-stack').ok, false);
});

test('missing paseo binary is reported as a gap', async () => {
  const report = await checkCapabilities(fakeExec({ paseo: { ok: false, stdout: 'not found' } }));
  assert.ok(report.gaps.some((g) => /paseo/i.test(g)));
});

test('CLI check subcommand reports gaps and exits non-zero when tools miss', () => {
  let failed = false;
  try {
    execFileSync(process.execPath, [CLI, 'check'], { encoding: 'utf8', env: { ...process.env, PATH: '' } });
  } catch (err) {
    failed = true;
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    assert.match(out.toLowerCase(), /gap|missing|not found/);
  }
  assert.ok(failed, 'expected check to fail with an empty PATH');
});
