import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';
const root = `${import.meta.dir}/../../skills/axstack`;

test('opt-in service runs the bounded apply command every five minutes', () => {
  const service = readFileSync(`${root}/systemd/axstack-default-sync.service`, 'utf8');
  expect(service).toMatch(/^Type=oneshot$/m);
  expect(service).toMatch(/^UMask=0077$/m);
  expect(service).toMatch(/^TimeoutStartSec=180$/m);
  expect(service).toMatch(/^ExecStart=\/usr\/bin\/env bun %h\/\.agents\/skills\/axstack\/scripts\/sync-default\.js --apply$/m);
  const timer = readFileSync(`${root}/systemd/axstack-default-sync.timer`, 'utf8');
  for (const line of ['OnStartupSec=5min', 'OnUnitActiveSec=5min', 'Unit=axstack-default-sync.service', 'WantedBy=timers.target']) {
    expect(timer.split('\n')).toContain(line);
  }
});

test('title instruction asks for Driver prefix and retains explicit role keys on regeneration', () => {
  const title = readFileSync(`${root}/references/thread-title-instructions.txt`, 'utf8').replace(/\s+/g, ' ');
  for (const [concepts, rewording, inversions] of [
    [[/new ordinary manual chat/i, /use/i, /Driver:/],
      'For a new ordinary manual chat use Driver: followed by an outcome.', [[/Driver:/, 'Topic:']]],
    [[/regeneration/i, /preserve/i, /dispatch\/tracking key/i, /byte.for.byte/i],
      'On regeneration preserve every dispatch/tracking key byte-for-byte.', [[/preserve/i, 'discard']]],
    [[/preserve/i, /Needs you:/, /unchanged/i],
      'Preserve Needs you: notices unchanged.', [[/unchanged/i, 'after rewriting']]],
  ]) checkRule(title, (text) => requires(text, ...concepts), rewording, inversions, concepts);
});
