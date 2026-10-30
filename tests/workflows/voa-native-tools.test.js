import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';

const skill = readFileSync('skills/voa/SKILL.md', 'utf8').replace(/\s+/g, ' ');

test('VOA names callable native list APIs instead of obsolete aliases', () => {
  expect(skill).not.toMatch(/`t3_(?:queue|pending_request)_list`/);
  for (const tool of ['t3_queue', 't3_pending_request']) {
    expect(requires(skill, new RegExp(`\x60${tool}\x60`), /action[: ]+`?list`?/i)).toBe(true);
  }
});

test('VOA follows queue pagination rather than treating the first page as complete', () => {
  checkRule(skill,
    (text) => requires(text, /follow/i, /queue/i, /`cursor`/, /pagination/i),
    'Follow queue pagination using the returned `cursor` within the work bound.',
    [[/Follow/i, 'Never follow']]);
});

test('VOA obtains approval state from native thread/run observations', () => {
  checkRule(skill,
    (text) => requires(text, /read/i, /approval/i, /thread\/run state/i),
    'Read approvals from native thread/run state.',
    [[/Read/i, 'Never read']]);
});
