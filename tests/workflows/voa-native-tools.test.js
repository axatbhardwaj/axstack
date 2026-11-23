import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const skill = readFileSync('skills/voa/SKILL.md', 'utf8').replace(/\s+/g, ' ');

test('normal VOA collection loads the native inventory recipe', () => {
  const collect = skill.split('## Collect')[1].split('## Join')[0];
  expect(loadedReferences(collect)).toContain('references/native-inventory.exec.js');
});

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

test('VOA admits chat only as explicit scoped, read-only context', () => {
  const concepts = [/explicit/i, /user/i, /scoped?|bounded/i, /Slack/i, /Teams/i,
    /axstack-work-chat/, /read-only/i, /context|source/i];
  checkRule(skill, (s) => requires(s, ...concepts) && /\bonly\b/i.test(s),
    'Use axstack-work-chat as a read-only context source only when the user explicitly asks for scoped Slack or Teams evidence.',
    [[/only/i, 'even'], [/explicit\w*/i, 'implicitly'], [/read-only/i, 'read-write']], concepts);
});

test('VOA keeps chat out of routine sweeps and keeps status and follow-ups local', () => {
  const sweep = [/routine|default/i, /schedul\w*/i, /sweeps?/i];
  checkRule(skill, (s) => prohibits(s, /chat-free|free of chat/i, ...sweep),
    'Keep default and scheduled sweeps free of chat.', [[/chat-free|free of chat/i, 'chat-enabled']], sweep);
  const placement = [/status/i, /follow.ups?/i, /stay local|remain local/i];
  checkRule(skill, (s) => requires(s, ...placement),
    'Follow-ups and status remain local.', [[/stay local|remain local/i, 'move remotely']], placement);
});

test('VOA reports missing chat coverage without granting read, posting or recovery authority', () => {
  const coverage = [/chat/i, /report|flag/i, /unavailable|missing/i, /coverage gap/i];
  checkRule(skill, (s) => requires(s, ...coverage),
    'Report a coverage gap when scoped chat output is missing.',
    [[/report|flag/i, 'never report']], coverage);
  const limits = [/read private/i, /post messages/i, /chat/i, /recovery/i];
  checkRule(skill, (s) => prohibits(s, /never|do not/i, ...limits),
    'Do not use chat to authorize recovery, read private threads or post messages.',
    [[/never|do not/i, 'always']], limits);
});
