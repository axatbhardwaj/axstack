import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const SOURCE = `${root}/docs/plans/axstack-decide.sh`;
const SKILL = `${root}/docs/plans/hermes-axstack-decide-SKILL.md`;
const USER_ID = '7312456789';
const TOKEN = '0123456789abcdef01234567';

let sandbox;

const writeConfig = ({ allowed = USER_ID, chatId = USER_ID, userId = USER_ID } = {}) => {
  writeFileSync(`${sandbox}/config.yaml`, [
    'platforms:',
    '  telegram:',
    '    home_channel:',
    `      chat_id: "${chatId}"`,
    `      user_id: "${userId}"`,
    '',
  ].join('\n'));
  writeFileSync(`${sandbox}/hermes.env`, `TELEGRAM_ALLOWED_USERS='${allowed}'\n`);
};

const writeDecision = (token = TOKEN, overrides = {}) => {
  const decision = {
    repo: 'defi-com/monorepo',
    pr: 1092,
    head: 'abc123',
    base: 'def456',
    action: 'approve-verdict',
    body: 'review body',
    commit: 'abc123',
    state: 'open',
    created_at: '2026-09-17T01:02:03Z',
    send: { message_id: '42', state: 'sent' },
    ...overrides,
  };
  const path = `${sandbox}/run/decisions/${token}.json`;
  writeFileSync(path, JSON.stringify(decision));
  return { decision, path };
};

const setup = () => {
  sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-decide-`);
  mkdirSync(`${sandbox}/run/decisions`, { recursive: true });
  writeConfig();
  const script = `${sandbox}/axstack-decide`;
  writeFileSync(script, readFileSync(SOURCE, 'utf8'));
  chmodSync(script, 0o755);
  return { script };
};

const environment = (overrides = {}) => {
  const {
    HERMES_SESSION_USER_ID: _sessionUser,
    HERMES_SESSION_CHAT_ID: _sessionChat,
    HERMES_SESSION_MESSAGE_ID: _sessionMessage,
    ...baseEnv
  } = process.env;
  return {
    ...baseEnv,
    AXSTACK_RUN_DIR: `${sandbox}/run`,
    AXSTACK_HERMES_CONFIG: `${sandbox}/config.yaml`,
    AXSTACK_HERMES_ENV: `${sandbox}/hermes.env`,
    AXSTACK_DECISION_USER_ID: USER_ID,
    ...overrides,
  };
};

const run = (script, args, overrides = {}) => {
  const result = Bun.spawnSync([script, ...args], {
    env: environment(overrides),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

beforeEach(() => {
  sandbox = null;
});

afterEach(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
});

test('invalid arguments exit 2 before any file I/O', () => {
  const { script } = setup();
  const absent = `${sandbox}/must-not-be-created`;
  const env = {
    AXSTACK_RUN_DIR: absent,
    AXSTACK_HERMES_CONFIG: `${absent}/config.yaml`,
    AXSTACK_HERMES_ENV: `${absent}/.env`,
  };

  for (const args of [[], [TOKEN], ['not-a-token', 'approve'], [TOKEN, 'maybe']]) {
    const result = run(script, args, env);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  }
  expect(existsSync(absent)).toBe(false);
});

test('gateway identity configuration failures exit 4 and config is reread on every call', () => {
  const { script } = setup();
  expect(run(script, [TOKEN, 'approve']).exitCode).toBe(3);

  for (const invalid of [
    { allowed: `${USER_ID},2` },
    { chatId: '2' },
    { userId: '2' },
  ]) {
    writeConfig(invalid);
    const result = run(script, [TOKEN, 'approve']);
    expect(result.exitCode).toBe(4);
    expect(result.stdout).toBe('');
  }
});

test('exported Hermes sender and chat ids must match the configured user', () => {
  const { script } = setup();
  expect(run(script, [TOKEN, 'approve'], { HERMES_SESSION_USER_ID: USER_ID }).exitCode).toBe(3);
  expect(run(script, [TOKEN, 'approve'], { HERMES_SESSION_CHAT_ID: USER_ID }).exitCode).toBe(3);
  expect(run(script, [TOKEN, 'approve'], { HERMES_SESSION_USER_ID: '2' }).exitCode).toBe(4);
  expect(run(script, [TOKEN, 'approve'], { HERMES_SESSION_CHAT_ID: '2' }).exitCode).toBe(4);
});

test('unknown, malformed, and non-open decisions exit 3 without output', () => {
  const { script } = setup();
  expect(run(script, [TOKEN, 'approve'])).toMatchObject({ exitCode: 3, stdout: '' });

  const { path } = writeDecision();
  writeFileSync(path, '{bad json');
  expect(run(script, [TOKEN, 'approve'])).toMatchObject({ exitCode: 3, stdout: '' });

  for (const state of ['approved', 'rejected', 'spent', 'stale', 'closed']) {
    writeDecision(TOKEN, { state });
    expect(run(script, [TOKEN, 'approve'])).toMatchObject({ exitCode: 3, stdout: '' });
  }
});

test('approve atomically changes only decision fields and prints one line', () => {
  const { script } = setup();
  const { decision, path } = writeDecision();
  const originalInode = statSync(path).ino;
  const result = run(script, [TOKEN, 'approve'], { HERMES_SESSION_MESSAGE_ID: '987654' });

  expect(result).toEqual({
    exitCode: 0,
    stdout: `decided ${TOKEN} approved\n`,
    stderr: '',
  });
  const updated = JSON.parse(readFileSync(path, 'utf8'));
  expect(updated).toMatchObject({
    state: 'approved',
    decided_message_id: '987654',
  });
  expect(updated.decided_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  for (const field of ['repo', 'pr', 'head', 'base', 'action', 'body', 'commit', 'created_at', 'send']) {
    expect(updated[field]).toEqual(decision[field]);
  }
  expect(statSync(path).ino).not.toBe(originalInode);
  expect(readdirSync(`${sandbox}/run/decisions`).sort()).toEqual([
    `${TOKEN}.json`,
    `${TOKEN}.json.lock`,
  ]);
  expect(run(script, [TOKEN, 'approve'])).toMatchObject({ exitCode: 3, stdout: '' });
});

test('reject writes rejected without inventing a message id', () => {
  const { script } = setup();
  const { path } = writeDecision();
  const result = run(script, [TOKEN, 'reject']);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe(`decided ${TOKEN} rejected\n`);
  const updated = JSON.parse(readFileSync(path, 'utf8'));
  expect(updated.state).toBe('rejected');
  expect(updated).not.toHaveProperty('decided_message_id');
});

test('an exported empty message id is treated as absent', () => {
  const { script } = setup();
  const { path } = writeDecision();
  const result = run(script, [TOKEN, 'approve'], { HERMES_SESSION_MESSAGE_ID: '' });

  expect(result.exitCode).toBe(0);
  const updated = JSON.parse(readFileSync(path, 'utf8'));
  expect(updated.state).toBe('approved');
  expect(updated).not.toHaveProperty('decided_message_id');
});

test('the decision is re-read after acquiring its per-token lock', async () => {
  const { script } = setup();
  const { path } = writeDecision();
  const ready = `${sandbox}/lock-ready`;
  const release = `${sandbox}/lock-release`;
  const holder = Bun.spawn([
    'bash',
    '-c',
    'exec 9>"$1"; flock -x 9; : >"$2"; while [[ ! -e "$3" ]]; do sleep 0.01; done',
    '_',
    `${path}.lock`,
    ready,
    release,
  ], { stdout: 'ignore', stderr: 'pipe' });

  for (let attempt = 0; attempt < 100 && !existsSync(ready); attempt += 1) {
    await Bun.sleep(10);
  }
  expect(existsSync(ready)).toBe(true);

  const deciding = Bun.spawn([script, TOKEN, 'approve'], {
    env: environment(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const early = await Promise.race([
    deciding.exited.then(() => true),
    Bun.sleep(100).then(() => false),
  ]);
  expect(early).toBe(false);

  writeDecision(TOKEN, { state: 'rejected' });
  writeFileSync(release, 'release');
  await holder.exited;
  const exitCode = await deciding.exited;
  const stdout = await new Response(deciding.stdout).text();

  expect(exitCode).toBe(3);
  expect(stdout).toBe('');
  expect(JSON.parse(readFileSync(path, 'utf8')).state).toBe('rejected');
});

test('the Hermes skill contains only the fixed decision relay instruction', () => {
  expect(readFileSync(SKILL, 'utf8')).toBe([
    '---',
    'name: axstack-decide',
    'description: Relay exact Telegram decision replies through the fixed decision script.',
    '---',
    '',
    'when a message is exactly `approve <token>` or `reject <token>`, run `~/.hermes/scripts/axstack-decide <token> <verb>` and relay its one-line result; do nothing else and never run `gh`, `git` or `orca`.',
    '',
  ].join('\n'));
});
