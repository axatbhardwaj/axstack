import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const path = `${import.meta.dir}/../../skills/axstack-anatomy/theme.js`;
const source = () => existsSync(path) ? readFileSync(path, 'utf8') : '';

// Load exactly the bytes injected into pages. The missing wrapper behaves as a
// no-op so the first red is the observable theme, not a missing-module error.
function fixture({ background = '', marker = '', dark = false, buildTheme = 'dark' } = {}) {
  const attributes = { 'data-theme': buildTheme };
  if (marker) attributes['data-axstack-theme'] = marker;
  const body = { getAttribute: (name) => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = value; },
    removeAttribute: (name) => { delete attributes[name]; } };
  const styles = [];
  let change;
  let themeChecks = 0;
  const observations = [];
  const media = { matches: dark, addEventListener: (_, fn) => { change = fn; }, removeEventListener() {} };
  const doc = { body, documentElement: {}, head: {},
    createElement: () => ({}), getElementById: () => null };
  body.parentNode = doc.documentElement;
  doc.head.parentNode = doc.documentElement;
  doc.head.appendChild = (style) => { style.parentNode = doc.head; styles.push(style); };
  const notify = (target, type, attributeName) => {
    const matches = observations.some(({ node, options }) => {
      let current = target;
      while (current && current !== node) current = options.subtree ? current.parentNode : null;
      return current === node && options[type] &&
        (type !== 'attributes' || !options.attributeFilter || options.attributeFilter.includes(attributeName));
    });
    if (matches) observations[0].callback([{ target, type, attributeName }]);
  };
  const view = { getComputedStyle: () => { themeChecks++; return { getPropertyValue: () => background }; },
    matchMedia: () => media, MutationObserver: class { constructor(fn) { this.callback = fn; } observe(node, options) { observations.push({ node, options, callback: this.callback }); } disconnect() {} } };
  const colors = { '#111': [17, 17, 17, 255], 'rgb(255 255 255)': [255, 255, 255, 255],
    'hsl(0 0% 100%)': [255, 255, 255, 255], 'oklch(0.1 0 0)': [3, 3, 3, 255],
    'color(display-p3 1 1 1)': [255, 255, 255, 255] };
  const code = source();
  const install = code ? new Function(`${code}\nreturn installAnatomyTheme;`)() : () => {};
  install({ doc, view, resolveColor: (color) => colors[color] });
  return { attributes, styles, get themeChecks() { return themeChecks; },
    switchBackground: (color, attribute = 'style') => { background = color; notify(doc.documentElement, 'attributes', attribute); },
    switchStylesheet: (color, type) => {
      background = color;
      notify(type === 'childList' ? doc.head : { parentNode: styles[0] }, type);
    },
    animateFigure: () => {
      const figure = { parentNode: body };
      notify(figure, 'attributes', 'style');
      notify(figure, 'childList');
      notify({ parentNode: figure }, 'characterData');
    },
    switchMedia: (value) => { media.matches = value; change?.(); },
    marker: (value) => { attributes['data-axstack-theme'] = value; notify(body, 'attributes', 'data-axstack-theme'); } };
}

for (const background of ['#111', 'rgb(255 255 255)', 'hsl(0 0% 100%)', 'oklch(0.1 0 0)', 'color(display-p3 1 1 1)']) {
  test(`anatomy theme resolves CSS color via the browser resolver: ${background}`, () => {
    const f = fixture({ background, buildTheme: background === '#111' ? 'light' : 'dark' });
    expect(f.attributes['data-theme']).toBe(['#111', 'oklch(0.1 0 0)'].includes(background) ? 'dark' : 'light');
    expect(f.attributes['data-axstack-t3']).toBe('');
  });
}

for (const background of ['', '#111']) {
  test(`explicit marker wins ${background ? 'inside T3' : 'standalone'}`, () => {
    const f = fixture({ background, marker: 'light', dark: true });
    expect(f.attributes['data-theme']).toBe('light');
    f.marker('dark');
    expect(f.attributes['data-theme']).toBe('dark');
  });
}

test('standalone ignores the build theme and follows live system appearance', () => {
  const f = fixture({ dark: false });
  expect(f.attributes['data-theme']).toBe('light');
  expect(f.attributes).not.toHaveProperty('data-axstack-t3');
  f.switchMedia(true);
  expect(f.attributes['data-theme']).toBe('dark');
});

test('T3 live variable change selects a palette and removal restores standalone', () => {
  const f = fixture({ background: 'rgb(255 255 255)', dark: false });
  f.switchBackground('#111');
  expect(f.attributes['data-theme']).toBe('dark');
  f.switchBackground('');
  expect(f.attributes['data-theme']).toBe('light');
  expect(f.attributes).not.toHaveProperty('data-axstack-t3');
});

test('wrapper scopes zero gutters and transparent page background to T3 only', () => {
  const f = fixture({ background: '#111' });
  const css = f.styles.map((style) => style.textContent).join('');
  expect(css).toMatch(/data-axstack-t3/);
  expect(css).toMatch(/margin:\s*0/);
  expect(css).toMatch(/background:\s*(?:none|transparent)/);
  expect(css).toMatch(/padding:\s*16px/);
  expect(css).toContain('var(--radius)');
});

test('figure animation never recomputes the page theme', () => {
  const f = fixture({ background: '#111' });
  const initial = f.themeChecks;
  f.animateFigure();
  expect(f.themeChecks).toBe(initial);
  expect(f.attributes['data-theme']).toBe('dark');
});

for (const type of ['childList', 'characterData']) {
  test(`live stylesheet ${type} updates still change the page theme`, () => {
    const f = fixture({ background: '#111' });
    f.switchStylesheet('rgb(255 255 255)', type);
    expect(f.attributes['data-theme']).toBe('light');
  });
}

test('root theme class changes still update the page palette', () => {
  const f = fixture({ background: '#111' });
  f.switchBackground('rgb(255 255 255)', 'class');
  expect(f.attributes['data-theme']).toBe('light');
});
