import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { chromiumWallTimeout, dumpChromiumPage, findChromium } from '../../skills/axstack/scripts/mermaid-export.js';
import { mermaidFigure } from '../../skills/axstack/scripts/mermaid-figure.js';
import { driveChromiumInput } from './diagram-viewer-browser.js';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const assets = `${root}/skills/axstack-explain/assets`;
const scratch = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/axstack-viewer-test-`);
afterAll(() => rmSync(scratch, { recursive: true }));

const sequence = `---
config:
  sequence:
    actorMargin: 80
    messageMargin: 48
---
sequenceDiagram
  accTitle: Routing
  accDescr: A request passes through a queue.
`;
const fence = (source) => `\`\`\`mermaid\n${source}\n\`\`\`\n`;
const digest = (source) => new Bun.CryptoHasher('sha256').update(source).digest('hex').slice(0, 12);
const cli = (...args) => Bun.spawnSync([process.execPath, '--no-env-file', `${root}/skills/axstack/scripts/mermaid-check.js`, ...args], {
  timeout: 32_000, killSignal: 'SIGKILL',
});

test('figure export selects by edge count and width and embeds the exact raw SVG', async () => {
  const repeated = (count) => Array.from({ length: count }, () => '  A->>B: Stage').join('\n');
  const wide = Array.from({ length: 5 }, (_, index) => `  P${index}->>P${index + 1}: Stage`).join('\n');
  const sources = [repeated(25), repeated(26), wide, '  A->>B: .*( literal label'];
  const input = sources.map((source) => fence(sequence + source)).join('');
  const sourcePath = `${scratch}/views.md`;
  await Bun.write(sourcePath, input);
  const result = cli('--figure-out', `${scratch}/figures`, '--svg-out', `${scratch}/svgs`, '--width', '600', sourcePath);
  expect(result.exitCode, result.stderr.toString()).toBe(0);

  for (const [index, source] of sources.entries()) {
    const id = `mermaid-${index + 1}-${digest(sequence + source + '\n')}`;
    const svg = await Bun.file(`${scratch}/svgs/${id}.svg`).text();
    const figure = await Bun.file(`${scratch}/figures/${id}.html`).text();
    const interactive = index === 1 || index === 2;
    expect(figure).toContain(svg);
    expect(figure).toMatch(/^<figure\b/);
    expect(figure.includes('data-diagram-viewer')).toBe(interactive);
    expect(figure).not.toMatch(/<form\b/i);
    if (interactive) {
      expect(figure).toMatch(/<input[^>]*type="checkbox"[^>]*>\s*<label[^>]*>Fit<\/label>/);
      expect(figure).toMatch(/class="diagram-viewer__frame"[^>]*tabindex="0"/);
      const buttons = figure.match(/<button\b[^>]*>/g) ?? [];
      expect(buttons).toHaveLength(5);
      for (const button of buttons) expect(button).toContain('type="button"');
    }
  }
});

test('the authored viewer assets contain no network, storage or dynamic code APIs', async () => {
  const [script, css] = await Promise.all(['js', 'css'].map((extension) =>
    Bun.file(`${assets}/diagram-viewer.${extension}`).text()));
  expect(script + css).not.toMatch(/\b(?:fetch|XMLHttpRequest|XHR|WebSocket|EventSource|sendBeacon|eval|innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|cookie)\b|\b(?:import|Function)\s*\(|@import|https?:\/\/|\burl\s*\(/i);
});

const browser = findChromium();
if (!browser) test.skip('Diagram viewer browser acceptance: Chromium, Chrome and T3 headless shell unavailable', () => {});

test.skipIf(!browser)('Chromium verifies viewer zoom, wheel scope, literal Find and no-script Fit', async () => {
  // A Pele-rendered diagram exercises the same wrapper as the browser exporter.
  const source = `${scratch}/interaction.mmd`;
  const text = `${sequence}${Array.from({ length: 26 }, (_, index) =>
    `  A->>B: ${index === 25 ? '.*( literal label' : `Stage ${index + 1}`}`).join('\n')}\n`;
  await Bun.write(source, text);
  const result = cli('--figure-out', scratch, source);
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  const exported = await Bun.file(`${scratch}/mermaid-1-${digest(text)}.html`).text();
  const figure = exported.replace('</svg>', '<foreignObject x="20" y="240" width="130" height="60">'
    + '<div>Wrapped<br>label</div></foreignObject></svg>');
  const [script, css] = await Promise.all(['js', 'css'].map((extension) =>
    Bun.file(`${assets}/diagram-viewer.${extension}`).text()));
  const html = `<!doctype html><meta charset="utf-8"><style>${css}
    body { margin: 0; } main { width: 360px; padding-top: 950px; }
  </style><main>${figure}</main><pre id="result">pending</pre>
  <script>
    const errors = [];
    window.addEventListener('error', (event) => errors.push(event.message));
    const consoleError = console.error.bind(console);
    console.error = (...args) => { errors.push(args.join(' ')); consoleError(...args); };
  </script>
  <script>${script}</script>
  <script>
    const probe = document.querySelector('#result');
    const viewer = document.querySelector('[data-diagram-viewer]');
    const frame = viewer.querySelector('.diagram-viewer__frame');
    const svg = frame.querySelector('svg');
    const query = viewer.querySelector('input[type=search]');
    const status = viewer.querySelector('[role=status]');
    const verify = (ok, message) => { if (!ok) throw Error(message); };
    const width = () => svg.getBoundingClientRect().width;
    addEventListener('load', () => {
      try {
        verify(viewer.hasAttribute('data-diagram-ready'), 'viewer never initialized');
        const before = width();
        viewer.querySelector('[data-diagram-action=in]').click();
        verify(width() > before, 'zoom in did not increase the actual SVG width');
        viewer.querySelector('[data-diagram-action=out]').click();
        verify(Math.abs(width() - before) < 1, 'zoom out did not restore scale');
        const wheel = (target) => {
          const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 });
          target.dispatchEvent(event);
          return event.defaultPrevented;
        };
        verify(!wheel(document.body), 'outside wheel was captured');
        verify(wheel(svg) && width() > before, 'inside wheel did not zoom and prevent default');
        const enter = (isComposing) => query.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', bubbles: true, cancelable: true, isComposing,
        }));
        query.value = '.*(';
        enter(true);
        verify(!status.textContent.includes('literal label'), 'IME composition ran Find');
        enter(false);
        verify(status.textContent.includes('.*( literal label'), 'literal Find did not match');
        const match = svg.querySelector('.diagram-viewer__match').getBoundingClientRect();
        const bounds = frame.getBoundingClientRect();
        verify(match.top >= Math.max(0, bounds.top) && match.bottom <= Math.min(innerHeight, bounds.bottom),
          'Find result is clipped by the page or frame: ' + JSON.stringify({ match, bounds, innerHeight, scrollY, scrollTop: frame.scrollTop }));
        query.value = '<img src=x onerror=alert(1)>';
        viewer.querySelector('[data-diagram-action=find]').click();
        verify(!svg.querySelector('.diagram-viewer__match') && !viewer.querySelector('img'), 'Find injected HTML or kept the old match');
        query.value = 'Wrapped label';
        viewer.querySelector('[data-diagram-action=find]').click();
        verify(status.textContent === 'Found Wrapped label', 'line breaks merged adjacent words');
        verify(!errors.length, errors.join(', '));
        probe.dataset.status = 'pass';
      } catch (error) { probe.textContent = error.message; }
    });
  </script>`;
  const page = `${scratch}/interactive.html`;
  await Bun.write(page, html);
  // The second fixture has no viewer script. The analyst script only measures CSS.
  const fallbackPage = `${scratch}/fallback.html`;
  await Bun.write(fallbackPage, html.split('<script>')[0] + `<script>
    const frame = document.querySelector('.diagram-viewer__frame');
    const svg = frame.querySelector('svg');
    const fit = document.querySelector('input[type=checkbox]');
    frame.style.width = '190px';
    const before = svg.getBoundingClientRect().width;
    const scroll = frame.scrollHeight > frame.clientHeight && frame.scrollWidth > frame.clientWidth;
    fit.click();
    if (scroll && before > frame.clientWidth && svg.getBoundingClientRect().width <= frame.clientWidth)
      document.querySelector('#result').dataset.status = 'pass';
  </script>`);
  let browserNoSandbox = false;
  let output;
  try {
    output = await dumpChromiumPage(browser, page, { browserNoSandbox: false });
  } catch (error) {
    if (!error.message.includes('Chromium sandbox startup failed')) throw error;
    expect(error.message).toContain('--browser-no-sandbox');
    console.warn('Chromium viewer sandbox startup held. Retrying with explicit --browser-no-sandbox.');
    browserNoSandbox = true;
    output = await dumpChromiumPage(browser, page, { browserNoSandbox: true });
  }
  expect(output.match(/<pre id="result"[^>]*>[^<]*<\/pre>/)?.[0]).toContain('data-status="pass"');
  const fallback = await dumpChromiumPage(browser, fallbackPage, { browserNoSandbox });
  expect(fallback.match(/<pre id="result"[^>]*>[^<]*<\/pre>/)?.[0]).toContain('data-status="pass"');
}, 3 * chromiumWallTimeout() + 40_000);

test.skipIf(!browser)('Chromium zoom keeps the diagram point under buttons, wheel and an emulated pinch', async () => {
  const script = await Bun.file(`${assets}/diagram-viewer.js`).text();
  const css = await Bun.file(`${assets}/diagram-viewer.css`).text();
  const figure = mermaidFigure({
    id: 'anchor',
    svg: '<svg width="2400" height="1600" viewBox="0 0 2400 1600"><rect width="2400" height="1600"/></svg>',
    viewer: true,
  });
  const page = `${scratch}/anchor.html`;
  await Bun.write(page, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <style>${css} body { margin: 16px; }</style>${figure}<script>${script}</script>`);
  const observations = await driveChromiumInput(browser, async (send) => {
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    const frame = "document.querySelector('.diagram-viewer__frame')";
    const svg = `${frame}.querySelector('svg')`;
    const observations = [];
    for (const width of [360, 1440]) {
      const mobile = width === 360;
      await send('Emulation.setDeviceMetricsOverride', { width, height: 850, deviceScaleFactor: 1, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
      const { errorText } = await send('Page.navigate', { url: Bun.pathToFileURL(page).href });
      expect(errorText).toBeUndefined();
      // Wait for the script to enhance the freshly navigated page before sending input.
      const deadline = performance.now() + 5_000;
      while (!await evaluate("Boolean(document.querySelector('[data-diagram-ready]'))")) {
        if (performance.now() > deadline) throw new Error('Viewer did not initialize after navigation');
        await Bun.sleep(25);
      }

      for (const input of mobile ? ['button', 'wheel', 'pinch'] : ['button', 'wheel']) {
        const initial = await evaluate(`(() => {
          document.querySelector('[data-diagram-action=reset]').click();
          const frame = ${frame};
          frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2;
          frame.scrollTop = (frame.scrollHeight - frame.clientHeight) / 2;
          const rect = frame.getBoundingClientRect();
          const x = rect.left + frame.clientLeft + frame.clientWidth * ${input === 'wheel' ? 0.3 : 0.5};
          const y = rect.top + frame.clientTop + frame.clientHeight * ${input === 'wheel' ? 0.4 : 0.5};
          const matrix = ${svg}.getScreenCTM();
          const anchor = new DOMPoint(x, y).matrixTransform(matrix.inverse());
          return { x, y, anchorX: anchor.x, anchorY: anchor.y, scale: matrix.a,
            left: frame.scrollLeft, top: frame.scrollTop };
        })()`);
        expect(initial.left).toBeGreaterThan(0);
        expect(initial.top).toBeGreaterThan(0);

        const { x, y } = initial;
        if (input === 'button') {
          await evaluate("document.querySelector('[data-diagram-action=in]').click()");
        } else if (input === 'wheel') {
          await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: -120 });
        } else {
          const touch = (type, touchPoints) => send('Input.dispatchTouchEvent', { type, touchPoints });
          const contacts = (offset) => [{ x: x - offset, y, id: 1 }, { x: x + offset, y, id: 2 }];
          await touch('touchStart', contacts(24));
          await touch('touchMove', contacts(48));
          await touch('touchMove', contacts(70));
          await touch('touchEnd', []);
        }

        observations.push(await evaluate(`(() => {
          const matrix = ${svg}.getScreenCTM();
          const point = new DOMPoint(${initial.anchorX}, ${initial.anchorY}).matrixTransform(matrix);
          return { input: "${input}", width: ${width}, scale: matrix.a, left: ${frame}.scrollLeft,
            top: ${frame}.scrollTop, drift: Math.hypot(point.x - ${x}, point.y - ${y}) };
        })()`));
      }
    }
    return observations;
  });
  expect(observations).toHaveLength(5);
  expect(observations.filter(({ scale, left, top, drift }) =>
    !(scale > 1 && left > 0 && top > 0 && drift < 4))).toEqual([]);
}, 100_000);

const guide = async (path) => Bun.file(`${root}/skills/${path}`).text();
const defaults = [/use|embed|choose/i, /diagram viewer/i, /by default|automatically/i, /dense/i, /wide|wider/i];
for (const path of ['axstack-explain/references/inline-pages.md', 'axstack-publish/SKILL.md']) {
  test(`${path} defaults to the viewer for dense or wide diagrams`, async () => {
    checkRule(await guide(path), (text) => requires(text, ...defaults),
      'Automatically embed the diagram viewer for dense or wide diagrams.',
      [[/use|embed|choose/i, 'skip']], defaults);
  });
}

test('the inline viewer contract preserves Find, wheel and no-script behavior', async () => {
  const text = await guide('axstack-explain/references/inline-pages.md');
  const noForm = /(?:without|never use|omit) (?:a )?(?:`?<form>`?|form\b)/i;
  checkRule(text, (value) => prohibits(value, noForm, /Find/i, /type=.?button/i),
    'Use type=button for Find without a form.', [[noForm, 'with a form']]);
  for (const [concepts, alternative, direction, inverse] of [
    [[/Find/i, /Enter/i, /isComposing|IME composition/i, /ignore|exclude/i],
      'For Find with Enter, exclude IME composition.', /ignore|exclude/i, 'include'],
    [[/Find/i, /scrollIntoView/i, /nearest/i], 'Find brings a match into view with scrollIntoView using nearest.',
      /nearest/i, 'center'],
    [[/wheel/i, /preventDefault/i, /only (?:inside|within)/i],
      'Call preventDefault on wheel events only within the viewer.', /only (?:inside|within)/i, 'outside'],
    [[/without JavaScript|no.JavaScript/i, /scroll frame|scroller/i, /Fit/i, /checkbox/i],
      'Without JavaScript, provide a scroller and a Fit checkbox.', /without JavaScript|no.JavaScript/i, 'With JavaScript'],
  ]) checkRule(text, (value) => requires(value, ...concepts), alternative, [[direction, inverse]], concepts);
});
