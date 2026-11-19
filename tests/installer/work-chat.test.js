import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { BUN_BIN, makeTempRoot, runCli } from './helpers.js';

const repo = join(import.meta.dir, '../..');
const cli = join(repo, 'bin/axstack.js');
const reader = join(repo, 'skills/axstack-work-chat/scripts/read.js');

for (const [harness, discovery] of [['claude', '.claude/skills'], ['codex', '.agents/skills']]) {
  test(`${harness} installs a separately invocable reader that bounds transcript output`, () => {
    const home = makeTempRoot(`axstack-work-chat-${harness}-`);
    const transcript = join(home, 'authorized.jsonl');
    const rows = [
      ['2026-11-19T12:59:59Z', 'before window'],
      ['2026-11-19T13:00:00Z', 'synthetic accepted decision'],
      ['2026-11-19T14:00:00Z', 'at excluded end'],
    ];
    writeFileSync(transcript, rows.map(([timestamp, text]) => JSON.stringify({ timestamp, text })).join('\n'));
    runCli(cli, ['install', '--preset', 'mixed', '--bundle', repo, '--harness', harness,
      '--no-claude-settings', '--yes'], { env: { HOME: home } });

    const installed = join(home, discovery, 'axstack-work-chat');
    expect(Bun.file(join(installed, 'SKILL.md')).size).toBeGreaterThan(0);
    const result = runCli(join(installed, 'scripts/read.js'), [
      'transcript', transcript, '2026-11-19T18:30:00+05:30', '2026-11-19T19:30:00+05:30',
    ], { env: { HOME: home } });
    expect(JSON.parse(result.out)).toEqual({
      source: 'authorized.jsonl',
      from: '2026-11-19T13:00:00.000Z',
      until: '2026-11-19T14:00:00.000Z',
      messages: [{ timestamp: '2026-11-19T13:00:00.000Z', text: 'synthetic accepted decision' }],
    });
  }, 60_000);
}

test('reader rejects out-of-scope URLs and unavailable dedicated setup without using fallback', () => {
  const home = makeTempRoot('axstack-work-chat-no-fallback-');
  mkdirSync(join(home, '.config'));
  for (const url of [
    'https://example.com/archives/C12345678/p1795093200000000',
    'https://work.slack.com/archives/C12345678',
    'https://work.slack.com/archives/C12345678/p1795093200000000?redirect=elsewhere',
    'https://teams.microsoft.com/l/message/19%3Atest%40thread.v2/1795093200000',
  ]) {
    const result = runCli(reader, ['message', url], { expectFail: true, env: { HOME: home } });
    expect(result.out.trim()).toBe('Supply one supported Slack or Teams message permalink.');
  }
  const result = Bun.spawnSync([BUN_BIN, reader, 'message',
    'https://work.slack.com/archives/C12345678/p1795093200000000'], {
    env: { HOME: home, PATH: '/usr/bin:/bin', PLAYWRIGHT_MCP_NO_SANDBOX: '1' },
    stdout: 'pipe', stderr: 'pipe',
  });
  expect(result.exitCode).toBe(2);
  expect(result.stdout.toString()).toBe('');
  expect(result.stderr.toString().trim()).toBe('The dedicated iosatellite account and profile are required.');
});
