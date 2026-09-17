// Harness skill locations: explicit table, verified vs unverified discovery,
// Grok requires an explicit destination override.
import { expect, test } from 'bun:test';
import { harnessLocations } from '../../src/locations.js';

test('location table covers primary harnesses with discovery status', () => {
  const table = harnessLocations();
  const names = table.map((h) => h.harness).sort();
  for (const expected of ['antigravity', 'claude', 'codex', 'grok', 'opencode']) {
    expect(names.includes(expected)).toBe(true);
  }
  for (const entry of table) {
    expect(Boolean(entry.skillsDir)).toBe(true);
    expect(['docs', 'cli-help', 'unverified'].includes(entry.discovery)).toBe(true);
    expect(typeof entry.notes === 'string' && entry.notes.length > 0).toBe(true);
  }
});

test('grok has no verified auto-discovery and requires explicit override', () => {
  const table = harnessLocations();
  const grok = table.find((h) => h.harness === 'grok');
  expect(grok.discovery).toBe('unverified');
  expect(grok.notes.toLowerCase()).toMatch(/explicit|--skills-dir|override/);
});

test('every verified entry cites its primary-source docs URL', () => {
  const table = harnessLocations();
  for (const entry of table) {
    if (entry.discovery === 'unverified') continue;
    expect(typeof entry.source === 'string' && entry.source.startsWith('https://')).toBe(true);
  }
});

test('no entry claims end-to-end compatibility from install alone', () => {
  const table = harnessLocations();
  for (const entry of table) {
    expect(
      /end-to-end|fully supported|verified working/i.test(entry.notes),
    ).toBe(false);
  }
});
