import { accessSync, chmodSync, constants, lstatSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { readViaPlaywright } from './mcp.js';

function privatePath(path, uid, mode, directory) {
  const info = lstatSync(path);
  return info.uid === uid && (info.mode & 0o7777) === mode &&
    (directory ? info.isDirectory() : info.isFile()) && realpathSync(path) === path;
}

export async function readLiveMessage(scope, maxLength) {
  const uid = process.getuid?.();
  let command;
  let profile;
  let nodeBin;
  try {
    const host = (await Bun.file('/proc/sys/kernel/hostname').text()).trim();
    if (!uid || host !== 'iosatellite') throw new Error();
    const operator = (await Bun.file('/etc/passwd').text()).split('\n')
      .find((record) => record.startsWith('xzat:'))?.split(':');
    const account = operator?.[5];
    if (!account?.startsWith('/') || Number(operator[2]) !== uid || Bun.env.HOME !== account ||
        lstatSync(account).uid !== uid) throw new Error();
    const root = account + '/.local/share/axstack-work-chat';
    profile = root + '/profile';
    nodeBin = account + '/.local/share/mise/installs/node/latest/bin';
    const config = root + '/client/opencode.json';
    const playwright = root + '/tools/node_modules/.bin/playwright-mcp';
    const expectedCommand = [playwright, '--executable-path', '/usr/bin/chromium',
      '--user-data-dir', profile, '--sandbox', '--headless'];
    if (!privatePath(root, uid, 0o700, true) ||
        !privatePath(profile, uid, 0o700, true) || !privatePath(config, uid, 0o600, false)) throw new Error();
    // Read only the existing local command field. Never copy or expose the config.
    ({ command } = (await Bun.file(config).json()).mcp.servers.work_chat);
    if (!Array.isArray(command) || command.length !== expectedCommand.length ||
        command.some((argument, index) => argument !== expectedCommand[index])) throw new Error();
    if (realpathSync(playwright) !== root + '/tools/node_modules/@playwright/mcp/cli.js' ||
        lstatSync(realpathSync(playwright)).uid !== uid) throw new Error();
    for (const executable of [playwright, nodeBin + '/node', '/usr/bin/chromium']) {
      accessSync(executable, constants.X_OK);
    }
  } catch {
    throw new Error('The dedicated iosatellite account and profile are required.');
  }

  if (['SingletonLock', 'SingletonSocket', 'SingletonCookie'].some((name) =>
    lstatSync(profile + '/' + name, { throwIfNoEntry: false }))) {
    throw new Error('The dedicated profile is locked. Use a transcript or wait for its owner.');
  }

  const scratch = mkdtempSync('/tmp/axstack-work-chat-');
  try {
    chmodSync(scratch, 0o700);
    const policy = scratch + '/playwright.json';
    writeFileSync(policy, JSON.stringify({
      browser: {
        launchOptions: { args: ['--disable-extensions'] },
        contextOptions: { acceptDownloads: false },
      },
    }), { mode: 0o600, flag: 'wx' });
    const message = await readViaPlaywright(command, scope, maxLength, {
      cwd: scratch,
      env: {
        PATH: nodeBin + ':/usr/bin:/bin',
        HOME: scratch,
        TMPDIR: scratch,
        PLAYWRIGHT_MCP_CONFIG: policy,
        PLAYWRIGHT_MCP_OUTPUT_DIR: scratch,
        PLAYWRIGHT_MCP_SNAPSHOT_MODE: 'none',
        PLAYWRIGHT_MCP_IMAGE_RESPONSES: 'omit',
        PLAYWRIGHT_MCP_CODEGEN: 'none',
        PLAYWRIGHT_MCP_WEBMCP: 'false',
        PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS: 'true',
      },
    });
    if (message) return message;
  } catch {
    // A launch or browser error can contain sensitive page, profile or environment data.
  } finally {
    if (privatePath(scratch, uid, 0o700, true)) rmSync(scratch, { recursive: true });
  }
  throw new Error('The scoped chat source could not be verified. Supply a scoped transcript.');
}
