// Harness skill locations: explicit table, verified vs unverified discovery,
// Grok requires an explicit destination override.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harnessLocations } from '../../src/locations.js';

test('location table covers primary harnesses with discovery status', () => {
  const table = harnessLocations();
  const names = table.map((h) => h.harness).sort();
  for (const expected of ['claude', 'codex', 'grok', 'opencode']) {
    assert.ok(names.includes(expected), `missing harness ${expected}`);
  }
  for (const entry of table) {
    assert.ok(entry.skillsDir, 'entry needs a skillsDir');
    assert.ok(['docs', 'cli-help', 'unverified'].includes(entry.discovery));
    assert.ok(typeof entry.notes === 'string' && entry.notes.length > 0);
  }
});

test('grok has no verified auto-discovery and requires explicit override', () => {
  const table = harnessLocations();
  const grok = table.find((h) => h.harness === 'grok');
  assert.equal(grok.discovery, 'unverified');
  assert.match(grok.notes.toLowerCase(), /explicit|--skills-dir|override/);
});

test('no entry claims end-to-end compatibility from install alone', () => {
  const table = harnessLocations();
  for (const entry of table) {
    assert.ok(
      !/end-to-end|fully supported|verified working/i.test(entry.notes),
      `${entry.harness} overclaims compatibility`,
    );
  }
});
