import { mkdtempSync, rmSync } from 'node:fs';

export const MERMAID_VERSION = '12.3.0';
const BUNDLE_SHA256 = '336df803d87a38b70a01e736e666c8f7601d2ce42f5e47c8fafe5d721074b9a3';
const BUNDLE = `${import.meta.dir}/../vendor/mermaid/mermaid.min.js`;
const BROWSER_SCRIPT = `${import.meta.dir}/../assets/mermaid-export.js`;
const TIMEOUT_MS = 30_000;
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

async function renderPage(chromium, scratch, browserNoSandbox) {
  const child = Bun.spawn([
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
    `--virtual-time-budget=${TIMEOUT_MS}`,
    '--dump-dom',
    Bun.pathToFileURL(`${scratch}/export.html`).href,
  ], {
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
    timeout: TIMEOUT_MS,
  });
  const [dom, stderr, status] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  if (status !== 0) {
    const diagnostic = dom.trim() ? undefined : stderr.split(/\r?\n/).find((line) => SANDBOX_STARTUP.test(line));
    const exit = child.signalCode ?? status;
    if (diagnostic) {
      const action = browserNoSandbox
        ? 'Use a Chromium installation that can start with --browser-no-sandbox on this host.'
        : 'Restore Chromium sandbox support or explicitly pass --browser-no-sandbox for trusted local diagrams.';
      throw new RendererUnavailable(`Chromium sandbox startup failed (${exit}). ${action} ${diagnostic.trim().slice(0, 500)}`);
    }
    throw new Error(`Chromium export failed (${exit}): ${stderr.trim().slice(-1600)}`);
  }
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
