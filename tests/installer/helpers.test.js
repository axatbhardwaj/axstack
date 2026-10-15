import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { makeTempRoot, runCli } from './helpers.js';

test('CLI fixtures isolate ambient config homes while allowing explicit overrides', () => {
  const root = makeTempRoot('axstack-cli-env-');
  const probe = join(root, 'env.js');
  writeFileSync(probe, `console.log(JSON.stringify({
    claude: Bun.env.CLAUDE_CONFIG_DIR ?? null,
    codex: Bun.env.CODEX_HOME ?? null,
    home: Bun.env.HOME,
    sentinel: Bun.env.AXSTACK_FIXTURE_SENTINEL,
  }));`);
  const previous = {
    CLAUDE_CONFIG_DIR: Bun.env.CLAUDE_CONFIG_DIR,
    CODEX_HOME: Bun.env.CODEX_HOME,
    AXSTACK_FIXTURE_SENTINEL: Bun.env.AXSTACK_FIXTURE_SENTINEL,
  };
  try {
    Bun.env.CLAUDE_CONFIG_DIR = join(root, 'ambient-claude');
    Bun.env.CODEX_HOME = join(root, 'ambient-codex');
    Bun.env.AXSTACK_FIXTURE_SENTINEL = 'inherited';
    const options = { env: { HOME: root } };
    expect(JSON.parse(runCli(probe, [], options).out)).toEqual({
      claude: null, codex: null, home: root, sentinel: 'inherited',
    });

    const env = {
      HOME: root,
      CLAUDE_CONFIG_DIR: join(root, 'explicit-claude'),
      CODEX_HOME: join(root, 'explicit-codex'),
    };
    expect(JSON.parse(runCli(probe, [], { env }).out)).toEqual({
      claude: env.CLAUDE_CONFIG_DIR, codex: env.CODEX_HOME,
      home: root, sentinel: 'inherited',
    });
    expect(JSON.parse(runCli(probe, [], {
      env, unset: ['CLAUDE_CONFIG_DIR', 'CODEX_HOME'],
    }).out)).toEqual({
      claude: null, codex: null, home: root, sentinel: 'inherited',
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete Bun.env[key];
      else Bun.env[key] = value;
    }
  }
});
