import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
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
    assert.ok(existsSync(p), `missing ${p}`);
    assert.ok(!lstatSync(p).isSymbolicLink(), `SKILL.md must not be a symlink: ${p}`);
  }
});

test('structural: skill frontmatter is parseable with name and description', () => {
  for (const name of EXPECTED_SKILLS) {
    const p = join(skillsDir, name, 'SKILL.md');
    const text = readFileSync(p, 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(m, `${name}: missing YAML frontmatter block`);
    assert.match(m[1], /^name:\s*\S+/m, `${name}: frontmatter needs name`);
    assert.match(m[1], /^description:\s*\S+/m, `${name}: frontmatter needs description`);
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
      if (e.isSymbolicLink()) assert.fail(`escaping symlink not allowed: ${p}`);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const text = readFileSync(p, 'utf8');
        for (const f of forbidden) {
          assert.ok(!text.includes(f), `${p} contains forbidden reference: ${f}`);
        }
      }
    }
  };
  walk(skillsDir);
});

test('structural: relative references resolve to real files inside the bundle', () => {
  const bundleRoot = skillsDir + sep;
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
          assert.ok(
            target === skillsDir || target.startsWith(bundleRoot),
            `${p}: link escapes bundle: ${link}`,
          );
          assert.ok(existsSync(target), `${p}: linked file does not exist: ${link}`);
        }
      }
    }
  };
  walk(skillsDir);
});

test('structural: standalone phases explicitly load shared references', () => {
  for (const name of STANDALONE_PHASES) {
    const text = readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
    assert.ok(
      text.includes('../axstack/references/'),
      `${name}: must explicitly load shared axstack reference(s)`,
    );
  }
  for (const ref of ['paseo-launch.md', 'contracts.md']) {
    assert.ok(
      existsSync(join(skillsDir, 'axstack', 'references', ref)),
      `missing shared reference skills/axstack/references/${ref}`,
    );
  }
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
    assert.ok(i > last, `paseo-launch.md: step ${s} missing or out of order`);
    last = i;
  }
  assert.ok(text.includes('${provider}/${model}'), 'must show provider/${provider}/${model} agent creation');
  assert.ok(/receipt/i.test(text), 'must require session model/ownership receipt verification');
  assert.ok(/persist/i.test(text) && /reuse/i.test(text), 'must persist/reuse agent and workspace IDs');
});

test('structural: profiles use verified provider/model/mode IDs with names', () => {
  const p = join(root, 'profiles', 'paseo.json');
  assert.ok(existsSync(p), 'missing profiles/paseo.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(data.version, 1, 'version must be 1');
  assert.ok(Array.isArray(data.agentProfiles), 'agentProfiles must be an array');
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
    assert.ok(prof, `missing profile ${id}`);
    assert.equal(prof.provider, want.provider, `${id}: provider must be ${want.provider}`);
    assert.equal(prof.model, want.model, `${id}: model must be ${want.model}`);
    assert.equal(prof.modeId, want.modeId, `${id}: modeId must be ${want.modeId}`);
    assert.ok(prof.name && prof.name.length > 0, `${id}: missing name (live list_profiles exposes name)`);
    assert.ok(!('displayName' in prof), `${id}: must not use displayName (not a live profile field)`);
    assert.ok(prof.notes && prof.notes.length > 0, `${id}: missing notes`);
    assert.ok('thinkingOptionId' in prof, `${id}: missing thinkingOptionId`);
  }

  // Cross-provider reviewer distinction: Opus reviewer must be claude, Sol reviewer codex.
  assert.notEqual(
    byId['axstack-reviewer-opus'].provider,
    byId['axstack-reviewer-sol'].provider,
    'final reviewers must be cross-provider (claude vs codex)',
  );
  assert.ok(
    !byId['axstack-reviewer-opus'].model.includes('gpt'),
    'Opus reviewer must never be a native GPT model',
  );

  // Mode allowlists per provider (verified): no invented codex default/review/readonly.
  const allowed = {
    claude: ['default', 'acceptEdits', 'auto', 'plan', 'bypassPermissions'],
    codex: ['auto', 'auto-review', 'full-access'],
  };
  for (const prof of data.agentProfiles) {
    assert.ok(allowed[prof.provider], `${prof.id}: unknown provider ${prof.provider}`);
    assert.ok(
      allowed[prof.provider].includes(prof.modeId),
      `${prof.id}: modeId ${prof.modeId} not valid for ${prof.provider}`,
    );
  }

  // Driver stays in current chat; checker gated on setup.
  assert.match(
    byId['axstack-driver'].notes,
    /current chat/i,
    'driver notes must state the current chat remains the driver',
  );
  assert.match(
    byId['axstack-driver'].notes,
    /never.*auto-launch|never.*launch/i,
    'driver notes must forbid auto-launching the preferred profile instead of current chat',
  );
  const checker = byId['axstack-checker'];
  assert.ok(checker, 'missing checker profile');
  assert.equal(checker.model, null, 'checker model must be null until user setup');
  assert.match(checker.notes, /setup/i, 'checker notes must explain model is chosen at setup');
  assert.match(
    checker.notes,
    /before dispatch|must not dispatch|require.*setup/i,
    'checker notes must require setup before dispatch (never launch provider default)',
  );
});

test('structural: review receipt distinguishes verdicts with SHA, coverage, limitations', () => {
  const text = readFileSync(join(skillsDir, 'axstack-review', 'SKILL.md'), 'utf8');
  const blocks = [...text.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);
  const receipt = blocks.find(
    (b) => b.includes('APPROVE') && b.includes('REQUEST_CHANGES') && b.includes('INCOMPLETE'),
  );
  assert.ok(receipt, 'review needs one receipt template containing all three verdicts');
  for (const field of ['sha', 'coverage', 'limitation']) {
    assert.ok(receipt.toLowerCase().includes(field), `receipt template must include ${field}`);
  }
});

test('structural: launch reference treats live profiles as authoritative', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'paseo-launch.md'), 'utf8');
  assert.ok(/live.*authoritative|authoritative.*live/i.test(text), 'must state installed live profiles are authoritative');
  assert.ok(/setup default/i.test(text), 'must describe bundled profiles as setup defaults');
  assert.ok(/no guaranteed|not guaranteed/i.test(text), 'must not assume profiles/paseo.json exists at runtime');
  assert.ok(/reconcile/i.test(text), 'must reconcile existing workspace/session before creating');
  assert.ok(/projectId/i.test(text), 'must pass canonical project lookup (projectId/workspaceId)');
  assert.ok(/setup gap/i.test(text), 'must treat missing canonical owner as setup gap');
  assert.ok(/never.*override|do not.*override/i.test(text), 'must never override configured models at runtime');
});

test('structural: contracts carry Fable triggers and the high-stakes gate', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'contracts.md'), 'utf8');
  assert.ok(text.includes('Fable'), 'contracts must name the Fable advisor split');
  assert.ok(/factual checks/i.test(text), 'contracts must trigger consultation only after factual checks');
  assert.ok(/AGREE/i.test(text), 'contracts must require plain AGREE for high-stakes decisions');
  assert.ok(/driver[\s\S]*accept/i.test(text), 'contracts must require driver acceptance alongside AGREE');
  assert.ok(/no silent\s+fallback|never.*fallback/i.test(text), 'contracts must forbid silent fallback');
  assert.ok(/Opus high/i.test(text) && /Sol high/i.test(text), 'contracts must preserve high-stakes author/reviewer routing');
});

test('structural: align reads back understanding without a pre-spec agreement gate', () => {
  const text = readFileSync(join(skillsDir, 'axstack-align', 'SKILL.md'), 'utf8');
  assert.ok(!/explicit user agreement before/i.test(text), 'align must not require agreement before producing the spec');
  assert.ok(!/reconfirm|re-confirm|ask only for confirmation/i.test(text), 'align must not reconfirm settled decisions routinely');
  assert.ok(/draft spec/i.test(text), 'align must read back understanding as part of the draft spec');
  assert.ok(/material new evidence/i.test(text), 'settled decisions stand unless material new evidence changes them');
});

test('structural: publishing needs both reviewers current; watch stops all registrations', () => {
  const review = readFileSync(join(skillsDir, 'axstack-review', 'SKILL.md'), 'utf8');
  assert.ok(/both reviewers/i.test(review), 'publishing rule must require both reviewers current');
  assert.ok(/without vot/i.test(review), 'owner must synthesize findings without voting');
  const watch = readFileSync(join(skillsDir, 'axstack-watch', 'SKILL.md'), 'utf8');
  assert.ok(/all owned|all.*registrations/i.test(watch), 'watch must stop ALL owned registrations at expiry');
  assert.ok(/open PR/i.test(watch), 'watch expiry must explicitly cover open PRs');
});

test('structural: docs/workflows.md exists and references phase skills', () => {
  const p = join(root, 'docs', 'workflows.md');
  assert.ok(existsSync(p), 'missing docs/workflows.md');
  const text = readFileSync(p, 'utf8');
  for (const name of EXPECTED_SKILLS) {
    assert.ok(text.includes(name), `docs/workflows.md must reference ${name}`);
  }
});
