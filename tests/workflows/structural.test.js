import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const EXPECTED_SKILLS = [
  'axstack',
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
    const p = join(root, 'skills', name, 'SKILL.md');
    assert.ok(existsSync(p), `missing ${p}`);
    assert.ok(!lstatSync(p).isSymbolicLink(), `SKILL.md must not be a symlink: ${p}`);
  }
});

test('structural: skill frontmatter is parseable with name and description', () => {
  for (const name of EXPECTED_SKILLS) {
    const p = join(root, 'skills', name, 'SKILL.md');
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
        // Relative markdown links must stay inside the skill folder.
        const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((x) => x[1]);
        for (const link of links) {
          if (/^(https?:|#|mailto:)/.test(link)) continue;
          const target = resolve(dirname(p), link.split('#')[0]);
          const skillDir = resolve(root, 'skills', p.split(sep).at(-3) ?? '');
          assert.ok(
            target.startsWith(resolve(root, 'skills')),
            `${p}: link escapes skills/: ${link}`,
          );
          void skillDir;
        }
      }
    }
  };
  walk(join(root, 'skills'));
});

test('structural: profiles/paseo.json schema (version=1, agentProfiles, axstack-* IDs)', () => {
  const p = join(root, 'profiles', 'paseo.json');
  assert.ok(existsSync(p), 'missing profiles/paseo.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  assert.equal(data.version, 1, 'version must be 1');
  assert.ok(Array.isArray(data.agentProfiles), 'agentProfiles must be an array');
  assert.ok(data.agentProfiles.length >= 6, 'need role diversity (>=6 profiles)');
  for (const prof of data.agentProfiles) {
    assert.match(prof.id, /^axstack-/, `profile id must be namespaced axstack-*: ${prof.id}`);
    for (const f of ['provider', 'modeId', 'notes']) {
      assert.ok(prof[f], `${prof.id}: missing ${f}`);
    }
    assert.ok('model' in prof, `${prof.id}: missing model key (may be null when unset)`);
    assert.ok('thinkingOptionId' in prof, `${prof.id}: missing thinkingOptionId key`);
  }
  const ids = data.agentProfiles.map((x) => x.id).join(' ');
  for (const role of ['driver', 'advisor', 'owner', 'author', 'review', 'check']) {
    assert.ok(ids.includes(role), `profiles lack role coverage for: ${role}`);
  }
  const checker = data.agentProfiles.find((x) => x.id.includes('check'));
  assert.ok(checker, 'missing checker profile');
  assert.ok(
    checker.model === null || checker.model === '' || checker.model === 'unset',
    'checker model must stay unset until user setup (null/empty/unset)',
  );
  assert.match(checker.notes, /setup/i, 'checker notes must explain model is chosen at setup');
});

test('structural: docs/workflows.md exists and references phase skills', () => {
  const p = join(root, 'docs', 'workflows.md');
  assert.ok(existsSync(p), 'missing docs/workflows.md');
  const text = readFileSync(p, 'utf8');
  for (const name of EXPECTED_SKILLS) {
    assert.ok(text.includes(name), `docs/workflows.md must reference ${name}`);
  }
});
