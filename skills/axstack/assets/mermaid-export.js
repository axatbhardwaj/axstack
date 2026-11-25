// Runs in the export page with the integrity-checked standalone Mermaid bundle.
const mermaid = Reflect.get(globalThis, 'mermaid');
const { jobs, width } = Reflect.get(globalThis, 'mermaidExport');
const result = document.querySelector('#result');
const themeRoles = [
  ['bg', '#ffffff', 'background compositeBackground'],
  ['surface', '#f5f5f5', 'primaryColor mainBkg nodeBkg stateBkg labelBackgroundColor compositeTitleBackground attributeBackgroundColorOdd'],
  ['surface-alt', '#eeeeee', 'secondaryColor tertiaryColor clusterBkg secondaryBkg edgeLabelBackground relationLabelBackground altBackground noteBkgColor rowEven attributeBackgroundColorEven'],
  ['fg', '#1a1a1a', 'textColor primaryTextColor secondaryTextColor tertiaryTextColor nodeTextColor titleColor stateLabelColor transitionLabelColor relationLabelColor noteTextColor classText'],
  ['line', '#666666', 'lineColor defaultLinkColor relationColor transitionColor arrowheadColor specialStateColor'],
  ['border', '#777777', 'primaryBorderColor secondaryBorderColor tertiaryBorderColor clusterBorder nodeBorder compositeBorder noteBorderColor'],
];

// CSSOM normalizes named colours and Mermaid's rgb() form to the same value.
const colourProbe = document.createElement('canvas').getContext('2d');
function normalizeColour(value) {
  if (!CSS.supports('color', value) || value.startsWith('var(')) return '';
  colourProbe.fillStyle = value;
  return colourProbe.fillStyle;
}

function themeFor(layout, accents) {
  const themeVariables = {};
  const bindings = new Map();
  for (const [index, [role, fallback, keys]] of themeRoles.entries()) {
    let offset = 0;
    let sentinel;
    do {
      if (offset === 255) throw new Error(`no unused theme sentinel for ${role}`);
      const red = index + 1;
      const green = 161 + index;
      sentinel = `#${[red, green, ++offset].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    } while (accents.has(normalizeColour(sentinel)));
    const css = `var(--pele-${role},${fallback})`;
    bindings.set(sentinel, css);
    for (const key of keys.split(' ')) themeVariables[key] = sentinel;
  }
  // The pinned base theme derives ER row colours and uses a translucent label
  // background. Resolve these in the same pass as the explicit theme colours.
  const surface = themeVariables.primaryColor;
  const alternate = themeVariables.secondaryColor;
  themeVariables.rowOdd = surface;
  const config = { startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
    layout, theme: 'base', fontFamily: 'Arial, sans-serif', themeVariables };
  mermaid.initialize(config);
  const actual = mermaid.mermaidAPI.getConfig().themeVariables;
  bindings.set(actual.rowOdd, bindings.get(surface));
  bindings.set(actual.rowEven, bindings.get(alternate));
  const [red, green, blue] = alternate.slice(1).match(/../g).map((pair) => Number.parseInt(pair, 16));
  bindings.set(`rgba(${red}, ${green}, ${blue}, 0.5)`, `color-mix(in srgb, ${bindings.get(alternate)} 50%, transparent)`);
  return bindings;
}

const colourTokens = /\burl\([^)]*\)|#[a-f\d]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/gi;
const declarations = /(^|[;{])(\s*[-\w]+\s*:\s*)([^;{}]+)/g;
const paints = ['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color'];

function applyTheme(svg, bindings, accents) {
  // Work on paint values alone. Labels, IDs and URL fragments keep their bytes.
  const lookup = new Map([...bindings].map(([value, css]) => [normalizeColour(value), css]));
  const rewrite = (property, value) => {
    const paint = value.trim().replace(/\s*!important\s*$/i, '');
    if (property === 'stroke' && accents.has(normalizeColour(paint))) {
      return value.replace(paint, 'var(--_c,var(--pele-accent,#5b7bd5))');
    }
    const rewritten = value.replace(colourTokens, (token) => lookup.get(normalizeColour(token)) ?? token);
    for (const token of rewritten.match(colourTokens) ?? []) {
      if (lookup.has(normalizeColour(token))) throw new Error(`unresolved Mermaid theme sentinel ${token}`);
    }
    return rewritten;
  };
  const css = (text) => text.replace(declarations, (_, start, key, value) =>
    start + key + rewrite(key.split(':')[0].trim(), value));

  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    if (node.localName === 'style') node.textContent = css(node.textContent);
    if (node.hasAttribute('style')) node.setAttribute('style', css(node.getAttribute('style')));
    for (const attr of paints) {
      if (node.hasAttribute(attr)) node.setAttribute(attr, rewrite(attr, node.getAttribute(attr)));
    }
  }
}

function minimumLabelSize(svg) {
  const walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
  let minimum = Infinity;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    const label = element.closest('text, foreignObject');
    if (!label || !node.textContent.trim() || !element.getClientRects().length) continue;
    const { fontSize, visibility } = getComputedStyle(element);
    if (visibility === 'hidden') continue;
    const matrix = label.getScreenCTM();
    const rendered = Number.parseFloat(fontSize) * Math.hypot(matrix.c, matrix.d);
    minimum = Math.min(minimum, rendered);
  }
  return Number.isFinite(minimum) ? minimum : null;
}

async function render({ id, source, dense, figureExport, layout, accents }) {
  const accentColours = new Set(accents.map(normalizeColour).filter(Boolean));
  const theme = themeFor(layout, accentColours);
  const { svg } = await mermaid.render(id, source);
  const fragment = document.createElement('template');
  fragment.innerHTML = svg;
  const root = fragment.content.querySelector('svg');
  if (!root) throw new Error('Mermaid returned no SVG');
  const { width: naturalWidth, height: naturalHeight } = root.viewBox.baseVal;
  if (!(naturalWidth > 0 && naturalHeight > 0)) throw new Error('Mermaid returned an invalid viewBox');

  applyTheme(root, theme, accentColours);
  root.style.removeProperty('max-width');
  const naturalSize = dense || (figureExport && naturalWidth > width);
  const fitted = naturalSize ? naturalWidth : Math.min(naturalWidth, width);
  root.setAttribute('width', fitted);
  root.setAttribute('height', fitted * naturalHeight / naturalWidth);
  document.body.append(root);
  const minLabelPx = minimumLabelSize(root);
  root.remove();
  root.setAttribute('width', naturalWidth);
  root.setAttribute('height', naturalHeight);
  const standalone = new XMLSerializer().serializeToString(root);
  const xml = new DOMParser().parseFromString(standalone, 'image/svg+xml');
  if (xml.documentElement.localName !== 'svg' || xml.querySelector('parsererror')) throw new Error('Mermaid returned invalid SVG XML');
  return { id, svg: standalone, naturalSize, minLabelPx };
}

function finish(status, value) {
  result.textContent = encodeURIComponent(JSON.stringify(value));
  result.dataset.status = status;
}

async function main() {
  const violations = [];
  document.addEventListener('securitypolicyviolation', (event) => violations.push(event.violatedDirective));
  const exports = [];
  for (const job of jobs) {
    try {
      exports.push(await render(job));
    } catch (error) {
      throw new Error(`${job.id}: ${error.message ?? error}`);
    }
  }
  if (violations.length) throw new Error(`Mermaid export attempted a blocked resource: ${violations.join(', ')}`);
  return exports;
}

main().then((value) => finish('ok', value), (error) => finish('error', error.message));
