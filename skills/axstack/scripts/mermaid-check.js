#!/usr/bin/env bun
import { mkdirSync } from 'node:fs';

const PELE_VERSION = '1.13.0';
const PELE_SHA256 = '37bea5005aa6d2dde929032ced5d2958cf642667cbc1fe675f9dfacf4ba15a51';
const PELE_PATH = `${import.meta.dir}/../vendor/pele/pele.js`;
const TARGET_WIDTH = 860;
const NATURAL_LABEL_SIZE = 16;
const MIN_LABEL_SIZE = 12;
const DENSE_OVERVIEW_EDGES = 25;
const DENSE_ELK_NOTE = 'dense ELK overview: needs zoom/pan in chat; geometry not measured (pinned pele ignores ELK)';
const NO_CLASSES = new Set(['sequenceDiagram', 'stateDiagram-v2', 'timeline']);
const STATUS_WORD = /\b(?:planned|unknown|retiring|open|partial|deprecated|proposed)\b/i;

const HELP = `Usage: bun mermaid-check.js [options] <file.md|file.mmd>

Check Mermaid source with pinned Pele ${PELE_VERSION}.
  --expect             Require at least one Mermaid fence (default)
  --no-expect          Allow Markdown without Mermaid fences
  --overview           Require an overview flowchart as block 1 (tiered TB by default)
  --svg-out <dir>      Write checked SVGs and print source and SVG SHA-256 digests
  --pele <path>        Use an alternate copy of the pinned renderer
  --allow-type <type>  Allow one additional type explicitly requested by the user
  --help               Show this help
Exit codes: 0 pass, 1 input/contract/render failure, 2 usage, 3 renderer missing or invalid.`;

const TYPES = new Set(['flowchart', 'sequenceDiagram', 'stateDiagram-v2', 'erDiagram', 'timeline']);
const SPACING = new Map([
  ['flowchart', ['config.flowchart.nodeSpacing', 'config.flowchart.rankSpacing']],
  ['sequenceDiagram', ['config.sequence.actorMargin', 'config.sequence.messageMargin']],
]);
const NODE_STYLE = new Set(['fill', 'stroke', 'stroke-width', 'stroke-dasharray']);
const LINK_STYLE = new Set(['stroke-width']);
const QUOTED = /"(?:[^"\\]|\\.)*"/g;
const sha256 = (bytes) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');

function optionsFor(args) {
  const options = { path: '', renderer: PELE_PATH, svgDir: '', extraType: '', expect: true, overview: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--expect' || arg === '--no-expect') {
      options.expect = arg === '--expect';
    } else if (arg === '--overview') {
      options.overview = true;
    } else if (arg === '--pele' || arg === '--svg-out' || arg === '--allow-type') {
      const value = args[++index];
      if (!value || value.startsWith('--')) return undefined;
      if (arg === '--pele') options.renderer = value;
      else if (arg === '--svg-out') options.svgDir = value;
      else options.extraType = value;
    } else if (arg.startsWith('-') || options.path) {
      return undefined;
    } else {
      options.path = arg;
    }
  }
  return /\.(?:mmd|md|markdown)$/i.test(options.path) ? options : undefined;
}

function markdownBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split(/(?<=\n)/);
  let fence;
  for (const [index, line] of lines.entries()) {
    const text = line.trimEnd();
    if (fence) {
      const marker = text.trimStart();
      if (marker.startsWith(fence.marker) && [...marker].every((char) => char === fence.marker[0])) {
        if (fence.mermaid) blocks.push({ source: fence.source, line: fence.line, firstLine: fence.line + 1 });
        fence = undefined;
      } else if (fence.mermaid) {
        // Drop container indentation while preserving the payload's whitespace and line endings.
        const indent = line.match(/^[ \t]*/)[0].length;
        fence.source += line.slice(Math.min(indent, fence.indent));
      }
      continue;
    }
    const opening = text.match(/^([ \t]*(?:(?:[-+*]|\d+[.)])[ \t]+)?)(`{3,}|~{3,})(.*)$/);
    if (!opening || (opening[2][0] === '`' && opening[3].includes('`'))) continue;
    fence = {
      marker: opening[2],
      indent: opening[1].length,
      mermaid: /^mermaid(?:\s|$)/i.test(opening[3].trim()),
      line: index + 1,
      source: '',
    };
  }
  if (fence?.mermaid) throw new Error(`unclosed Mermaid fence at line ${fence.line}`);
  return blocks;
}

async function loadRenderer(path) {
  const bytes = await Bun.file(path).bytes();
  if (sha256(bytes) !== PELE_SHA256) throw new Error(`hash mismatch for ${path}`);
  // Import the verified bytes, even if the override path changes after the read.
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
  try {
    return await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rejectSemicolon(label, text) {
  if (!text?.includes(';')) return;
  const hint = label === 'participant alias' ? 'use a comma or dash and move status to message text' : 'use a comma or dash';
  throw new Error(`semicolon in ${label}; ${hint}`);
}

function sequenceText(line) {
  const alias = line.match(/^(?:actor|participant)\s+\S+?(?:\s*@\{[^{}]*\})?\s+as\s+(.*)$/i);
  if (alias) return ['participant alias', alias[1]];
  const message = line.match(/^[^:\s]+\s*(?:<<)?-+[-<>x)]+\s*[^:\s]+\s*:\s*(.*)$/);
  if (message) return ['sequence message', message[1]];
  return [];
}

function withoutMermaidEntities(text) {
  // Mermaid entities such as #42; use a semicolon as syntax.
  return text.replace(/#(?:\d+|[a-z]+);/gi, '');
}

function textBeforeParse(type, line) {
  if (type === 'sequenceDiagram') {
    const [label, text] = sequenceText(line);
    if (!label) return;
    // Pele can read a quoted semicolon as a separator and accept the altered sequence.
    for (const [quoted] of withoutMermaidEntities(text).matchAll(QUOTED)) rejectSemicolon(label, quoted);
  }
  if (type === 'stateDiagram-v2') {
    const label = line.match(/^(?!acc(?:Title|Descr)\s*:)([^:\s]+(?:\s*-->\s*[^:\s]+)?)\s*:\s*(.*)$/i);
    if (!label) return;
    // Pele drops text after an ambiguous semicolon in a state label. Leave explicit next statements alone.
    const text = withoutMermaidEntities(label[2]).split(/;\s*(?:(?:state|note|direction|class)\b|[^;\s]+\s*-->)/i)[0];
    rejectSemicolon(label[1].includes('-->') ? 'edge label' : 'node label', text.replace(/;$/, ''));
  }
}

function parseDiagram(pele, source, type) {
  try {
    return pele.parse(source);
  } catch (error) {
    if (error instanceof pele.PeleError && error.line) {
      const line = source.split(/\r?\n/)[error.line - 1]?.trim() ?? '';
      if (type === 'sequenceDiagram') {
        const [label, text] = sequenceText(line);
        if (label) rejectSemicolon(label, withoutMermaidEntities(text).replace(/;$/, ''));
      }
      if (type === 'erDiagram') {
        const label = line.match(/^\S+\s+[^:\s]*[-.]{2}[^:\s]*\s+\S+\s*:\s*(.*)$/)?.[1];
        if (label) rejectSemicolon('edge label', withoutMermaidEntities(label).replace(/;$/, ''));
      }
    }
    throw error;
  }
}

function frontmatterPaths(lines) {
  const fields = new Map();
  const stack = [{ path: '', indent: -1, childIndent: 0 }];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const entry = line.match(/^( *)([A-Za-z]\w*):(?: +(\S.*))?$/);
    if (!entry) throw new Error('expected multiline frontmatter with nested maps and scalar values');
    const [, spaces, key, value] = entry;
    const indent = spaces.length;
    while (stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1);
    parent.childIndent ??= indent;
    if (indent !== parent.childIndent) throw new Error('inconsistent indentation in frontmatter');
    if (/^(?:theme|themeVariables|themeCSS|look|font\w*)$/i.test(key)) {
      throw new Error(`${key} key is forbidden in frontmatter`);
    }
    const path = parent.path ? `${parent.path}.${key}` : key;
    if (fields.has(path)) throw new Error(`duplicate frontmatter key: ${path}`);
    if (/^[[{|>&*!]/.test(value ?? '')) throw new Error(`expected multiline frontmatter, not a flow mapping or special scalar at ${path}`);
    fields.set(path, value);
    if (!value) stack.push({ path, indent, childIndent: undefined });
  }
  return fields;
}

function checkFrontmatter(lines, type) {
  const fields = frontmatterPaths(lines);
  const spacing = SPACING.get(type) ?? [];
  const node = type === 'flowchart' ? 'config.flowchart' : 'config.sequence';
  const maps = spacing.length ? new Set(['config', node]) : new Set();
  let elk = false;
  for (const [path, value] of fields) {
    if (maps.has(path)) {
      if (value) throw new Error(`expected a multiline frontmatter map for ${path}`);
    } else if (spacing.includes(path)) {
      if (!/^\d+$/.test(value ?? '') || Number(value) < 40 || Number(value) > 150) {
        throw new Error(`${path} must be an integer from 40 to 150`);
      }
    } else if (path === 'config.layout') {
      if (type !== 'flowchart') throw new Error('config.layout is allowed only for flowchart');
      if (!/^(elk|"elk"|'elk')$/.test(value ?? '')) throw new Error('config.layout must be elk');
      elk = true;
    } else if (path === 'config.flowchart.curve' && type === 'flowchart') {
      if (!/^(?:step|linear|basis|(["'])(?:step|linear|basis)\1)$/.test(value ?? '')) {
        throw new Error('config.flowchart.curve must be step, linear or basis');
      }
    } else if (path === 'title') {
      if (!value) throw new Error('frontmatter title must be a scalar');
    } else {
      throw new Error(`unknown frontmatter key: ${path}`);
    }
  }
  for (const key of spacing) {
    if (!fields.has(key)) throw new Error(`required frontmatter key is missing: ${key}`);
  }
  return elk;
}

function strokeHue(value) {
  const rgb = Bun.color(value, '{rgb}');
  if (!rgb || typeof rgb === 'string') throw new Error(`stroke must be a colour with a measurable hue: ${value}`);
  const [red, green, blue] = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const spread = max - min;
  if (!spread || spread / (1 - Math.abs(max + min - 1)) <= 0.15) return undefined;
  let sector = (red - green) / spread + 4;
  if (max === red) sector = (green - blue) / spread;
  else if (max === green) sector = (blue - red) / spread + 2;
  return (sector * 60 + 360) % 360;
}

function checkAccentHues(hues) {
  if (hues.length < 2) return;
  const sorted = hues.toSorted((a, b) => a - b);
  // The complement of the largest gap is the shortest arc covering every accent.
  const maxGap = sorted.reduce((largest, hue, index) =>
    index ? Math.max(largest, hue - sorted[index - 1]) : largest, 360 + sorted[0] - sorted.at(-1));
  if (360 - maxGap > 30) throw new Error('use neutral grey strokes and one accent hue within ±15° per diagram');
}

function checkStyle(rule, kind, accentStrokes) {
  const declaration = rule.match(/^\w+\s+[^\s,]+(?:\s*,\s*[^\s,]+)*\s+(.+)$/);
  if (!declaration) throw new Error(`expected ${kind} targets and style properties`);
  const allowed = kind === 'linkStyle' ? LINK_STYLE : NODE_STYLE;
  for (const property of declaration[1].split(/(?<!\\),/)) {
    const [, key, value] = property.match(/^\s*([\w-]+)\s*:\s*(\S.*?)\s*$/) ?? [];
    if (!key) throw new Error(`invalid ${kind} property: ${property.trim()}`);
    if (!allowed.has(key)) throw new Error(`${kind} property ${key} is forbidden`);
    if (key === 'fill' && !/^(?:transparent|none)$/i.test(value)) {
      throw new Error(`${kind} fill must be transparent or none`);
    }
    if (key === 'stroke') {
      const hue = strokeHue(value);
      if (hue !== undefined) accentStrokes.set(value.toLowerCase(), hue);
    }
  }
}

function lintableBody(lines) {
  // Accessibility descriptions can contain whole lines that look like Mermaid statements.
  return lines.join('\n')
    .replace(/^[ \t]*accDescr\s*\{[^}]*\}/gm, (description) => description.replace(/[^\n]/g, ' '))
    .replace(/^[ \t]*(?:%%|acc(?:Title|Descr)\s*:).*$/gm, '');
}

function checkMetadataLabels(body) {
  // Pele calls metadata labels Markdown whether or not the value was double-quoted.
  const unquoted = body.replace(QUOTED, '""');
  for (const [, metadata] of unquoted.matchAll(/@\{([^{}]*)\}/g)) {
    const label = metadata.match(/(?:^|[,\n])\s*label\s*:\s*([^,\n]*)/)?.[1];
    rejectSemicolon('node label', withoutMermaidEntities(label ?? ''));
  }
}

function sourceRules(source, extraType) {
  const init = source.match(/%%\s*\{\s*(init|initialize)\b/i);
  if (init) throw new Error(`${init[1]} directive is forbidden`);

  const lines = source.split(/\r?\n/);
  const opening = lines.findIndex((line) => line.trim());
  const frontmatter = lines[opening] === '---';
  const closing = frontmatter ? lines.indexOf('---', opening + 1) : -1;
  if (frontmatter && closing === -1) throw new Error('expected frontmatter with closing ---');

  const body = lines.slice(closing + 1);
  const header = body.find((line) => line.trim() && !line.trimStart().startsWith('%%'));
  const type = header?.trim().split(/[\s;]/)[0];
  if (!TYPES.has(type) && (!type || type !== extraType)) {
    throw new Error(`unsupported diagram type: ${type ?? '(empty)'}`);
  }

  const elk = checkFrontmatter(frontmatter ? lines.slice(opening + 1, closing) : [], type);
  const lintable = lintableBody(body);
  if (type === 'flowchart') checkMetadataLabels(lintable);

  // Flowcharts accept semicolons both between statements and inside labels.
  const flowLabels = /(?:--|-\.+|==)\s+.+?\s+(?:--+>|\.+->|==+>)|"(?:[^"\\]|\\.)*"|\[[^\]]*\]|\([^()]*\)|\{[^{}]*\}|\|[^|]*\|/g;
  const accentStrokes = new Map();
  for (const line of lintable.split('\n')) {
    textBeforeParse(type, line.trim());
    const statements = type === 'flowchart'
      ? line.replace(flowLabels, (label) => label.replaceAll(';', '\u0000')).split(';')
      : [line];
    for (const statement of statements) {
      const rule = statement.trim();
      if (rule.startsWith('%%')) break;
      if (/^rect(?=\s|$)/.test(rule)) throw new Error('rect statement is forbidden');
      if (type === 'stateDiagram-v2' && /^[^:]*-\.->/.test(rule)) {
        throw new Error('stateDiagram-v2 cannot use -.->; put status in the transition label');
      }
      const kind = rule.match(/^(classDef|style|linkStyle)(?=\s|$)/)?.[1];
      if (!kind) continue;
      if (kind === 'classDef' && NO_CLASSES.has(type)) throw new Error(`classDef is forbidden in ${type}`);
      checkStyle(rule, kind, accentStrokes);
    }
  }
  checkAccentHues([...accentStrokes.values()]);
  return { type, elk, accentStrokes };
}

function overviewWarnings(type, model, dense, denseElk) {
  if (type !== 'flowchart' || (model.direction !== 'TB' && !(dense && model.direction === 'LR'))) {
    throw new Error('overview block 1 must be a flowchart TB unless a dense overview uses LR');
  }
  if (!denseElk && !model.subgraphs.length) throw new Error('overview block 1 must have at least one subgraph');

  const warnings = [];
  const subgraphIds = new Set(model.subgraphs.map((subgraph) => subgraph.id));
  for (const subgraph of model.subgraphs) {
    const direct = subgraph.nodes.filter((id) => !subgraphIds.has(id)).length;
    if (direct > 5) warnings.push(`overview subgraph "${subgraph.title}" has ${direct} direct nodes; aim for about 5 per tier`);
  }
  for (const node of model.nodes.values()) {
    if (subgraphIds.has(node.id)) continue;
    const label = node.text?.trim() || node.id;
    const words = label.replace(/\s*\(([^()]+)\)$/, (suffix, text) => STATUS_WORD.test(text) ? '' : suffix).split(/\s+/);
    if (words.length > 3) warnings.push(`overview label "${label}" is long; use the name and at most one status word`);
  }
  return warnings;
}

function hasDashPattern(styles) {
  return styles?.some((style) => /^stroke-dasharray\s*:/.test(style));
}

function checkDashedStatus(type, model) {
  const dashed = new Set([...(model.classes?.values() ?? [])]
    .filter(({ styles }) => hasDashPattern(styles))
    .map(({ id }) => id));

  function requireStatus({ id, text, classes, styles }, labelKind) {
    const statusClass = classes.find((name) => dashed.has(name))
      ?? (labelKind === 'node' && dashed.has('default') ? 'default' : undefined);
    if (!statusClass && !hasDashPattern(styles)) return;
    if (!STATUS_WORD.test((text || id).replace(/<[^>]*>/g, ' '))) {
      const marker = statusClass ? `dashed class ${statusClass}` : 'dashed style';
      throw new Error(`${marker} on ${id} requires a status word in the ${labelKind} label`);
    }
  }

  const nodes = type === 'flowchart'
    ? [...model.nodes.values()].filter(({ id }) => !model.subgraphLookup.has(id))
    : [...model.entities.values()].map((entity) => ({
      id: entity.label,
      text: entity.alias || entity.label,
      classes: entity.cssClasses.split(/\s+/),
      styles: entity.cssStyles,
    }));
  for (const node of nodes) requireStatus(node, 'node');
  for (const group of model.subgraphs) {
    requireStatus({
      id: group.id,
      text: group.title,
      classes: group.classes,
      // Pele exposes flowchart subgraph styles on the node with the same ID.
      styles: group.cssStyles ?? model.nodes?.get(group.id)?.styles,
    }, 'subgraph');
  }
}

function checkModel(type, model, overview, dense, denseElk) {
  for (const field of ['accTitle', 'accDescr']) {
    if (!model[field]?.trim()) throw new Error(`${field} is required`);
  }

  if (type === 'timeline' && model.periods.length > 4 && model.direction !== 'TD') {
    throw new Error('use timeline TD for more than 4 periods');
  }
  const warnings = overview ? overviewWarnings(type, model, dense, denseElk) : [];
  const counts = overview ? [] : [
    [model.nodes?.size ?? model.states?.size ?? model.entities?.size, 9, 'nodes'],
    [model.edges?.length ?? model.relations?.length ?? model.relationships?.length, 12, 'edges'],
    [model.actors?.size, 5, 'participants'],
  ];
  for (const [count, limit, label] of counts) {
    if (count > limit) warnings.push(`${count} ${label} exceeds ${limit}; consider splitting the view`);
  }
  const nodes = [...(model.nodes?.values() ?? [])];
  if (model.boxes?.some((box) => box.fill !== 'transparent')) throw new Error('coloured box is forbidden');
  if (type === 'flowchart' || type === 'erDiagram') checkDashedStatus(type, model);

  const edges = model.edges ?? [];
  if (type === 'flowchart') {
    for (const node of nodes) {
      if (node.labelType === 'text') rejectSemicolon('node label', node.text);
    }
    for (const edge of edges) {
      if (edge.labelType === 'text') rejectSemicolon('edge label', edge.text);
    }
    for (const group of model.subgraphs) {
      if (group.labelType === 'text') rejectSemicolon('subgraph label', group.title);
    }
  }

  const nodeLabels = [
    ...nodes.map((node) => node.text),
    ...[...(model.states?.values() ?? [])].flatMap((state) => state.descriptions),
    ...[...(model.entities?.values() ?? [])].map((entity) => entity.alias || entity.label),
    ...(model.periods ?? []).flatMap((period) => [period.text, ...period.events]),
  ];
  const edgeLabels = [
    ...edges.map((edge) => edge.text),
    ...(model.relations ?? []).map((edge) => edge.relationTitle),
    ...(model.relationships ?? []).map((edge) => edge.roleA),
  ];
  const actors = [...(model.actors?.values() ?? [])];
  const aliases = actors.filter((actor) => actor.description !== actor.name).map((actor) => actor.description);
  const messages = (model.messages ?? []).map((message) => message.message);

  for (const [label, texts] of [
    ['node label', nodeLabels],
    ['edge label', edgeLabels],
    ['participant alias', aliases],
    ['sequence message', messages],
  ]) {
    for (const text of texts) {
      if (!text) continue;
      if (type !== 'flowchart') rejectSemicolon(label, text);
      if (type === 'flowchart' && text.includes('*')) {
        throw new Error(`asterisk in flowchart ${label}; use ✱`);
      }
      if (label === 'participant alias' && /[()[\]]/.test(text)) {
        throw new Error('brackets or parentheses in participant alias; use a plain name and move status to message text');
      }
    }
  }
  const labels = [...nodeLabels, ...edgeLabels, ...actors.map((actor) => actor.description ?? actor.name)];
  if (labels.some((label) => label?.length > 40)) warnings.push('label exceeds 40 characters; shorten it or split the view');
  if (messages.some((message) => message?.length > 28)) {
    warnings.push('sequence message exceeds 28 characters; shorten it or split the view');
  }
  return warnings;
}

function embeddedSvg(svg, accentStrokes) {
  if (!accentStrokes.size) return svg;
  // Rewrite only declared accent strokes. Keep neutral strokes, theme fallbacks and label text.
  return svg.replace(/(<[^<>]*\sstyle=")([^"]*)"/g, (_, opening, style) =>
    `${opening}${style.replace(/(^|;)stroke\s*:\s*([^;]+)/g, (declaration, separator, value) =>
      accentStrokes.has(value.trim().toLowerCase()) ? `${separator}stroke:var(--_c)` : declaration)}"`);
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log(HELP);
    return 0;
  }
  const options = optionsFor(args);
  if (!options) {
    console.error(HELP);
    return 2;
  }

  let blocks;
  try {
    const source = await Bun.file(options.path).text();
    blocks = /\.mmd$/i.test(options.path) ? [{ source, line: 1, firstLine: 1 }] : markdownBlocks(source);
    if (!blocks.length && options.overview) throw new Error('overview block 1 is missing');
    if (!blocks.length && options.expect) throw new Error('no Mermaid fences found');
  } catch (error) {
    console.error(`${options.path}: ${error.message}`);
    return 1;
  }
  if (!blocks.length) {
    console.log(`${options.path}: checked 0 Mermaid blocks`);
    return 0;
  }

  let pele;
  try {
    pele = await loadRenderer(options.renderer);
  } catch (error) {
    const reason = error.code === 'ENOENT' ? `missing: ${options.renderer}` : error.message;
    console.error(`Pele ${PELE_VERSION} renderer: ${reason}`);
    return 3;
  }

  let failed = false;
  const views = [];
  for (const [index, block] of blocks.entries()) {
    const number = index + 1;
    const where = `${options.path} block ${number} (line ${block.line})`;
    try {
      const { type, elk, accentStrokes } = sourceRules(block.source, options.extraType);
      const model = parseDiagram(pele, block.source, type);
      const overview = options.overview && index === 0;
      const dense = overview && type === 'flowchart' && model.edges.length > DENSE_OVERVIEW_EDGES;
      const denseElk = dense && elk;
      const warnings = checkModel(type, model, overview, dense, denseElk);
      const digest = sha256(block.source);
      const id = `mermaid-${number}-${digest.slice(0, 12)}`;
      const { svg, width } = pele.render(block.source, { idPrefix: id });
      const labelSize = NATURAL_LABEL_SIZE * (denseElk ? 1 : Math.min(1, TARGET_WIDTH / width));
      if (labelSize < MIN_LABEL_SIZE) {
        throw new Error(`label size ${labelSize.toFixed(3)}px is below ${MIN_LABEL_SIZE}px at ${TARGET_WIDTH}px; restructure the view`);
      }
      for (const warning of warnings) console.warn(`${where}: warning: ${warning}`);
      const measurement = denseElk
        ? `${DENSE_ELK_NOTE}; natural-size labels ${labelSize}px`
        : `${elk ? 'default layout ' : ''}${width}px`;
      views.push({ where, type, measurement, digest, id, svg, accentStrokes });
    } catch (error) {
      const location = error.line ? ` at line ${block.firstLine + error.line - 1}, column ${error.column}` : '';
      const message = error instanceof pele.PeleError ? `Pele parse/render failure${location}: ${error.message}` : error.message;
      console.error(`${where}: ${message}`);
      failed = true;
    }
  }
  if (failed) return 1;

  try {
    if (options.svgDir) mkdirSync(options.svgDir, { recursive: true });
    for (const { where, type, measurement, digest, id, svg, accentStrokes } of views) {
      let svgProof = '';
      if (options.svgDir) {
        const path = `${options.svgDir}/${id}.svg`;
        const output = embeddedSvg(svg, accentStrokes);
        await Bun.write(path, output);
        svgProof = `; SVG sha256=${sha256(output)} ${path}`;
      }
      console.log(`${where}: ${type} ${measurement}; Pele ${PELE_VERSION}; source sha256=${digest}${svgProof}`);
    }
  } catch (error) {
    console.error(`SVG output: ${error.message}`);
    return 1;
  }
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
