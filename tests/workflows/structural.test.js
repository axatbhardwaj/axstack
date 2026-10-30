import { test, expect } from 'bun:test';
import { isVendored } from './vendored-paths.js';
import { publicDocPaths } from './public-docs.js';
// Filesystem access uses the approved narrow exception: node:fs and
// node:fs/promises are Bun-implemented built-ins. No Node.js runtime is
// required. Path/URL handling below is local (import.meta.dir), not node:.
import { readFileSync, existsSync, lstatSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { loadedReferences, requires, sentences } from './prose-contract.js';

const SEP = '/';

function splitSegs(p) {
  return p.split('/').filter((s) => s !== '');
}

function normalizeSegs(segs) {
  const out = [];
  for (const s of segs) {
    if (s === '.' || s === '') continue;
    else if (s === '..') out.pop();
    else out.push(s);
  }
  return out;
}

// Local join for known repo-relative paths (normalizes like path.join).
function join(...parts) {
  const absolute = parts.length > 0 && parts[0].startsWith('/');
  return (absolute ? '/' : '') + normalizeSegs(parts.flatMap(splitSegs)).join('/');
}

function dirname(p) {
  const clean = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  const i = clean.lastIndexOf('/');
  if (i < 0) return '.';
  if (i === 0) return '/';
  return clean.slice(0, i);
}

// Local resolve for a base dir plus a relative link target (handles ../).
function resolve(from, rel) {
  if (rel.startsWith('/')) return '/' + normalizeSegs(splitSegs(rel)).join('/');
  return join(from, rel);
}

const here = import.meta.dir;
const root = dirname(dirname(here));
const skillsDir = join(root, 'skills');
const skillMarkdownFiles = readdirSync(skillsDir, { recursive: true })
  .filter((p) => p.endsWith('.md'))
  .map((p) => join(skillsDir, p));

const EXPECTED_SKILLS = [
  'axstack-verify',
  'axstack-perf',
  'axstack-correct',
  'axstack-align',
  'axstack-brainstorm',
  'axstack-cleanup',
  'axstack-spec',
  'axstack-tickets',
  'axstack-implement',
  'axstack-review',
  'axstack-watch',
  'axstack-scout',
];

// Standalone phases callable directly; each must explicitly load shared contracts.
const STANDALONE_PHASES = [
  'axstack-correct',
  'axstack-align',
  'axstack-brainstorm',
  'axstack-cleanup',
  'axstack-spec',
  'axstack-tickets',
  'axstack-implement',
  'axstack-review',
  'axstack-watch',
  'axstack-scout',
];

// NOTE: structural checks only. They verify packaging, not instruction-following behavior.

// Only this named pattern list is excluded from the active-reference scan.
const RETIRED_REFERENCES = {
  runtime: /orca/i,
  anatomyGeometry: /\bmotorCable(?:Bridge|Rim)\b/g,
  predecessor: /paseo/i,
  legacyConstant: /^export const LEGACY_ROUTING_PATTERN = [^\n]+;$/m,
  history: /^[ \t]*#{1,6}[ \t]+rollback\b|^[ \t]*rollback[ \t]*\r?\n[ \t]*[-=]+[ \t]*$|0\.20\.31|Orca|Historical[ \t-]+migration|Paseo[^.]*cutover|retired.skill migration/im,
  installerFixtures: [
    'expect(block).not.toMatch(/model|opus|claude|codex|orca/i);',
    "const legacy = 'Route all reviewers and writers through Orca orchestration.';",
    "expect(findLegacyRoutingLines('Orca is installed for rollback.')).toEqual([]);",
    "const original = 'Use Orca orchestration via the orca CLI for every delegated worker.\\n';",
    "const original = 'Use Orca orchestration via the orca CLI for every delegated worker.\\nKeep my personal rules.\\n';",
  ],
};

const activePaths = ['skills', 'src', 'bin', 'profiles', 'tests', 'AGENTS.md', 'package.json'];

function activeReferences(base) {
  const violations = [];
  const scan = (path) => {
    const absolute = join(base, path);
    if (!existsSync(absolute)) return;
    if (RETIRED_REFERENCES.runtime.test(path)) violations.push(`${path}: filename`);
    if (lstatSync(absolute).isDirectory()) {
      for (const name of readdirSync(absolute)) scan(`${path}/${name}`);
      return;
    }
    let text = readFileSync(absolute, 'utf8');
    // Pinned anatomy geometry identifiers are unrelated to the retired runtime.
    if (isVendored(path) && path === 'skills/axstack-anatomy/examples/ripple-tank/build.mjs') {
      text = text.replace(RETIRED_REFERENCES.anatomyGeometry, 'motorHarness');
    }
    if (path === 'src/instructions.js') text = text.replace(RETIRED_REFERENCES.legacyConstant, '');
    if (path === 'tests/installer/instructions.test.js') {
      text = text.split('\n').filter((line) => !RETIRED_REFERENCES.installerFixtures.includes(line.trim())).join('\n');
    }
    if (path === 'tests/workflows/structural.test.js') {
      text = text.replace(/^const RETIRED_REFERENCES = \{[\s\S]*?^\};/m, '');
    }
    if (RETIRED_REFERENCES.runtime.test(text)) violations.push(`${path}: content`);
  };
  for (const path of [...activePaths, ...publicDocPaths(base)]) scan(path);
  return violations;
}

test('structural: active paths contain no retired runtime dependency or routing', () => {
  expect(activeReferences(root)).toEqual([]);
});

test('structural: reference guard covers content, filenames, and narrow exemptions', () => {
  const fixture = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/t7-guard-`);
  const put = (path, text) => {
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    writeFileSync(join(fixture, path), text);
  };
  const retired = RETIRED_REFERENCES.runtime.source;
  try {
    for (const path of ['skills/probe.md', 'src/probe.js', 'bin/probe.js',
      'profiles/probe.json', 'tests/probe.js', 'docs/new-guide.md', ...activePaths.slice(5), ...publicDocPaths(root)]) {
      put(path, `Route through ${retired.toUpperCase()}.`);
      expect(activeReferences(fixture), path).toEqual([`${path}: content`]);
      writeFileSync(join(fixture, path), 'T3');
    }
    for (const directory of activePaths.slice(0, 5)) {
      const path = `${directory}/${retired}-runtime.md`;
      put(path, 'T3');
      expect(activeReferences(fixture), path).toEqual([`${path}: filename`]);
      rmSync(join(fixture, path));
    }
    put('src/instructions.js', `export const LEGACY_ROUTING_PATTERN = /${retired}/i;`);
    put('tests/installer/instructions.test.js', RETIRED_REFERENCES.installerFixtures.join('\n'));
    put('tests/workflows/structural.test.js', `const RETIRED_REFERENCES = {\n  runtime: /${retired}/i,\n};`);
    put('docs/installation.md', `# Installation\nT3\n## Rollback\nReinstall ${retired}.\n## Examples\nT3`);
    put(`docs/specs/${retired}.md`, retired);
    put(`docs/plans/${retired}.md`, retired);
    expect(activeReferences(fixture)).toEqual(['docs/installation.md: content']);
    put('docs/installation.md', '# Installation\nT3');
    expect(activeReferences(fixture)).toEqual([]);
    for (const path of ['src/instructions.js', 'tests/installer/instructions.test.js',
      'tests/workflows/structural.test.js', 'docs/installation.md']) {
      const original = readFileSync(join(fixture, path), 'utf8');
      writeFileSync(join(fixture, path), `${original}\nUse ${retired} for routing.`);
      expect(activeReferences(fixture), path).toEqual([`${path}: content`]);
      writeFileSync(join(fixture, path), original);
    }
    const anatomyPath = 'skills/axstack-anatomy/examples/ripple-tank/build.mjs';
    const geometry = readFileSync(join(root, anatomyPath), 'utf8');
    put(anatomyPath, geometry);
    expect(activeReferences(fixture)).toEqual([]);
    put(anatomyPath, `${geometry}\nUse ${retired} for routing.`);
    expect(activeReferences(fixture)).toEqual([`${anatomyPath}: content`]);
  } finally {
    rmSync(fixture, { recursive: true });
  }
});

test('structural: public docs exclude removed history narratives', () => {
  for (const path of publicDocPaths(root)) {
    const text = readFileSync(join(root, path), 'utf8');
    expect(text, path).not.toMatch(RETIRED_REFERENCES.history);
    for (const narrative of ['Rollback to v0.20.31', 'Historical migration',
      `${RETIRED_REFERENCES.predecessor.source} cutover`, 'retired-skill migration',
      '## Rollback', 'Rollback\n--------',
      '## Rollback\n\n1. Reinstall `axstack@0.20.31` (v0.20.31) on desktop and VPS.',
      'Reinstall `axstack@0.20.31` (v0.20.31) on desktop and VPS.',
      '## Historical   migration']) {
      expect(`${text}\n${narrative}`, path).toMatch(RETIRED_REFERENCES.history);
    }
    expect(`${text}\nUpgrading and legacy cleanup`, path).not.toMatch(RETIRED_REFERENCES.history);
  }
});

test('structural: skill Markdown excludes the retired predecessor', () => {
  for (const path of skillMarkdownFiles) {
    expect(readFileSync(path, 'utf8'), path).not.toMatch(RETIRED_REFERENCES.predecessor);
  }
});

test('structural: public guidance identifies T3 and qualifies runtime evidence', () => {
  const docs = ['README.md', 'docs/installation.md', 'docs/workflows.md']
    .map((path) => readFileSync(join(root, path), 'utf8'));
  const activeRuntime = (text) => requires(text, /T3 Code/i, /only supported active runtime/i);
  for (const text of docs) {
    expect(activeRuntime(text)).toBe(true);
    const matching = sentences(text).filter(activeRuntime);
    expect(activeRuntime(sentences(text).filter((sentence) => !matching.includes(sentence)).join('. '))).toBe(false);
  }
  expect(activeRuntime('The only supported active runtime is T3 Code.')).toBe(true);
  expect(activeRuntime('T3 Code is not the only supported active runtime.')).toBe(false);
  expect(docs.join('\n')).toMatch(/compatib[^.]*unverified|unverified[^.]*compatib/i);
  expect(docs.join('\n')).toMatch(/mobile[^.]*unverified|unverified[^.]*mobile/i);
});

test('structural: host operations records current setup requirements', () => {
  const installation = readFileSync(join(root, 'docs/installation.md'), 'utf8').replace(/\s+/g, ' ');
  const host = readFileSync(join(root, 'docs/host-operations.md'), 'utf8').replace(/\s+/g, ' ');
  expect(installation).toContain('0.1.0');
  expect(host).toContain('t3 serve --tailscale-serve');
  expect(host).toContain('t3 pair');
  for (const [concepts, holdout] of [
    [[/hosts/i, /can delete author worktrees/i, /merge/i, /storageCleanup\.worktreeOnMerge/], 'Hosts can delete author worktrees at merge using storageCleanup.worktreeOnMerge.'],
    [[/Grok CLI/i, /(?:>=|≥)1\.0\.13/], 'Grok CLI must be >=1.0.13.'],
  ]) {
    const accepts = (text) => requires(text, ...concepts);
    expect(accepts(host)).toBe(true);
    expect(accepts(holdout)).toBe(true);
    expect(accepts(`Do not follow this instruction: ${holdout}`)).toBe(false);
    const matching = sentences(host).filter(accepts);
    expect(accepts(sentences(host).filter((sentence) => !matching.includes(sentence)).join('. '))).toBe(false);
  }

});

test('structural: shared root has no entry file and all expected phase skills exist', () => {
  expect(existsSync(join(skillsDir, 'axstack', 'SKILL.md'))).toBe(false);
  for (const name of EXPECTED_SKILLS) {
    const p = join(skillsDir, name, 'SKILL.md');
    expect(existsSync(p), `missing ${p}`).toBeTruthy();
    expect(lstatSync(p).isSymbolicLink(), `SKILL.md must not be a symlink: ${p}`).toBe(false);
  }
});

test('structural: skill frontmatter is parseable with name and description', () => {
  for (const name of EXPECTED_SKILLS) {
    const p = join(skillsDir, name, 'SKILL.md');
    const text = readFileSync(p, 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    expect(m, `${name}: missing YAML frontmatter block`).toBeTruthy();
    expect(m[1], `${name}: frontmatter needs name`).toMatch(/^name:\s*\S+/m);
    expect(m[1], `${name}: frontmatter needs description`).toMatch(/^description:\s*\S+/m);
  }
});

test('structural: skills stay self-contained (no absolute paths or upstream deps)', () => {
  const forbidden = [
    '/home/',
    '/Users/',
    'C:\\',
    '~/.agents',
    'matt-pocock',
    'poteto',
    'haoshoku',
  ];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isSymbolicLink()) throw new Error(`escaping symlink not allowed: ${p}`);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const text = readFileSync(p, 'utf8');
        // D3 permits this attribution link, not an upstream skill dependency.
        // Strip only that link on the diagram credit line; keep every other
        // byte in the guard, including any additional upstream reference.
        let guarded = p === join(skillsDir, 'axstack-explain', 'SKILL.md')
          ? text.replace(/^(Ideas: .*?)\[poteto\]\(https:\/\/github\.com\/poteto\/how\)(.*; guidance uses Axstack's own words\.)$/m, '$1$2')
          : text;
        // AC12 requires this pinned credit; preserve the upstream-dependency guard elsewhere.
        if (p === join(skillsDir, 'axstack', 'references', 'perf-loop.md')) {
          const credit = "Ideas paraphrased from pstack's perf-issue and hillclimb\n"
            + '[playbooks](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/poteto-mode/playbooks/) (MIT).';
          guarded = guarded.replace(credit, 'Pinned pstack credit (MIT).');
        }
        // The approved account-local config interface names a directory;
        // it grants no dependency on a separate repository or personal policy.
        if ([join(skillsDir, 'axstack', 'scripts', 'fleet-route-cli.js'),
          join(skillsDir, 'axstack', 'references', 'fleet-route-schema.md')].includes(p)) {
          guarded = guarded.replaceAll('.config/haoshoku/fleet-routing.json', 'account-local-config');
        }
        for (const f of forbidden) {
          expect(guarded.includes(f), `${p} contains forbidden reference: ${f}`).toBe(false);
        }
      }
    }
  };
  walk(skillsDir);
});

test('structural: relative references resolve to real files inside the bundle', () => {
  const bundleRoot = skillsDir + SEP;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.md')) {
        const text = readFileSync(p, 'utf8');
        const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((x) => x[1]);
        for (const link of links) {
          if (/^(https?:|#|mailto:)/.test(link)) continue;
          const rel = link.split('#')[0];
          if (!rel) continue;
          const target = resolve(dirname(p), rel);
          expect(
            target === skillsDir || target.startsWith(bundleRoot),
            `${p}: link escapes bundle: ${link}`,
          ).toBeTruthy();
          expect(existsSync(target), `${p}: linked file does not exist: ${link}`).toBeTruthy();
        }
      }
    }
  };
  walk(skillsDir);
});

test('structural: standalone phases explicitly load shared references', () => {
  for (const name of STANDALONE_PHASES) {
    const text = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    expect(
      name === 'axstack-correct'
        ? loadedReferences(text).includes('../axstack/references/contracts.md')
        : text.includes('../axstack/references/'),
      `${name}: must explicitly load shared axstack reference(s)`,
    ).toBeTruthy();
  }
  for (const ref of ['t3-runtime.md', 'contracts.md']) {
    expect(
      existsSync(join(skillsDir, 'axstack', 'references', ref)),
      `missing shared reference skills/axstack/references/${ref}`,
    ).toBeTruthy();
  }
});

test('structural: docs/workflows.md exists and references phase skills', () => {
  const p = join(root, 'docs', 'workflows.md');
  expect(existsSync(p), 'missing docs/workflows.md').toBeTruthy();
  const text = readFileSync(p, 'utf8');
  for (const name of EXPECTED_SKILLS) {
    expect(text.includes(name), `docs/workflows.md must reference ${name}`).toBeTruthy();
  }
});
