import { test, expect } from 'bun:test';
// Filesystem access uses the approved narrow exception: node:fs and
// node:fs/promises are Bun-implemented built-ins. No Node.js runtime is
// required. Path/URL handling below is local (import.meta.dir), not node:.
import { readFileSync, existsSync, lstatSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

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
  'axstack-align',
  'axstack-cleanup',
  'axstack-spec',
  'axstack-tickets',
  'axstack-implement',
  'axstack-review',
  'axstack-watch',
];

// Standalone phases callable directly; each must explicitly load shared contracts.
const STANDALONE_PHASES = [
  'axstack-align',
  'axstack-brainstorm',
  'axstack-cleanup',
  'axstack-spec',
  'axstack-tickets',
  'axstack-implement',
  'axstack-review',
  'axstack-watch',
];

// NOTE: structural checks only. They verify packaging, not instruction-following behavior.

// Only this named pattern list is excluded from the active-reference scan.
const RETIRED_REFERENCES = {
  runtime: /orca/i,
  predecessor: /paseo/i,
  legacyConstant: /^export const LEGACY_ROUTING_PATTERN = [^\n]+;$/m,
  rollbackAutomation: '6. Re-enable the Orca automation and verify its enabled state.',
  installerFixtures: [
    'expect(block).not.toMatch(/model|opus|claude|codex|orca/i);',
    "const legacy = 'Route all reviewers and writers through Orca orchestration.';",
    "expect(findLegacyRoutingLines('Orca is installed for rollback.')).toEqual([]);",
    "const original = 'Use Orca orchestration via the orca CLI for every delegated worker.\\n';",
    "const original = 'Use Orca orchestration via the orca CLI for every delegated worker.\\nKeep my personal rules.\\n';",
  ],
};

const activePaths = ['skills', 'src', 'bin', 'profiles', 'tests', 'README.md',
  'docs/workflows.md', 'docs/installation.md', 'AGENTS.md', 'package.json'];

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
    if (path === 'src/instructions.js') text = text.replace(RETIRED_REFERENCES.legacyConstant, '');
    if (path === 'tests/installer/instructions.test.js') {
      text = text.split('\n').filter((line) => !RETIRED_REFERENCES.installerFixtures.includes(line.trim())).join('\n');
    }
    if (path === 'tests/workflows/structural.test.js') {
      text = text.replace(/^const RETIRED_REFERENCES = \{[\s\S]*?^\};/m, '');
    }
    if (path === 'docs/installation.md') text = text.replace(/^## Rollback\n[\s\S]*?(?=^## |$(?![\s\S]))/m, '');
    if (RETIRED_REFERENCES.runtime.test(text)) violations.push(`${path}: content`);
  };
  for (const path of activePaths) scan(path);
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
      'profiles/probe.json', 'tests/probe.js', ...activePaths.slice(5)]) {
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
    expect(activeReferences(fixture)).toEqual([]);
    for (const path of ['src/instructions.js', 'tests/installer/instructions.test.js',
      'tests/workflows/structural.test.js', 'docs/installation.md']) {
      const original = readFileSync(join(fixture, path), 'utf8');
      writeFileSync(join(fixture, path), `${original}\nUse ${retired} for routing.`);
      expect(activeReferences(fixture), path).toEqual([`${path}: content`]);
      writeFileSync(join(fixture, path), original);
    }
  } finally {
    rmSync(fixture, { recursive: true });
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
  expect(docs.join('\n')).toMatch(/historical[^.]*Paseo|Paseo[^.]*historical/i);
  expect(docs.join('\n')).toMatch(/compatib[^.]*unverified|unverified[^.]*compatib/i);
  expect(docs.join('\n')).toMatch(/mobile[^.]*unverified|unverified[^.]*mobile/i);
});

test('structural: installation records setup and the ordered rollback boundary', () => {
  const installation = readFileSync(join(root, 'docs/installation.md'), 'utf8').replace(/\s+/g, ' ');
  expect(installation).toContain('0.0.46-nightly.20261003.2610');
  expect(installation).toContain('t3 serve --tailscale-serve');
  expect(installation).toContain('t3 pair');
  for (const [concepts, holdout] of [
    [[/worktreeCleanup/, /off/, /Axstack project/i], 'For each Axstack project, worktreeCleanup must be off.'],
    [[/Antigravity/i, /T3/i, /managed runtime/i, /sign.in/i], 'Use the T3 managed runtime for Antigravity and complete browser sign-in.'],
    [[/Grok CLI/i, /(?:>=|≥)1\.0\.13/], 'Grok CLI must be >=1.0.13.'],
  ]) {
    const accepts = (text) => requires(text, ...concepts);
    expect(accepts(installation)).toBe(true);
    expect(accepts(holdout)).toBe(true);
    expect(accepts(`Do not follow this instruction: ${holdout}`)).toBe(false);
    const matching = sentences(installation).filter(accepts);
    expect(accepts(sentences(installation).filter((sentence) => !matching.includes(sentence)).join('. '))).toBe(false);
  }
  let previous = -1;
  for (const pin of [
    '1. Reinstall `axstack@0.20.31` (v0.20.31) on desktop and VPS.',
    '2. Restore the backed-up `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` global instructions on both hosts.',
    '3. Set the recorded T3 manager schedule to `enabled:false` and verify the disabled state.',
    '4. Delete every armed run watch by its recorded schedule ID and verify absence.',
    '5. Stop and disable the `t3 serve` user service on the VPS.',
    RETIRED_REFERENCES.rollbackAutomation,
  ]) {
    const position = installation.indexOf(pin);
    expect(position, pin).toBeGreaterThan(previous);
    previous = position;
  }
  expect(installation).toMatch(/stays installed for one week after the VPS canary/i);
});

test('structural: shared root has no entry file and all six phase skills exist', () => {
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
        for (const f of forbidden) {
          expect(text.includes(f), `${p} contains forbidden reference: ${f}`).toBe(false);
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
      text.includes('../axstack/references/'),
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

test('structural: active PR parallelism has no fixed count', () => {
  const currentPolicyFiles = [
    ...skillMarkdownFiles,
    join(root, 'README.md'),
    join(root, 'docs', 'workflows.md'),
  ];
  const fixedTwoCap = /two active PRs|default (limit|is) .*two/i;
  for (const p of currentPolicyFiles) {
    expect(readFileSync(p, 'utf8'), `${p} retains a fixed two-PR cap`).not.toMatch(fixedTwoCap);
  }

  const contracts = readFileSync(join(skillsDir, 'axstack', 'references', 'contracts.md'), 'utf8');
  expect(contracts).toMatch(/no fixed active-PR count/i);
  expect(contracts).toMatch(/one T3 host\/server owns a run/i);
  expect(contracts).toMatch(/exactly one writer per candidate/i);
});

test('structural: shared PR-shape reference is complete and sole source of bands', () => {
  const p = join(skillsDir, 'axstack', 'references', 'pr-shape.md');
  const shape = readFileSync(p, 'utf8');
  expect(shape).toContain('git diff -M --numstat $(git merge-base <base> <head>)..<head>');
  expect(shape).toMatch(/actual PR base/i);
  expect(shape).toMatch(/stacked child[^.]*parent branch/i);
  expect(shape).toMatch(/root PR[^.]*actual target branch/i);
  expect(shape).toMatch(/main[^.]*example/i);
  expect(shape).toMatch(/additions\s*\+\s*deletions/i);
  expect(shape).toMatch(/moves.*-M|-M.*moves/i);
  expect(shape).toMatch(/binar[^.]*count[^.]*purpose/i);
  for (const bucket of ['generated', 'lockfile', 'formatter-only']) expect(shape).toContain(bucket);
  expect(shape).toMatch(/full total[^.]*controls? the (band|level)/i);
  expect(shape).toMatch(/reproducible recorded command/i);
  expect(shape).toMatch(/never\s+automatically subtract|never.*shift.*bands/i);
  expect(shape).toMatch(/silent exclusion[^.]*forbidden/i);
  for (const band of ['≤2000', '2001–2500', '>2500']) expect(shape).toContain(band);
  expect(shape).toMatch(/one (behavior|component)[^.]*callers[^.]*tests[^.]*types[^.]*docs[^.]*migrations/i);
  expect(shape).toMatch(/not a folder restriction/i);
  expect(shape).toMatch(/unrelated themes[^.]*split[^.]*under the target/i);
  expect(shape).toMatch(/smaller\s+cohesive\s+PRs[^.]*encouraged/i);
  expect(shape).toMatch(/no padding/i);

  const productionPolicyFiles = [
    ...skillMarkdownFiles.filter((file) => file !== p),
    join(root, 'README.md'),
    join(root, 'docs', 'workflows.md'),
    join(root, 'docs', 'specs', 'v1.md'),
    join(root, 'docs', 'plans', 'v1.md'),
  ];
  for (const file of productionPolicyFiles) {
    expect(readFileSync(file, 'utf8'), `${file} duplicates numeric PR-shape bands`)
      .not.toMatch(/≤2000|2001[–-]2500|>2500/);
  }
});

test('structural: shape levels require matching autonomous evidence and review', () => {
  const shape = readFileSync(join(skillsDir, 'axstack', 'references', 'pr-shape.md'), 'utf8');
  expect(shape).toMatch(/2001–2500[^.]*only[^.]*recorded cohesion rationale/i);
  expect(shape).toMatch(/>2500[^.]*full exception record/i);
  expect(shape).toMatch(/reasonable split/i);
  expect(shape).toMatch(/full total[^.]*bulk buckets[^.]*head[^.]*base/i);
  expect(shape).toMatch(/mandatory record[^.]*bulk buckets[^.]*reproducible command/i);
  expect(shape).toMatch(/split attempts[^.]*atomicity[^.]*green[^.]*reviewability/i);
  expect(shape).toMatch(/inseparable[^.]*reproducible bulk[^.]*dominates/i);
  expect(shape).toMatch(/size alone[^.]*never[^.]*user approval/i);
  expect(shape).toMatch(/already written[^.]*deadlines[^.]*rebase pain[^.]*not reasons/i);
  expect(shape).not.toMatch(/over-band/i);

  const review = readFileSync(join(skillsDir, 'axstack-review', 'SKILL.md'), 'utf8');
  expect(review).toMatch(/angle 6[^.]*recorded shape|recorded shape[^.]*angle 6/i);
  expect(review).toMatch(/mismatch[^.]*measured total[^.]*finding/i);
  expect(review).toMatch(/missing rationale[^.]*blocks approval/i);
  expect(review).toMatch(/judgment[^.]*measurement[^.]*split\s+failure[^.]*not[^.]*number/i);
  expect(review).toMatch(/bulk buckets[^.]*reproducible command/i);
  expect(review).toMatch(/weak rationale[^.]*author[^.]*(split|rework)/i);
  expect(review).toMatch(/rationale band[^.]*only[^.]*cohesion rationale/i);
  expect(review).toMatch(/exception\s+band[^.]*full\s+exception\s+record/i);
  expect(review).toMatch(/level[^.]*matching[^.]*measured total/i);
  expect(review).toMatch(/weak rationale[^.]*fix loop[^.]*never\s+(to\s+)?the\s+user/i);
  expect(review).not.toMatch(/over-band/i);
  expect(review).not.toMatch(/^\s*7\.\s/m);
});

test('structural: PR-shape callers carry planning, delivery, and audit evidence', () => {
  const callers = {
    contracts: readFileSync(join(skillsDir, 'axstack', 'references', 'contracts.md'), 'utf8'),
    lifecycle: readFileSync(join(skillsDir, 'axstack', 'references', 'lifecycle.md'), 'utf8'),
    tickets: readFileSync(join(skillsDir, 'axstack-tickets', 'SKILL.md'), 'utf8'),
    implement: readFileSync(join(skillsDir, 'axstack-implement', 'SKILL.md'), 'utf8'),
    review: readFileSync(join(skillsDir, 'axstack-review', 'SKILL.md'), 'utf8'),
    audit: readFileSync(join(skillsDir, 'axstack-audit', 'SKILL.md'), 'utf8'),
  };
  for (const [name, text] of Object.entries(callers)) {
    expect(text.includes('pr-shape.md'), `${name} must link the shared PR-shape reference`).toBeTruthy();
  }
  for (const name of ['contracts', 'tickets', 'implement', 'review', 'audit']) {
    expect(callers[name], `${name} must keep routine shape decisions autonomous`).toMatch(/autonomous[^.]*driver|driver[^.]*autonomous/i);
    expect(callers[name], `${name} must not escalate size alone`).toMatch(/size alone[^.]*never[^.]*user\s+approval/i);
  }
  expect(callers.contracts).toMatch(/fanout[^.]*dependency[^.]*capacity/i);
  expect(callers.contracts).toMatch(/resource[^.]*spending limits/i);
  expect(callers.contracts).toMatch(/one theme[^.]*measured size/i);
  expect(callers.contracts).toMatch(/unknown[^.]*never[^.]*telemetry prerequisite[^.]*blocker/i);
  expect(callers.tickets).toMatch(/Theme:\s*<[^>]+>/);
  expect(callers.tickets).toMatch(/Size est:\s*<[^>]+>/);
  expect(callers.tickets).toMatch(/coarse[^.]*ownership[^.]*interface[^.]*dependenc/i);
  expect(callers.tickets).toMatch(/exception band[^.]*assessed\s+for\s+a\s+split[^.]*mapping/i);
  expect(callers.tickets).toMatch(/split\s+where[^.]*green[^.]*atomic[^.]*reviewable/i);
  expect(callers.tickets).toMatch(/inseparable[^.]*coarse\s+planning\s+rationale[^.]*task/i);
  expect(callers.tickets).toMatch(/actual\s+measurement[^.]*exception\s+evidence[^.]*implement\s+receipt/i);
  expect(callers.tickets).toMatch(/mapping\s+time[^.]*no actual SHAs or line counts/i);
  expect(callers.implement).toContain('Shape: <total> lines vs base <sha>; bulk: <buckets>; theme: <one line>');
  expect(callers.implement).toMatch(/reviewed parent changes[^.]*hold reliance[^.]*stale child evidence[^.]*child merge readiness/i);
  expect(callers.implement).toMatch(/rebase[^.]*new parent revision[^.]*re-run[^.]*affected checks[^.]*remeasure shape/i);
  expect(callers.implement).toMatch(/size\s+growth alone[^.]*not an automatic hold/i);
  expect(callers.audit).toMatch(/PRs within band\s*\/\s*total PRs/i);
  expect(callers.audit).toMatch(/rationale\s+band[^.]*cohesion\s+rationale/i);
  expect(callers.audit).toMatch(/exception\s+band[^.]*full\s+driver exception\s+record/i);
  expect(callers.audit).toMatch(/level[^.]*matching[^.]*measured total/i);
  expect(callers.audit).not.toMatch(/over-band/i);
  expect(callers.audit).toMatch(/UNKNOWN[^.]*receipt lacks the measurement/i);
  expect(callers.audit).not.toMatch(/user[- ]exception|user receipt/i);
});

test('structural: public docs carry the current autonomous PR-shape policy', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const workflows = readFileSync(join(root, 'docs', 'workflows.md'), 'utf8');
  const spec = readFileSync(join(root, 'docs', 'specs', 'v1.md'), 'utf8');
  const plan = readFileSync(join(root, 'docs', 'plans', 'v1.md'), 'utf8');
  expect(readme).toContain('docs/workflows.md');
  for (const [name, text] of Object.entries({ workflows })) {
    expect(text.includes('pr-shape.md'), `${name} must link PR-shape policy`).toBeTruthy();
    expect(text, `${name} must state autonomous driver shape decisions`).toMatch(/autonomous[^.]*driver|driver[^.]*autonomous/i);
    expect(text, `${name} must state size alone does not require user approval`).toMatch(/size alone[^.]*never[^.]*user approval/i);
    expect(text, `${name} must distinguish rationale-band evidence`).toMatch(/rationale\s+band[^.]*cohesion\s+rationale/i);
    expect(text, `${name} must distinguish exception-band evidence`).toMatch(/exception\s+band[^.]*full\s+exception\s+record/i);
  }
  expect(spec).toMatch(/Amendment \(2026-09-14\)/);
  expect(spec).toMatch(/dependency- and capacity-driven/i);
  expect(spec).toContain('skills/axstack/references/pr-shape.md');
  expect(plan).toMatch(/\*\*Historical:\*\*/);
});

test('structural: runtime reference uses the advertised T3 schema and native identities', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 't3-runtime.md'), 'utf8');
  expect(requires(text, /driver/i, /T3 thread/i, /save/i, /orchestrator_capabilities/i, /JSON/i, /advertised tool schema/i)).toBe(true);
  for (const identity of ['taskId/childThreadId/childRunId', 'threadId/runId/worktree/branch/base SHA']) {
    expect(text).toContain(identity);
  }
});

test('structural: canonical preset profiles use valid modes and stable role IDs', () => {
  const ids = JSON.parse(readFileSync(join(root, 'profiles/presets/mixed.json'), 'utf8'))
    .roles.map(({ id }) => id);
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const data = JSON.parse(readFileSync(join(root, `profiles/presets/${preset}.json`), 'utf8'));
    expect(Object.keys(data)).toEqual(['version', 'roles']);
    expect(data.roles.map(({ id }) => id)).toEqual(ids);
    for (const prof of data.roles) {
      expect(prof.modeId).toBe(prof.provider === 'claude' ? 'bypassPermissions' : 'full-access');
      expect(prof.name).toBeTruthy();
      expect(prof.notes).toBeTruthy();
      expect('displayName' in prof).toBe(false);
    }
  }
});

test('structural: review receipt distinguishes verdicts with SHA, coverage, limitations', () => {
  const text = readFileSync(join(skillsDir, 'axstack-review', 'SKILL.md'), 'utf8');
  const blocks = [...text.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);
  const receipt = blocks.find(
    (b) => b.includes('APPROVE') && b.includes('REQUEST_CHANGES') && b.includes('INCOMPLETE'),
  );
  expect(receipt, 'review needs one receipt template containing all three verdicts').toBeTruthy();
  for (const field of ['sha', 'coverage', 'limitation']) {
    expect(receipt.toLowerCase().includes(field), `receipt template must include ${field}`).toBeTruthy();
  }
});

test('structural: runtime reference treats installed role snapshot as authoritative', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 't3-runtime.md'), 'utf8');
  expect(requires(text, /installed/i, /skills\/axstack\/roles.json/i, /snapshot/i, /preset/i, /stable role IDs/i)).toBe(true);
  expect(text).toContain('Bundled presets are setup inputs.');
  const normalized = text.replace(/\s+/g, ' ');
  expect(normalized).toContain("Resume preserves that snapshot with no re-resolution; changes require the user's explicit decision.");
  expect(normalized).toContain('A `model:null` role lacking a class must use the first model listed for its provider in saved capabilities only for grok and antigravity (launch-by-agent-id providers); record the exact ID, rather than an unresolved provider default.');
  expect(normalized).toContain('An unavailable provider, model, role, mode or effort must hold that role with no substitution.');
});

test('structural: contracts carry dual-adviser consultation without a driver profile', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'contracts.md'), 'utf8');
  for (const adviser of ['axstack-advisor-astra', 'axstack-advisor-opus']) {
    expect(text.includes(adviser), `contracts must name ${adviser}`).toBeTruthy();
  }
  expect(/Align[\s\S]*Spec|Spec[\s\S]*Align/i.test(text), 'contracts must cover Align and Spec').toBeTruthy();
  expect(/same bounded (?:evidence and question|question and evidence)/i.test(text)).toBeTruthy();
  expect(/independent/i.test(text), 'adviser consultations must be independent').toBeTruthy();
  expect(/synthesi[sz].*disagree|disagree.*synthesi[sz]/i.test(text)).toBeTruthy();
  expect(/driver.*owns|owns.*decision/i.test(text), 'contracts must keep decision ownership with the driver').toBeTruthy();
  expect(/unchanged[^.]*receipt|receipt[^.]*unchanged/i.test(text), 'contracts must reuse unchanged receipts').toBeTruthy();
  expect(/axstack-advisor-astra[^.]*axstack-escalation-fable[^.]*plain AGREE/i.test(text), 'contracts must require both plain AGREE receipts').toBeTruthy();
  expect(/driver[\s\S]*accept/i.test(text), 'contracts must require driver acceptance alongside AGREE').toBeTruthy();
  expect(/no silent\s+fallback|never.*fallback/i.test(text), 'contracts must forbid silent fallback').toBeTruthy();
  expect(/Opus high/i.test(text) && /Sol high/i.test(text), 'contracts must preserve high-stakes author/reviewer routing').toBeTruthy();
  expect(/single-provider high-stakes[^.]*pause/i.test(text), 'unmapped single-provider high-stakes work must pause').toBeTruthy();
  expect(/axstack-driver|effective effort|return[^.]*medium/i.test(text), 'contracts must not carry a driver profile or effort rule').toBe(false);
  expect(/current T3 thread[^.]*driver|driver[^.]*current T3 thread/i.test(text), 'contracts must keep the current chat as driver').toBeTruthy();
  expect(/either adviser[^.]*unavailable[^.]*hold|hold[^.]*either adviser[^.]*unavailable/i.test(text)).toBeTruthy();
});

test('structural: Rung 2 adds every configured family without changing the ordinary adviser pair', () => {
  const align = readFileSync(join(skillsDir, 'axstack-align', 'SKILL.md'), 'utf8');
  const arena = readFileSync(join(skillsDir, 'axstack-brainstorm', 'references/arena.md'), 'utf8');
  expect(arena).toMatch(/\. Rung 2 designs\s+alone enter the arena/i);
  for (const role of ['axstack-advisor-astra', 'axstack-advisor-opus', 'axstack-arena-candidate-grok', 'axstack-arena-candidate-antigravity']) {
    expect(arena).toContain(role);
  }
  expect(align.slice(0, align.indexOf('## Arena for hard-to-reverse design choices'))).toMatch(/axstack-advisor-astra[^.]*axstack-advisor-opus[^.]*independently/i);
});

test('structural: align reads back understanding without a pre-spec agreement gate', () => {
  const text = readFileSync(join(skillsDir, 'axstack-align', 'SKILL.md'), 'utf8');
  expect(/explicit user agreement before/i.test(text), 'align must not require agreement before producing the spec').toBe(false);
  expect(/reconfirm|re-confirm|ask only for confirmation/i.test(text), 'align must not reconfirm settled decisions routinely').toBe(false);
  expect(/draft spec/i.test(text), 'align must read back understanding as part of the draft spec').toBeTruthy();
  expect(/material new evidence/i.test(text), 'settled decisions stand unless material new evidence changes them').toBeTruthy();
});

test('structural: publishing needs mode-required review current; watch stops all registrations', () => {
  const review = readFileSync(join(skillsDir, 'axstack-review', 'SKILL.md'), 'utf8');
  expect(/mode-required|selected mode|mode-specific/i.test(review), 'publishing rule must require the selected mode review current').toBeTruthy();
  expect(/without vot/i.test(review), 'owner must synthesize findings without voting').toBeTruthy();
  const watch = readFileSync(join(skillsDir, 'axstack-watch', 'SKILL.md'), 'utf8');
  expect(/all owned|all.*registrations/i.test(watch), 'watch must stop ALL owned registrations at expiry').toBeTruthy();
  expect(/open PR/i.test(watch), 'watch expiry must explicitly cover open PRs').toBeTruthy();
});

test('structural: docs/workflows.md exists and references phase skills', () => {
  const p = join(root, 'docs', 'workflows.md');
  expect(existsSync(p), 'missing docs/workflows.md').toBeTruthy();
  const text = readFileSync(p, 'utf8');
  for (const name of EXPECTED_SKILLS) {
    expect(text.includes(name), `docs/workflows.md must reference ${name}`).toBeTruthy();
  }
});
