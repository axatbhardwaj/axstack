#!/usr/bin/env bun
import { mkdirSync } from 'node:fs';

const PELE_VERSION = '1.13.0';
const PELE_SHA256 = '37bea5005aa6d2dde929032ced5d2958cf642667cbc1fe675f9dfacf4ba15a51';
const PELE_PATH = `${import.meta.dir}/../vendor/pele/pele.js`;
const TARGET_WIDTH = 860;
const MIN_LABEL_SIZE = 12;
const NO_CLASSES = new Set(['sequenceDiagram', 'stateDiagram-v2', 'timeline']);

const HELP = `Usage: bun mermaid-check.js [options] <file.md|file.mmd>

Check Mermaid source with pinned Pele ${PELE_VERSION}.
  --expect             Require at least one Mermaid fence (default)
  --no-expect          Allow Markdown without Mermaid fences
  --overview           Require a tiered TB flowchart as block 1
  --svg-out <dir>      Write checked SVGs and print source and SVG SHA-256 digests
  --pele <path>        Use an alternate copy of the pinned renderer
  --allow-type <type>  Allow one additional type explicitly requested by the user
  --help               Show this help
Exit codes: 0 pass, 1 input/contract/render failure, 2 usage, 3 renderer missing or invalid.`;

const CONFIG = new Map([
  ['flowchart', 'config:\n  flowchart:\n    nodeSpacing: 90\n    rankSpacing: 110\n    curve: step'],
  ['sequenceDiagram', 'config:\n  sequence:\n    actorMargin: 80\n    messageMargin: 48'],
  ['stateDiagram-v2', ''],
  ['erDiagram', ''],
  ['timeline', ''],
]);
const CLASSES = new Set([
  'classDef accent stroke:#5b7bd5,stroke-width:2px',
  'classDef planned stroke-dasharray:6 4',
  'classDef unknown stroke-dasharray:2 3',
]);
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
    for (const [quoted] of withoutMermaidEntities(text).matchAll(/"(?:[^"\\]|\\.)*"/g)) rejectSemicolon(label, quoted);
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

function sourceRules(source, extraType) {
  const init = source.match(/%%\s*\{\s*(init|initialize)\b/i);
  if (init) throw new Error(`${init[1]} directive is forbidden`);

  const lines = source.split(/\r?\n/);
  const opening = lines.findIndex((line) => line.trim());
  const frontmatter = lines[opening] === '---';
  const closing = frontmatter ? lines.indexOf('---', opening + 1) : -1;
  if (frontmatter && closing === -1) throw new Error('expected canonical frontmatter with closing ---');

  const body = lines.slice(closing + 1);
  const header = body.find((line) => line.trim() && !line.trimStart().startsWith('%%'));
  const type = header?.trim().split(/[\s;]/)[0];
  if (!CONFIG.has(type) && (!type || type !== extraType)) {
    throw new Error(`unsupported diagram type: ${type ?? '(empty)'}`);
  }

  const config = frontmatter ? lines.slice(opening + 1, closing) : [];
  const expected = CONFIG.get(type) ?? '';
  const titleIndex = config.findIndex((line) => /^title: \S.*$/.test(line));
  const hasTitle = titleIndex === 0 || (titleIndex >= 0 && titleIndex === config.length - 1);
  if (hasTitle) config.splice(titleIndex, 1);
  const forbiddenKey = config.join('\n').match(/\b(themeVariables|themeCSS|theme|look|font\w*)['"]?\s*:/i);
  if (forbiddenKey) throw new Error(`${forbiddenKey[1]} key is forbidden in frontmatter`);
  if (config.join('\n') !== expected || (frontmatter && !expected && !hasTitle)) {
    throw new Error(`expected canonical frontmatter for ${type}`);
  }

  // Flowcharts accept semicolons both between statements and inside labels.
  const flowLabels = /(?:--|-\.+|==)\s+.+?\s+(?:--+>|\.+->|==+>)|"(?:[^"\\]|\\.)*"|\[[^\]]*\]|\([^()]*\)|\{[^{}]*\}|\|[^|]*\|/g;
  for (const line of body) {
    textBeforeParse(type, line.trim());
    const statements = type === 'flowchart' ? line.replace(flowLabels, '""').split(';') : [line];
    for (const statement of statements) {
      const rule = statement.trim();
      if (rule.startsWith('%%')) break;
      const banned = rule.match(/^(style|linkStyle|rect)(?=\s|$)/);
      if (banned) throw new Error(`${banned[1]} statement is forbidden`);
      if (type === 'stateDiagram-v2' && /^[^:]*-\.->/.test(rule)) {
        throw new Error('stateDiagram-v2 cannot use -.->; put status in the transition label');
      }
      if (!/^classDef(?:\s|$)/.test(rule)) continue;
      if (NO_CLASSES.has(type)) throw new Error(`classDef is forbidden in ${type}`);
      if (!CLASSES.has(rule) || rule !== line.trim()) throw new Error('expected a canonical classDef line');
      if (rule.startsWith('classDef accent ') && type !== 'flowchart') {
        throw new Error('accent classDef is flowchart-only');
      }
    }
  }
  return type;
}

function overviewWarnings(type, model) {
  if (type !== 'flowchart' || model.direction !== 'TB') {
    throw new Error('overview block 1 must be a flowchart TB');
  }
  if (!model.subgraphs.length) throw new Error('overview block 1 must have at least one subgraph');

  const warnings = [];
  const subgraphIds = new Set(model.subgraphs.map((subgraph) => subgraph.id));
  for (const subgraph of model.subgraphs) {
    const direct = subgraph.nodes.filter((id) => !subgraphIds.has(id)).length;
    if (direct > 5) warnings.push(`overview subgraph "${subgraph.title}" has ${direct} direct nodes; aim for about 5 per tier`);
  }
  for (const node of model.nodes.values()) {
    if (subgraphIds.has(node.id)) continue;
    const label = node.text?.trim() || node.id;
    const words = label.replace(/\s*\((?:planned|unknown)\)$/i, '').split(/\s+/);
    if (words.length > 3) warnings.push(`overview label "${label}" is long; use the name and at most one status word`);
  }
  return warnings;
}

function checkModel(type, model, overview) {
  for (const field of ['accTitle', 'accDescr']) {
    if (!model[field]?.trim()) throw new Error(`${field} is required`);
  }

  if (type === 'timeline' && model.periods.length > 4 && model.direction !== 'TD') {
    throw new Error('use timeline TD for more than 4 periods');
  }
  const warnings = overview ? overviewWarnings(type, model) : [];
  const counts = overview ? [] : [
    [model.nodes?.size ?? model.states?.size ?? model.entities?.size, 9, 'nodes'],
    [model.edges?.length ?? model.relations?.length ?? model.relationships?.length, 12, 'edges'],
    [model.actors?.size, 5, 'participants'],
  ];
  for (const [count, limit, label] of counts) {
    if (count > limit) warnings.push(`${count} ${label} exceeds ${limit}; consider splitting the view`);
  }
  const nodes = [...(model.nodes?.values() ?? [])];
  if (nodes.filter((node) => node.classes?.includes('accent')).length > 2) {
    throw new Error('at most two flowchart nodes may use accent');
  }
  if (model.boxes?.some((box) => box.fill !== 'transparent')) throw new Error('coloured box is forbidden');

  const nodeLabels = [
    ...nodes.map((node) => node.text),
    ...[...(model.states?.values() ?? [])].flatMap((state) => state.descriptions),
    ...[...(model.entities?.values() ?? [])].map((entity) => entity.alias || entity.label),
    ...(model.periods ?? []).flatMap((period) => [period.text, ...period.events]),
  ];
  const edgeLabels = [
    ...(model.edges ?? []).map((edge) => edge.text),
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
      rejectSemicolon(label, text);
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

function embeddedSvg(svg) {
  // Rewrite only an inline stroke declaration. Keep Pele's theme fallbacks and label text.
  return svg.replace(/(<[^<>]*\sstyle=")([^"]*)"/g, (_, opening, style) =>
    `${opening}${style.replace(/(^|;)stroke:#5b7bd5(?=;|$)/g, '$1stroke:var(--_c)')}"`);
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
      const type = sourceRules(block.source, options.extraType);
      const warnings = checkModel(type, parseDiagram(pele, block.source, type), options.overview && index === 0);
      const digest = sha256(block.source);
      const id = `mermaid-${number}-${digest.slice(0, 12)}`;
      const { svg, width } = pele.render(block.source, { idPrefix: id });
      const labelSize = 16 * Math.min(1, TARGET_WIDTH / width);
      if (labelSize < MIN_LABEL_SIZE) {
        throw new Error(`label size ${labelSize.toFixed(3)}px is below ${MIN_LABEL_SIZE}px at ${TARGET_WIDTH}px; restructure the view`);
      }
      for (const warning of warnings) console.warn(`${where}: warning: ${warning}`);
      views.push({ where, type, width, digest, id, svg });
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
    for (const { where, type, width, digest, id, svg } of views) {
      let svgProof = '';
      if (options.svgDir) {
        const path = `${options.svgDir}/${id}.svg`;
        const output = embeddedSvg(svg);
        await Bun.write(path, output);
        svgProof = `; SVG sha256=${sha256(output)} ${path}`;
      }
      console.log(`${where}: ${type} ${width}px; Pele ${PELE_VERSION}; source sha256=${digest}${svgProof}`);
    }
  } catch (error) {
    console.error(`SVG output: ${error.message}`);
    return 1;
  }
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
