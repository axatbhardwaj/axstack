import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { killGroup } from '../../skills/axstack/scripts/command-capture.js';

const SANDBOX_STARTUP = /ZygoteHostImpl::Init|zygote_host_impl_linux\.cc|no usable sandbox|SUID sandbox helper|running as root without --no-sandbox/i;

async function openSession(chromium, drive, browserNoSandbox) {
  const profile = mkdtempSync('/tmp/axstack-viewer-input-');
  const stderr = `${profile}/stderr.log`;
  let child;
  let socket;
  let timer;
  try {
    child = Bun.spawn([
      chromium, '--headless', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
      ...(browserNoSandbox ? ['--no-sandbox'] : []),
      '--disable-background-networking', '--disable-component-update', '--disable-gpu',
      '--disable-crash-reporter', '--disable-breakpad', '--disable-sync', '--no-first-run',
      '--no-default-browser-check', '--host-resolver-rules=MAP * ~NOTFOUND',
      '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>',
      `--user-data-dir=${profile}`, 'about:blank',
    ], {
      detached: true, stdin: 'ignore', stdout: 'ignore', stderr: Bun.file(stderr),
      env: { PATH: process.env.PATH, HOME: profile, TMPDIR: profile, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: profile },
    });
    const startup = performance.now() + 15_000;
    let port;
    do {
      const log = readFileSync(stderr, 'utf8');
      port = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)?.[1];
      if (port) break;
      if (child.exitCode !== null || child.signalCode !== null || performance.now() >= startup) {
        throw new Error(`Chromium did not open the test connection: ${log}`);
      }
      await Bun.sleep(25);
    } while (!port);
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5_000) });
    const targets = await response.json();
    const page = targets.find(({ type }) => type === 'page');
    socket = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/${page.id}`);
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Chromium viewer input check timed out')), 20_000);
    });
    const interact = async () => {
      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', () => reject(new Error('Could not open Chromium DevTools')), { once: true });
      });
      let nextId = 0;
      const send = (method, params) => new Promise((resolve, reject) => {
        const id = ++nextId;
        const reply = ({ data }) => {
          const message = JSON.parse(data);
          if (message.id !== id) return;
          socket.removeEventListener('message', reply);
          if (message.error) reject(new Error(`${method}: ${message.error.message}`));
          else resolve(message.result);
        };
        socket.addEventListener('message', reply);
        socket.send(JSON.stringify({ id, method, params }));
      });
      return await drive(send);
    };
    return await Promise.race([interact(), deadline]);
  } finally {
    clearTimeout(timer);
    socket?.close();
    if (child) {
      killGroup(child);
      await child.exited;
    }
    rmSync(profile, { recursive: true, force: true });
  }
}

export async function driveChromiumInput(chromium, drive) {
  try {
    return await openSession(chromium, drive, false);
  } catch (error) {
    if (!error.message.startsWith('Chromium did not open the test connection:') || !SANDBOX_STARTUP.test(error.message)) throw error;
    console.warn('Chromium sandbox startup held. Retrying the input check with explicit --browser-no-sandbox.');
    return await openSession(chromium, drive, true);
  }
}
