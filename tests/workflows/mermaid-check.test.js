import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';

const checker = `${import.meta.dir}/../../skills/axstack/scripts/mermaid-check.js`;
const fixtures = `${import.meta.dir}/fixtures/mermaid`;
const guide = `${import.meta.dir}/../../skills/axstack-explain/references/mermaid.md`;
const scratch = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/axstack-mermaid-test-`);
afterAll(() => rmSync(scratch, { recursive: true }));

const flow = `---
config:
  flowchart:
    nodeSpacing: 90
    rankSpacing: 110
    curve: step
---
flowchart TB
  accTitle: Review
  accDescr: The author sends PR #263 to the reviewer.
  classDef accent stroke:#5b7bd5,stroke-width:2px
  A["PR #263"] --> B[Review]:::accent
`;
const sequence = `---
config:
  sequence:
    actorMargin: 80
    messageMargin: 48
---
sequenceDiagram
  accTitle: Review request
  accDescr: The author requests a review.
  A->>B: Review PR #263
`;
const tier = flow.replace('  A["PR #263"] --> B[Review]:::accent', [
  '  subgraph Review [Review tier]',
  '    A[Driver] --> B[Reviewer]:::accent',
  '  end',
].join('\n'));

const fenced = (source) => ['```mermaid', source.trimEnd(), '```', ''].join('\n');

const sha256 = (source) => new Bun.CryptoHasher('sha256').update(source).digest('hex');

function cli(...args) {
  const result = Bun.spawnSync([process.execPath, '--no-env-file', checker, ...args]);
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}

test('checks all nine flowchart views and reports the dense ELK overview limit', () => {
  const { code, out, err } = cli('--overview', `${fixtures}/ga-v10.md`);
  expect(code, err).toBe(0);
  expect(out.match(/block \d+.*flowchart/g)).toHaveLength(9);
  expect(out).toMatch(/block 1.*dense ELK overview: needs zoom\/pan in chat; geometry not measured \(pinned pele ignores ELK\)/);
});

test('checks the guide examples with the overview policy', () => {
  const { code, err } = cli('--overview', guide);
  expect(code, err).toBe(0);
});

async function check(name, source, ...args) {
  const path = `${scratch}/${name}`;
  await Bun.write(path, source);
  return cli(...args, path);
}

test('checks Markdown fences and ignores a literal example inside a different fence', async () => {
  const nested = sequence.trimEnd().split('\n').map((line) => `   ${line}`).join('\n');
  const source = [
    '````text', '```mermaid', 'invalid fixture', '```', '````', '',
    '````mermaid', flow.trimEnd(), '````', '',
    '1. ~~~mermaid', nested, '   ~~~', '',
  ].join('\n');
  const { code, out, err } = await check('views.md', source);
  expect(err).toBe('');
  expect(code).toBe(0);
  expect(out).toMatch(/block 1.*line 7.*flowchart/);
  expect(out).toMatch(/block 2.*line 22.*sequenceDiagram/);
  expect(out).toContain(sha256(flow));
  expect(out).toContain(sha256(sequence));
});

test('accepts supported raw styles and title-only frontmatter on the other diagram types', async () => {
  const examples = [
    ['flowchart', flow.replace('config:', 'title: Review\nconfig:')],
    ['sequence', sequence],
    ['stateDiagram-v2', '---\ntitle: State\n---\nstateDiagram-v2\naccTitle: State\naccDescr: Starts.\n[*] --> Active: (planned)\n'],
    ['erDiagram', 'erDiagram\naccTitle: Orders\naccDescr: Orders contain items.\nORDER ||--o{ ITEM : "contains (unknown)"\n'],
    ['timeline', 'timeline\naccTitle: Dates\naccDescr: Release date.\n2026 : Release (planned)\n'],
  ];
  for (const [name, source] of examples) {
    const { code, out, err } = await check(`${name}.mmd`, source);
    expect(err, name).toBe('');
    expect(out, name).toMatch(new RegExp(`block 1.*${name}`, 'i'));
    expect(code, name).toBe(0);
  }
});

const breaches = [
  ['accTitle', flow.replace(/ {2}accTitle:.*\n/, ''), /accTitle/],
  ['accDescr', flow.replace(/ {2}accDescr:.*\n/, ''), /accDescr/],
  ['init', `%%{init: {}}%%\n${flow}`, /init directive/],
  ['initialize', `%%{initialize: {}}%%\n${flow}`, /initialize directive/],
  ['theme', flow.replace('  flowchart:', '  theme: dark\n  flowchart:'), /theme key/],
  ['node-spacing', flow.replace('nodeSpacing: 90', 'nodeSpacing: 30'), /nodeSpacing.*40.*150/],
  ['rank-spacing', flow.replace('rankSpacing: 110', 'rankSpacing: 200'), /rankSpacing.*40.*150/],
  ['sequence-spacing', sequence.replace('messageMargin: 48', 'messageMargin: 40.5'), /messageMargin.*integer/],
  ['missing-spacing', flow.replace('    rankSpacing: 110\n', ''), /required.*rankSpacing|rankSpacing.*required/],
  ['unknown-config', flow.replace('    curve: step', '    padding: 90'), /unknown.*config.flowchart.padding/],
  ['non-elk', flow.replace('  flowchart:', '  layout: dagre\n  flowchart:'), /config.layout.*elk/],
  ['sequence-elk', sequence.replace('  sequence:', '  layout: elk\n  sequence:'), /config.layout.*flowchart/],
  ['curve', flow.replace('curve: step', 'curve: cardinal'), /curve.*step.*linear.*basis/],
  ['one-line-frontmatter', flow.replace(/config:[\s\S]*?\n---/, 'config: {flowchart: {nodeSpacing: 90, rankSpacing: 110, curve: step}}\n---'), /frontmatter.*multiline|multiline.*frontmatter/],
  ['misplaced-title', flow.replace('    nodeSpacing: 90', 'title: Review\n    nodeSpacing: 90'), /frontmatter/],
  ['missing-frontmatter', flow.slice(flow.indexOf('flowchart TB')), /frontmatter.*nodeSpacing|nodeSpacing.*frontmatter/],
  ['opaque-class-fill', flow.replace('stroke:#5b7bd5', 'fill:#abc,stroke:#5b7bd5'), /classDef.*fill.*transparent.*none/],
  ['opaque-node-fill', `${flow}style B fill:red\n`, /style.*fill.*transparent.*none/],
  ['class-property', flow.replace('stroke:#5b7bd5', 'color:#5b7bd5'), /classDef.*color.*forbidden/],
  ['inline-style-property', `${flow}A --> C; style C color:#abc\n`, /style.*color.*forbidden/],
  ['linkstyle', `${flow}linkStyle 0 stroke:red\n`, /linkStyle.*stroke.*forbidden/],
  ['accent', `${flow.replace('#5b7bd5', '#14b8a6')}style A stroke:orange\n`, /one accent hue/],
  ['accent-spread', `${flow.replace('#5b7bd5', '#ff0000')}style A stroke:#ff4c00\nstyle B stroke:#ff004c\n`, /one accent hue/],
  ['missing-status', `${flow.replace('B[Review]', 'B["Review (planned)"]')}classDef future stroke-dasharray:6 4\nclass A,B future\n`, /dashed class.*future.*A.*status word/],
  ['missing-default-status', `${flow}classDef default stroke-dasharray:6 4\n`, /dashed class.*default.*status word/],
  ['dashed-node-style', `${flow}style A stroke-dasharray:6 4\n`, /dashed style on A.*status word.*node label/],
  ['dashed-subgraph-style', `${tier}style Review stroke-dasharray:6 4\n`, /dashed style on Review.*status word.*subgraph label/],
  ['dashed-subgraph-class', `${tier}classDef future stroke-dasharray:6 4\nclass Review future\n`, /dashed class future on Review.*status word.*subgraph label/],
  ['dashed-er-entity-style', 'erDiagram\naccTitle: Orders\naccDescr: One entity owns another.\nA ||--o{ B : owns\nstyle A stroke-dasharray:6 4\n',
    /dashed style on A.*status word.*node label/],
  ['dashed-er-subgraph-style', 'erDiagram\naccTitle: Orders\naccDescr: One entity owns another.\nsubgraph G [Review]\nA ||--o{ B : owns\nend\nstyle G stroke-dasharray:6 4\n',
    /dashed style on G.*status word.*subgraph label/],
  ['rect', `${sequence}rect rgb(0, 20, 60)\nA->>B: secret\nend\n`, /rect statement/],
  ['colored-box', `${sequence}box Aqua Review\nparticipant C\nend\n`, /colou?red box/],
  ['state-class', 'stateDiagram-v2\naccTitle: Review\naccDescr: Starts.\nclassDef planned stroke-dasharray:6 4\n[*] --> Review\n', /classDef.*stateDiagram-v2/],
  ['state-arrow', 'stateDiagram-v2\naccTitle: Review\naccDescr: Starts.\nOpen -.-> Review\n', /stateDiagram-v2.*-\.->/],
  ['timeline-class', 'timeline\naccTitle: Years\naccDescr: Dates.\nclassDef unknown stroke-dasharray:2 3\n2025 : Review\n', /classDef.*timeline/],
  ['sequence-class', `${sequence}classDef planned stroke-dasharray:6 4\n`, /classDef.*sequenceDiagram/],
  ['legibility', `${flow.replace('flowchart TB', 'flowchart LR')}B --> C[Reporting service] --> D[Long downstream service] --> E[Another external service]\n`, /12px at 860px.*restructure/i],
  ['node-semicolon', flow.replace('["PR #263"]', '[Queued; ready]'), /semicolon in node label.*comma or dash/],
  ['metadata-semicolon', `${flow}C@{label: Queued; ready, shape: rect}\n`, /semicolon in node label.*comma or dash/],
  ['edge-semicolon', flow.replace(' --> ', ' -->|Review; queue| '), /semicolon in edge label.*comma or dash/],
  ['inline-edge-semicolon', flow.replace(' --> ', ' -- Review; style guide --> '), /semicolon in edge label.*comma or dash/],
  ['message-semicolon', sequence.replace('Review PR #263', 'Review; queue'), /semicolon in sequence message.*comma or dash/],
  ['quote-server-alias', sequence.replace('  A->>B:', '  participant A as Quote server (planned; key held here)\n  A->>B:'),
    /semicolon in participant alias.*move status to message text/],
  ['quoted-alias-semicolon', sequence.replace('  A->>B:', '  participant A as "Quote; participant B"\n  A->>B:'),
    /semicolon in participant alias.*move status to message text/],
  ['alias-parentheses', sequence.replace('  A->>B:', '  participant A as Quote server (planned)\n  A->>B:'),
    /brackets or parentheses in participant alias.*move status to message text/],
  ['alias-brackets', sequence.replace('  A->>B:', '  actor A as Quote server [unknown]\n  A->>B:'),
    /brackets or parentheses in participant alias.*move status to message text/],
  ['node-asterisk', flow.replace('["PR #263"]', '["Quote *"]'), /asterisk in flowchart node label.*✱/],
  ['edge-asterisk', flow.replace(' --> ', ' -->|cached *| '), /asterisk in flowchart edge label.*✱/],
  ['state-label-semicolon', 'stateDiagram-v2\naccTitle: Review\naccDescr: Starts.\nstate "Review; queue" as R\n[*] --> R\n',
    /semicolon in node label.*comma or dash/],
  ['state-transition-semicolon', 'stateDiagram-v2\naccTitle: Review\naccDescr: Starts.\n[*] --> R: Review; queue\n',
    /semicolon in edge label.*comma or dash/],
  ['er-label-semicolon', 'erDiagram\naccTitle: Review\naccDescr: Starts.\nA ||--o{ B : "Review; queue"\n',
    /semicolon in edge label.*comma or dash/],
  ['timeline-label-semicolon', 'timeline\naccTitle: Review\naccDescr: Starts.\n2026 : Review; queue\n',
    /semicolon in node label.*comma or dash/],
  ['type', 'gantt\naccTitle: Schedule\naccDescr: Dates.\n', /diagram type/],
];

for (const [name, source, rule] of breaches) {
  test(`fails with the named ${name} rule`, async () => {
    const { code, err } = await check(`${name}.mmd`, source);
    expect(err).toMatch(rule);
    expect(code).toBe(1);
  });
}

test('allows calm styles, different accents and optional curves', async () => {
  const teal = tier.replace('#5b7bd5', '#14b8a6').replace('    curve: step\n', '').replace('nodeSpacing: 90', 'nodeSpacing: 40')
    .replace('rankSpacing: 110', 'rankSpacing: 150')
    .replace('A[Driver]', 'A["Driver; ready"]:::accent')
    .replace('--> B[Reviewer]:::accent', '-->|"E1; review"| B["Reviewer (partial)"]:::accent')
    .replace('accTitle: Review', 'accTitle: Review; intake')
    .replace('accDescr: The author', 'accDescr: Review; the author');
  const source = `${teal}B -.->|E2| C[Summary]:::accent\nclassDef future fill:none,stroke-dasharray:8 3 2 3\nclass B future\n`
    + 'style Review fill:transparent,stroke:#8a909b,stroke-width:1.5px\n'
    + 'style C stroke:#15b7b0\nlinkStyle default stroke-width:2px\nlinkStyle 0,1 stroke-width:3px\n';
  const result = await check('calm-styles.mmd', source);
  expect(result.code, result.err).toBe(0);
  const blue = `${flow.replace('A["PR #263"]', 'A["PR #263"]:::accent')}B --> C:::accent\n`;
  const wrappedHue = `${flow.replace('#5b7bd5', '#ff001a')}style A stroke:#ff1a00\n`;
  for (const [name, chart] of [['blue', blue], ['red-across-zero', wrappedHue]]) {
    const accepted = await check(`${name}.mmd`, chart);
    expect(accepted.code, accepted.err).toBe(0);
  }
});

test('accepts status in the visible labels of styled nodes and subgraphs', async () => {
  const source = tier.replace('A[Driver]', 'A["Driver (retiring)"]')
    .replace('Review [Review tier]', 'Review ["Review tier (partial)"]');
  const result = await check('dashed-labels.mmd',
    `${source}style A stroke-dasharray:6 4\nstyle Review stroke-dasharray:2 3\n`);
  expect(result.code, result.err).toBe(0);
});

test('uses the punctuation rules for quoted metadata labels and multiline accessibility text', async () => {
  const source = flow.replace(/ {2}accDescr:.*\n/, '  accDescr {Review; grouped\n    style B color:red\n  }\n')
    + 'C@{label: "Queued; ready", shape: rect}\n';
  const accepted = await check('accessibility.mmd', source);
  expect(accepted.code, accepted.err).toBe(0);
  const rejected = await check('accessibility-style.mmd', source.replace('  }\n', '  }; style B color:red\n'));
  expect(rejected.err).toMatch(/style.*color.*forbidden/);
  expect(rejected.code).toBe(1);
});

test('keeps timeline direction for longer diagrams', async () => {
  const timeline = 'timeline\naccTitle: Years\naccDescr: Dates.\n'
    + Array.from({ length: 5 }, (_, index) => `${2020 + index} : Stage ${index}`).join('\n') + '\n';
  const horizontal = await check('horizontal.mmd', timeline);
  expect(horizontal.err).toMatch(/timeline TD.*more than 4 periods/);
  expect(horizontal.code).toBe(1);
  const vertical = await check('vertical.mmd', timeline.replace('timeline', 'timeline TD'));
  expect(vertical.err).toBe('');
  expect(vertical.code).toBe(0);
});

test('accepts only the explicitly allowed extra diagram type', async () => {
  const pie = 'pie\naccTitle: Mix\naccDescr: Group totals.\n"One" : 1\n"Two" : 2\n';
  const allowed = await check('pie.mmd', pie, '--allow-type', 'pie');
  expect(allowed.code).toBe(0);
  expect(allowed.out).toMatch(/block 1.*pie/);
  const other = await check('pie.mmd', pie, '--allow-type', 'gantt');
  expect(other.err).toMatch(/unsupported diagram type: pie/);
  expect(other.code).toBe(1);
});

test('keeps styling words and hex-like tokens in labels', async () => {
  const source = flow.replace('["PR #263"]', '[PR #263, style guide]');
  const result = await check('label.mmd', source);
  expect(result.code).toBe(0);
  expect(result.err).toBe('');
});

test('keeps punctuation used by shapes, statement separators and sequence message status', async () => {
  const flowSource = `${flow.replace('["PR #263"]', '["Quote ✱"]').replace('B[Review]', 'B[(Review)]')}A --> B; C[Label #42;] --> D{{Route}}\n`;
  const sequenceSource = sequence.replace('  A->>B:', '  participant A as Quote server; actor B as Reviewer\n  A->>B:')
    .replace('Review PR #263', 'Review (planned) [pending]; B-->>A: Confirmed');
  for (const [name, source] of [['shapes', flowSource], ['statements', sequenceSource]]) {
    const result = await check(`${name}.mmd`, source);
    expect(result.err).toBe('');
    expect(result.code).toBe(0);
  }
});

test('reports the Markdown source line on a parse failure', async () => {
  const source = ['# Review', '', '```mermaid', flow.trimEnd(), 'A[unclosed --> C', '```', ''].join('\n');
  const { code, err } = await check('parse.md', source);
  expect(err).toMatch(/block 1 \(line 3\).*parse.*line 16/i);
  expect(code).toBe(1);
});

test('density warnings are advisory when the view fits', async () => {
  const nodes = Array.from({ length: 9 }, (_, index) => `n${index} --> n${index + 1}`).join('\n');
  const { code, err } = await check('dense.mmd', `${flow}${nodes}\n`);
  expect(err).toMatch(/warning.*nodes.*split/i);
  expect(code).toBe(0);
});

test('allows a diagram wider than the old 960px cap if labels stay at least 12px', async () => {
  const mid = flow.replace('flowchart TB', 'flowchart LR').replace('A["PR #263"] --> B[Review]:::accent',
    'A[Component number 0] --> B[Component number 1]:::accent --> C[Component number 2] --> D[Component number 3]');
  const result = await check('legible.mmd', mid);
  expect(result.code).toBe(0);
  expect(result.out).toMatch(/flowchart (?:10\d{2}|11[0-3]\d|114[0-6])(?:\.\d+)?px/);
});

test('requires a TB flowchart with a subgraph as the first overview block', async () => {
  const options = ['--overview'];
  const valid = await check('overview.md', fenced(tier) + fenced(sequence), ...options);
  expect(valid.code).toBe(0);
  expect(valid.out).toMatch(/block 2.*sequenceDiagram/);
  const candidates = [
    ['missing', '# No diagrams', /overview.*block 1/i],
    ['zoom-first', fenced(sequence) + fenced(tier), /overview.*flowchart TB/],
    ['lr', fenced(tier.replace('flowchart TB', 'flowchart LR')), /overview.*flowchart TB/],
    ['lr-elk', fenced(tier.replace('flowchart TB', 'flowchart LR').replace('config:', 'config:\n  layout: elk')), /overview.*flowchart TB/],
    ['no-tier', fenced(flow), /overview.*subgraph/],
  ];
  for (const [name, source, rule] of candidates) {
    const result = await check(`${name}.md`, source, ...options);
    expect(result.err, name).toMatch(rule);
    expect(result.code, name).toBe(1);
  }
});

test('applies legibility to zoom-ins too', async () => {
  const zoom = `${flow.replace('flowchart TB', 'flowchart LR')}B --> C[Reporting service] --> D[Long downstream service] --> E[Another external service]\n`;
  for (const [name, chart] of [['wide', zoom], ['wide-elk', zoom.replace('config:', 'config:\n  layout: elk')]]) {
    const result = await check(`${name}-zoom.md`, fenced(tier) + fenced(chart), '--overview');
    expect(result.err).toMatch(/block 2.*12px at 860px.*restructure/i);
    expect(result.code).toBe(1);
  }
});

test('warns about crowded overview tiers and long overview names without the detail density prompts', async () => {
  const dense = tier.replace('  end\n', [
    '    B --> C["Review service regional queue"] --> D --> E --> F',
    '  end',
    '  subgraph Outcomes',
    '    G --> H --> I --> J',
    '  end',
    '  F --> G',
    '  A --> B',
    '  B --> C',
    '  C --> D',
    '  D --> E',
    '',
  ].join('\n'));
  const result = await check('crowded.mmd', dense, '--overview');
  expect(result.code).toBe(0);
  expect(result.err).toMatch(/warning:.*Review.*6 direct nodes/);
  expect(result.err).toMatch(/warning:.*overview label.*Review service regional queue/);
  expect(result.err).not.toMatch(/(?:10 nodes|1[3-9] edges) exceeds/);
  const idealTier = dense.replace(' --> F', '').replace('  F --> G', '  E --> G')
    .replace('Review service regional queue', 'Review queue (planned)');
  const ideal = await check('ideal.mmd', idealTier, '--overview');
  expect(ideal.code, ideal.err).toBe(0);
  expect(ideal.err).toBe('');
});

test('expects a diagram by default and permits explicitly optional Markdown', async () => {
  const { code, err } = await check('plain.md', '# No diagram\n');
  expect(err).toMatch(/no Mermaid fences/i);
  expect(code).toBe(1);
  expect((await check('optional.md', '# No diagram\n', '--no-expect')).code).toBe(0);
});

test('rejects an override with the wrong bytes before import', async () => {
  const wrong = `${scratch}/untrusted.js`;
  await Bun.write(wrong, 'console.log("override executed"); throw Error("override executed");');
  const { code, out, err } = await check('override.mmd', flow, '--pele', wrong);
  expect(err).toMatch(/renderer.*hash mismatch/i);
  expect(err + out).not.toContain('override executed');
  expect(code).toBe(3);
  const missing = await check('missing.mmd', flow, '--pele', `${scratch}/absent.js`);
  expect(missing.err).toMatch(/renderer.*missing/i);
  expect(missing.code).toBe(3);
});

test('exports deterministic SVGs with scoped accessibility ids and a theme-bound accent', async () => {
  const view = ['```mermaid', flow.trimEnd(), '```'].join('\n');
  const input = `${view}\n\n${view}\n`;
  const dir = `${scratch}/svg`;
  const path = `${scratch}/repeat.md`;
  const result = await check('repeat.md', input, '--svg-out', dir);
  expect(result.err).toBe('');
  expect(result.code).toBe(0);
  const names = readdirSync(dir).sort();
  expect(names).toHaveLength(2);
  const svgs = await Promise.all(names.map((name) => Bun.file(`${dir}/${name}`).text()));
  const ids = svgs.flatMap((svg) => {
    expect(svg).toContain('stroke:var(--_c)');
    expect(svg).not.toMatch(/style="(?:[^"]*;)?stroke:#5b7bd5(?=[;"])/);
    expect(svg).toContain('var(--pele-accent,#5b7bd5)');
    expect(result.out).toContain(sha256(svg));
    const refs = [...svg.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)].map((match) => match[1]);
    expect(refs).toHaveLength(2);
    for (const id of refs) expect(svg).toContain(`id="${id}"`);
    return refs;
  });
  expect(new Set(ids).size).toBe(4);
  expect(cli('--svg-out', dir, path)).toEqual(result);
});

test('exports teal accent strokes with the theme accent while preserving neutral strokes and labels', async () => {
  const chart = tier.replace('#5b7bd5', '#14B8A6').replace('A[Driver]', 'A["Driver #14B8A6"]');
  const source = `${chart}style A stroke:teal\nstyle Review stroke:#8a909b\n`;
  const dir = `${scratch}/teal-svg`;
  const result = await check('teal.mmd', source, '--svg-out', dir);
  expect(result.code, result.err).toBe(0);
  const [name] = readdirSync(dir);
  const svg = await Bun.file(`${dir}/${name}`).text();
  expect(svg.match(/stroke:var\(--_c\)/g)).toHaveLength(2);
  expect(svg).not.toMatch(/stroke:(?:#14b8a6|teal)(?=[;"])/i);
  expect(svg).toContain('stroke:#8a909b');
  expect(svg).toContain('Driver #14B8A6');
  expect(result.out).toContain(sha256(svg));
});

test('documents CLI switches and signals usage errors', () => {
  const { code, out } = cli('--help');
  expect(code).toBe(0);
  for (const term of ['Usage:', '--expect', '--no-expect', '--svg-out', '--pele', '--overview', '.mmd', 'Exit']) {
    expect(out).toContain(term);
  }
  expect(cli().code).toBe(2);
  expect(cli('--unknown').code).toBe(2);
});
