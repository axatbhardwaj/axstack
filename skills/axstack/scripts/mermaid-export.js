import { mkdtempSync, rmSync } from 'node:fs';
import { killGroup } from './command-capture.js';

export const MERMAID_VERSION = '12.3.0';
const BUNDLE_SHA256 = '336df803d87a38b70a01e736e666c8f7601d2ce42f5e47c8fafe5d721074b9a3';
const BUNDLE = `${import.meta.dir}/../vendor/mermaid/mermaid.min.js`;
const BROWSER_SCRIPT = `${import.meta.dir}/../assets/mermaid-export.js`;
const VIRTUAL_TIME_BUDGET_MS = 30_000;
// Allow cold startup, real rendering work and shutdown outside the page's virtual clock.
const WALL_TIMEOUT_MS = 60_000;
const TERMINATION_GRACE_MS = 200;
const SANDBOX_STARTUP = /\b(?:ZygoteHostImpl::Init|zygote_host_impl_linux\.cc|no usable sandbox|(?:setuid|SUID) sandbox helper|running as root without --no-sandbox)\b/i;
const PAGE = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'">
<body>
<pre id="result">pending</pre>
<script src="mermaid.min.js"></script>
<script src="views.js"></script>
<script src="export.js"></script>
`;

export class RendererUnavailable extends Error {}

async function verifiedBundle() {
  try {
    const bytes = await Bun.file(BUNDLE).bytes();
    const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
    if (hash !== BUNDLE_SHA256) throw new Error(`hash mismatch for ${BUNDLE}`);
    return bytes;
  } catch (error) {
    const reason = error.code === 'ENOENT' ? `missing: ${BUNDLE}` : error.message;
    throw new RendererUnavailable(`Mermaid ${MERMAID_VERSION} browser bundle: ${reason}`);
  }
}

export function findChromium(override = '') {
  if (override) return Bun.which(override);
  const system = Bun.which('chromium') ?? Bun.which('google-chrome');
  if (system || !process.env.HOME) return system;
  const t3 = `${process.env.HOME}/.t3/tools/chrome-headless-shell`;
  const shell = Bun.which(t3);
  if (shell) return shell;
  try {
    const versions = [...new Bun.Glob('*/*/chrome-headless-shell').scanSync({ cwd: t3, absolute: true })];
    return versions.sort((left, right) => right.localeCompare(left, 'en', { numeric: true }))
      .find((path) => Bun.which(path));
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
  }
}

function usefulDiagnostics(stderr) {
  const lines = stderr.trim().split(/\r?\n/);
  return lines.filter((line, index) => index === 0 || index === lines.length - 1
    || /\b(?:FATAL|ERROR)\b/i.test(line) || SANDBOX_STARTUP.test(line)).join('\n');
}

function withDiagnostics(message, stderr) {
  const diagnostic = usefulDiagnostics(stderr);
  return diagnostic ? `${message}\n${diagnostic}` : message;
}

function startupError(exit, stderr, browserNoSandbox) {
  if (SANDBOX_STARTUP.test(stderr)) {
    const action = browserNoSandbox
      ? 'Check the Chromium installation and its support for --browser-no-sandbox.'
      : 'Check Chromium and its sandbox setup. For trusted local diagrams, explicitly pass --browser-no-sandbox.';
    return new RendererUnavailable(withDiagnostics(`Chromium sandbox startup failed (${exit}). ${action}`, stderr));
  }
  const action = exit === 127
    ? 'Check the Chromium installation and its shared libraries.'
    : 'Check the selected Chromium installation and the diagnostics below.';
  return new RendererUnavailable(withDiagnostics(`Chromium exited without returning the export page (${exit}). ${action}`, stderr));
}

/** @param {Bun.Subprocess<'ignore', 'pipe', 'pipe'>} child */
async function capturePage(child) {
  const readers = [child.stdout.getReader(), child.stderr.getReader()];
  const output = ['', ''];
  let timer;
  let running = true;
  let terminating = false;
  const drained = readers.map(async (reader, index) => {
    const decoder = new TextDecoder();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      output[index] += decoder.decode(chunk.value, { stream: true });
    }
    output[index] += decoder.decode();
  });
  const exited = child.exited.then((status) => {
    running = false;
    if (!terminating) killGroup(child);
    return status;
  });
  try {
    /** @type {Promise<null>} */
    const deadline = new Promise((resolve) => {
      // Reserve time for graceful process-group termination.
      timer = setTimeout(() => resolve(null), WALL_TIMEOUT_MS - TERMINATION_GRACE_MS);
    });
    const finished = await Promise.race([Promise.all([exited, ...drained]), deadline]);
    if (!finished && running) {
      terminating = true;
      killGroup(child, 'SIGTERM');
      await Bun.sleep(TERMINATION_GRACE_MS);
    }
    return { dom: output[0], stderr: output[1], status: finished?.[0], timingOut: !finished };
  } finally {
    clearTimeout(timer);
    // A writer outside the process group may still hold a pipe open.
    for (const reader of readers) reader.cancel().then(() => reader.releaseLock()).catch(() => {});
    if (running || terminating) killGroup(child);
  }
}

async function renderPage(chromium, scratch, browserNoSandbox) {
  const argv = [
    chromium,
    '--headless',
    ...(browserNoSandbox ? ['--no-sandbox'] : []),
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--disable-gpu',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--host-resolver-rules=MAP * ~NOTFOUND',
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=<-loopback>',
    `--user-data-dir=${scratch}/profile`,
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
    '--dump-dom',
    Bun.pathToFileURL(`${scratch}/export.html`).href,
  ];
  let child;
  try {
    child = Bun.spawn(argv, {
      env: {
        PATH: process.env.PATH,
        HOME: scratch,
        TMPDIR: scratch,
        XDG_CONFIG_HOME: scratch,
        XDG_CACHE_HOME: scratch,
        LANG: process.env.LANG,
      },
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      detached: true,
    });
  } catch (error) {
    const message = 'Could not launch Chromium. Check that the executable and its interpreter exist and can run, or select a working installation with --browser <path>.';
    throw new RendererUnavailable(withDiagnostics(message, error.message));
  }
  const { dom, stderr, status, timingOut } = await capturePage(child);
  const hasPageOutput = Boolean(dom.trim());
  if (timingOut) {
    const message = withDiagnostics(`Chromium did not finish (startup or render) within ${WALL_TIMEOUT_MS / 1_000}s.`, stderr);
    throw hasPageOutput ? new Error(message) : new RendererUnavailable(message);
  }
  const exit = child.signalCode ?? status;
  if (!hasPageOutput) throw startupError(exit, stderr, browserNoSandbox);
  if (status !== 0) throw new Error(`Chromium export failed (${exit}): ${usefulDiagnostics(stderr)}`);
  const result = dom.match(/<pre id="result" data-status="(ok|error)">([^<]+)<\/pre>/);
  if (!result) throw new Error('Chromium did not report completion of the Mermaid export');
  const data = JSON.parse(decodeURIComponent(result[2]));
  if (result[1] === 'error') throw new Error(data);
  return data;
}

export async function exportBrowserSvgs(views, { browser, browserNoSandbox, width }) {
  const bundle = await verifiedBundle();
  const chromium = findChromium(browser);
  if (!chromium) {
    throw new RendererUnavailable(`Chromium unavailable for Mermaid SVG export (${browser || 'chromium, google-chrome or T3 headless shell'})`);
  }
  // Chromium's SingletonSocket must fit in a Unix socket address, even when
  // the caller's TMPDIR is nested inside a long worktree path.
  const scratch = mkdtempSync('/tmp/axstack-mermaid-');
  try {
    const jobs = views.map(({ id, source, dense, elk, accentStrokes }) => ({
      id, source, dense, layout: elk ? 'elk' : 'dagre', accents: [...accentStrokes.keys()],
    }));
    await Promise.all([
      Bun.write(`${scratch}/export.html`, PAGE),
      Bun.write(`${scratch}/export.js`, Bun.file(BROWSER_SCRIPT)),
      Bun.write(`${scratch}/views.js`, `globalThis.mermaidExport = ${JSON.stringify({ jobs, width })};\n`),
      Bun.write(`${scratch}/mermaid.min.js`, bundle),
    ]);
    const renders = await renderPage(chromium, scratch, browserNoSandbox);
    if (!Array.isArray(renders) || renders.length !== views.length
        || renders.some((render, index) => render.id !== views[index].id || typeof render.svg !== 'string'
          || !(render.minLabelPx === null || Number.isFinite(render.minLabelPx)))) {
      throw new Error('Chromium returned incomplete Mermaid SVG results');
    }
    return new Map(renders.map((render) => [render.id, render]));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
