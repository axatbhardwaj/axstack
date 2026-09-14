import { test, expect } from 'bun:test';
// Filesystem access uses the approved narrow exception: node:fs and
// node:fs/promises are Bun-implemented built-ins. No Node.js runtime is
// required. Path/URL handling below is local (import.meta.dir), not node:.
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs';

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
  'axstack',
  'axstack-align',
  'axstack-spec',
  'axstack-tickets',
  'axstack-implement',
  'axstack-review',
  'axstack-watch',
];

// Standalone phases callable directly; each must explicitly load shared contracts.
const STANDALONE_PHASES = [
  'axstack-align',
  'axstack-spec',
  'axstack-tickets',
  'axstack-implement',
  'axstack-review',
  'axstack-watch',
];

// NOTE: structural checks only. They verify packaging, not instruction-following behavior.

test('structural: all seven phase skills exist with SKILL.md', () => {
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
  for (const ref of ['paseo-launch.md', 'contracts.md']) {
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
  expect(contracts).toMatch(/one Paseo execution host owns a run/i);
  expect(contracts).toMatch(/exactly one writer per candidate/i);
});

test('structural: shared PR-shape reference is complete, bounded, and sole source of bands', () => {
  const p = join(skillsDir, 'axstack', 'references', 'pr-shape.md');
  const shape = readFileSync(p, 'utf8');
  expect(shape.split('\n').length, 'pr-shape.md must stay within 40 lines').toBeLessThanOrEqual(40);
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
  for (const [name, text] of Object.entries({ readme, workflows })) {
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

test('structural: launch reference gives ordered Paseo materialization steps', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'paseo-launch.md'), 'utf8');
  const steps = [
    'list_profiles',
    'list_providers',
    'list_models',
    'inspect_provider',
    'create_workspace',
    'create_agent',
  ];
  let last = -1;
  for (const s of steps) {
    const i = text.indexOf(s);
    expect(i > last, `paseo-launch.md: step ${s} missing or out of order`).toBeTruthy();
    last = i;
  }
  expect(text.includes('${provider}/${model}'), 'must show provider/${provider}/${model} agent creation').toBeTruthy();
  expect(/receipt/i.test(text), 'must require session model/ownership receipt verification').toBeTruthy();
  expect(/persist/i.test(text) && /reuse/i.test(text), 'must persist/reuse agent and workspace IDs').toBeTruthy();
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

test('structural: launch reference treats live profiles as authoritative', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'paseo-launch.md'), 'utf8');
  expect(/live.*authoritative|authoritative.*live/i.test(text), 'must state installed live profiles are authoritative').toBeTruthy();
  expect(/setup default/i.test(text), 'must describe bundled profiles as setup defaults').toBeTruthy();
  expect(/no guaranteed|not guaranteed/i.test(text), 'must not assume bundled presets exist at runtime').toBeTruthy();
  expect(/reconcile/i.test(text), 'must reconcile existing workspace/session before creating').toBeTruthy();
  expect(/projectId/i.test(text), 'must pass canonical project lookup (projectId/workspaceId)').toBeTruthy();
  expect(/setup gap/i.test(text), 'must treat missing canonical owner as setup gap').toBeTruthy();
  expect(/never.*override|do not.*override/i.test(text), 'must never override configured models at runtime').toBeTruthy();
});

test('structural: contracts carry configured advisor triggers and the mixed high-stakes gate', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'contracts.md'), 'utf8');
  expect(text.includes('axstack-advisor'), 'contracts must name the configured advisor role').toBeTruthy();
  // Structural policy check: the configured advisor is involved in spec
  // creation/revision, solution design, and consequential decisions —
  // broader than only unresolved-after-factual-checks. Flagged to root:
  // this replaces the prior narrow trigger expectation.
  expect(/spec[\s\S]*creation|spec[\s\S]*revision/i.test(text), 'contracts must involve Fable in spec creation/revision').toBeTruthy();
  expect(/solution design/i.test(text), 'contracts must involve Fable in solution design').toBeTruthy();
  expect(/consequential/i.test(text), 'contracts must involve Fable in consequential decisions').toBeTruthy();
  expect(/driver.*owns|owns.*decision/i.test(text), 'contracts must keep decision ownership with the driver').toBeTruthy();
  expect(/cach/i.test(text), 'contracts must cache decision receipts against repeat consultation').toBeTruthy();
  expect(/AGREE/i.test(text), 'contracts must require plain AGREE for high-stakes decisions').toBeTruthy();
  expect(/driver[\s\S]*accept/i.test(text), 'contracts must require driver acceptance alongside AGREE').toBeTruthy();
  expect(/no silent\s+fallback|never.*fallback/i.test(text), 'contracts must forbid silent fallback').toBeTruthy();
  expect(/Opus high/i.test(text) && /Sol high/i.test(text), 'contracts must preserve high-stakes author/reviewer routing').toBeTruthy();
  expect(/single-provider high-stakes[^.]*pause/i.test(text), 'unmapped single-provider high-stakes work must pause').toBeTruthy();
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
