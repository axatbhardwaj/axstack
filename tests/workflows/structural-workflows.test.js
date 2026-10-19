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

test('structural: active PR parallelism has no fixed count', () => {
  const currentPolicyFiles = [
    ...skillMarkdownFiles,
    ...publicDocPaths(root).map((path) => join(root, path)),
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

test('structural: shared PR-shape reference preserves measurement and coherent themes', () => {
  const p = join(skillsDir, 'axstack', 'references', 'pr-shape.md');
  const shape = readFileSync(p, 'utf8');
  expect(shape).toContain('bun scripts/pr-shape.js --base <base> --head <head>');
  expect(shape).toMatch(/actual PR base/i);
  expect(shape).toMatch(/stacked child[^.]*parent branch/i);
  expect(shape).toMatch(/root PR[^.]*actual target branch/i);
  expect(shape).toMatch(/main[^.]*example/i);
  expect(shape).toMatch(/total\s*(?:=|is|as|equals)\s*additions\s*(?:\+|plus)\s*deletions[^.]*(?:all files|every file)/i);
  expect(shape).toMatch(/moves.*-M|-M.*moves/i);
  expect(shape).toMatch(/binar[^.]*count[^.]*purpose/i);
  for (const bucket of ['generated', 'lockfile', 'formatter-only']) expect(shape).toContain(bucket);
  expect(shape).toMatch(/reproducible recorded command/i);
  expect(shape).toMatch(/never\s+automatically subtract/i);
  expect(shape).toMatch(/silent exclusion[^.]*forbidden/i);
  expect(shape).toMatch(/one (behavior|component)[^.]*callers[^.]*tests[^.]*types[^.]*docs[^.]*migrations/i);
  expect(shape).toMatch(/not a folder restriction/i);
  expect(shape).toMatch(/smaller\s+cohesive\s+PRs[^.]*encouraged/i);
  expect(shape).toMatch(/no padding/i);

  const productionPolicyFiles = [
    ...skillMarkdownFiles.filter((file) => file !== p),
    join(root, 'README.md'),
    join(root, 'docs', 'workflows.md'),
  ];
  for (const file of productionPolicyFiles) {
    expect(readFileSync(file, 'utf8'), `${file} retains obsolete PR-shape bands`)
      .not.toMatch(/≤2000|2001[–-]2500|>2500/);
  }
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
  expect(callers.tickets).toMatch(/mapping\s+time[^.]*no actual SHAs or line counts/i);
  expect(callers.implement).toContain('Shape: <total> lines vs base <sha>; bulk: <buckets>; theme: <one line>');
  expect(callers.implement).toContain('[PR chains](../axstack/references/pr-chain.md)');
  // Child refresh, commit preservation and shape guards are mutation-checked
  // at their owning PR-chain boundary in pr-chain.test.js.
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
  expect(requires(text, /plan generation/i, /scripts\/dispatch-plan\.js/, /recorded role snapshot/i, /saved capabilities/i)).toBe(true);
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
  expect(arena).toMatch(/only at Rung 2[^.]*judge rounds/i);
  for (const role of ['axstack-advisor-astra', 'axstack-advisor-opus', 'axstack-arena-candidate-grok', 'axstack-arena-candidate-antigravity']) {
    expect(arena).toContain(role);
  }
  expect(align).toMatch(/axstack-advisor-astra[^.]*axstack-advisor-opus[^.]*independently/i);
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

