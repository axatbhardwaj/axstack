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
    ...readdirSync(skillsDir, { recursive: true })
      .filter((p) => p.endsWith('.md'))
      .map((p) => join(skillsDir, p)),
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

test('structural: profiles use verified provider/model/mode IDs with names', () => {
  const p = join(root, 'profiles', 'paseo.json');
  expect(existsSync(p), 'missing profiles/paseo.json').toBeTruthy();
  const data = JSON.parse(readFileSync(p, 'utf8'));
  expect(data.version, 'version must be 1').toBe(1);
  expect(Array.isArray(data.agentProfiles), 'agentProfiles must be an array').toBeTruthy();
  const byId = Object.fromEntries(data.agentProfiles.map((x) => [x.id, x]));

  const expected = {
    'axstack-driver': { provider: 'codex', model: 'gpt-6-astra', modeId: 'auto' },
    'axstack-advisor': { provider: 'claude', model: 'claude-fable-5-1', modeId: 'plan' },
    'axstack-owner': { provider: 'claude', model: 'claude-opus-5', modeId: 'default' },
    'axstack-author': { provider: 'codex', model: 'gpt-5.6-sol', modeId: 'auto' },
    'axstack-reviewer-opus': { provider: 'claude', model: 'claude-opus-5', modeId: 'default' },
    'axstack-reviewer-sol': { provider: 'codex', model: 'gpt-5.6-sol', modeId: 'auto' },
  };
  for (const [id, want] of Object.entries(expected)) {
    const prof = byId[id];
    expect(prof, `missing profile ${id}`).toBeTruthy();
    expect(prof.provider, `${id}: provider must be ${want.provider}`).toBe(want.provider);
    expect(prof.model, `${id}: model must be ${want.model}`).toBe(want.model);
    expect(prof.modeId, `${id}: modeId must be ${want.modeId}`).toBe(want.modeId);
    expect(prof.name && prof.name.length > 0, `${id}: missing name (live list_profiles exposes name)`).toBeTruthy();
    expect('displayName' in prof, `${id}: must not use displayName (not a live profile field)`).toBe(false);
    expect(prof.notes && prof.notes.length > 0, `${id}: missing notes`).toBeTruthy();
    expect('thinkingOptionId' in prof, `${id}: missing thinkingOptionId`).toBeTruthy();
  }

  // Cross-provider reviewer distinction: Opus reviewer must be claude, Sol reviewer codex.
  expect(
    byId['axstack-reviewer-opus'].provider === byId['axstack-reviewer-sol'].provider,
    'final reviewers must be cross-provider (claude vs codex)',
  ).toBe(false);
  expect(
    byId['axstack-reviewer-opus'].model.includes('gpt'),
    'Opus reviewer must never be a native GPT model',
  ).toBe(false);

  // Mode allowlists per provider (verified): no invented codex default/review/readonly.
  const allowed = {
    claude: ['default', 'acceptEdits', 'auto', 'plan', 'bypassPermissions'],
    codex: ['auto', 'auto-review', 'full-access'],
  };
  for (const prof of data.agentProfiles) {
    expect(allowed[prof.provider], `${prof.id}: unknown provider ${prof.provider}`).toBeTruthy();
    expect(
      allowed[prof.provider].includes(prof.modeId),
      `${prof.id}: modeId ${prof.modeId} not valid for ${prof.provider}`,
    ).toBeTruthy();
  }

  // Driver stays in current chat; checker gated on setup.
  expect(
    byId['axstack-driver'].notes,
    'driver notes must state the current chat remains the driver',
  ).toMatch(/current chat/i);
  expect(
    byId['axstack-driver'].notes,
    'driver notes must forbid auto-launching the preferred profile instead of current chat',
  ).toMatch(/never.*auto-launch|never.*launch/i);
  const checker = byId['axstack-checker'];
  expect(checker, 'missing checker profile').toBeTruthy();
  expect(checker.model, 'checker model must be null until user setup').toBe(null);
  expect(checker.notes, 'checker notes must explain model is chosen at setup').toMatch(/setup/i);
  expect(
    checker.notes,
    'checker notes must require setup before dispatch (never launch provider default)',
  ).toMatch(/before dispatch|must not dispatch|require.*setup/i);
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
  expect(/no guaranteed|not guaranteed/i.test(text), 'must not assume profiles/paseo.json exists at runtime').toBeTruthy();
  expect(/reconcile/i.test(text), 'must reconcile existing workspace/session before creating').toBeTruthy();
  expect(/projectId/i.test(text), 'must pass canonical project lookup (projectId/workspaceId)').toBeTruthy();
  expect(/setup gap/i.test(text), 'must treat missing canonical owner as setup gap').toBeTruthy();
  expect(/never.*override|do not.*override/i.test(text), 'must never override configured models at runtime').toBeTruthy();
});

test('structural: contracts carry Fable triggers and the high-stakes gate', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'contracts.md'), 'utf8');
  expect(text.includes('Fable'), 'contracts must name the Fable advisor split').toBeTruthy();
  // User steering (accepted scope extension): Fable is involved in spec
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
