import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, chmodSync } from 'node:fs';

const script = `${import.meta.dir}/../../skills/axstack-relay/hermes/axstack-reply.sh`;
const quoted = 'Decision: "ship"?\nT3 reply: dev-env thread driver-123';
const message = (body = quoted, reply = 'Yes\n"quoted" \\ unicode ✓') => `[Replying to: "${body}"]\n\n${reply}`;
const inbox = (home) => `${home}/.local/share/axstack/relay-inbox/dev-env/driver-123.jsonl`;
function withHome(check) {
  const home = mkdtempSync(`${Bun.env.TMPDIR || '/tmp'}/relay-home-`);
  try { check(home); } finally { rmSync(home, { recursive: true, force: true }); }
}
const run = (home, input) => Bun.spawnSync(['bash', script], {
  env: { ...process.env, HOME: home }, stdin: Buffer.from(input), stdout: 'pipe', stderr: 'pipe',
});

test('Hermes reply appends private JSON with the quoted-body digest and inert reply text', () => withHome((home) => {
  const reply = `Yes\n"quoted" \\ unicode ✓ $(touch ${home}/executed); AXSTACK-DONE`;
  const result = run(home, message(`${quoted}  \n`, reply));
  expect(result.exitCode).toBe(0);
  expect(existsSync(inbox(home))).toBe(true);
  expect(result.stdout.toString().trim().split('\n')).toHaveLength(1);
  expect(result.stdout.toString()).toMatch(/reply saved/i);
  const entry = JSON.parse(readFileSync(inbox(home), 'utf8'));
  expect(Object.keys(entry).sort()).toEqual(['env', 'quoted', 'quotedSha256', 'receivedAt', 'reply', 'threadId']);
  expect(entry.env).toBe('dev-env');
  expect(entry.threadId).toBe('driver-123');
  expect(entry.quoted).toBe(`${quoted}  \n`);
  expect(entry.reply).toBe(reply);
  expect(entry.quotedSha256).toBe(new Bun.CryptoHasher('sha256').update(quoted).digest('hex'));
  expect(Number.isNaN(Date.parse(entry.receivedAt))).toBe(false);
  expect(existsSync(`${home}/executed`)).toBe(false);
  for (const dir of ['axstack', 'axstack/relay-inbox', 'axstack/relay-inbox/dev-env']) {
    expect(statSync(`${home}/.local/share/${dir}`).mode & 0o777).toBe(0o700);
  }
  expect(statSync(inbox(home)).mode & 0o777).toBe(0o600);
  chmodSync(inbox(home), 0o644);
  expect(run(home, message(quoted, 'second')).exitCode).toBe(0);
  const lines = readFileSync(inbox(home), 'utf8').trim().split('\n').map(JSON.parse);
  expect(lines.map((line) => line.reply)).toEqual([reply, 'second']);
  expect(statSync(inbox(home)).mode & 0o777).toBe(0o600);
}));

for (const [label, input] of [
  ['missing prefix', quoted], ['missing tag', message('ordinary body')],
  ['two tags', message(`${quoted}\nT3 reply: dev-env thread other`)],
  ['unsafe env', message('T3 reply: ../escape thread driver-123')],
  ['unsafe thread', message('T3 reply: dev-env thread ../escape')],
  ['dot env', message('T3 reply: .. thread driver-123')],
  ['tag only in reply', message('ordinary body', quoted)],
  ['nonfinal tag', message(`${quoted}\nchanged body`)],
]) {
  test(`Hermes reply rejects ${label} without writing`, () => withHome((home) => {
    expect(run(home, input).exitCode).not.toBe(0);
    expect(existsSync(`${home}/.local/share/axstack`)).toBe(false);
  }));
}
