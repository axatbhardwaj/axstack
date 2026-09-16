import { test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

function filesBelow(path) {
  return readdirSync(`${root}/${path}`, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`);
}

// Structural policy checks only. The frozen six cases and independent evaluator
// provide behavioral evidence; these checks do not infer agent behavior.

test('orca runtime reference replaces the active Paseo launch guide', () => {
  expect(existsSync(`${root}/skills/axstack/references/orca-runtime.md`)).toBe(true);
  expect(existsSync(`${root}/skills/axstack/references/paseo-launch.md`)).toBe(false);

  const runtime = read('skills/axstack/references/orca-runtime.md');
  expect(runtime).toMatch(/ORCA_CLI_COMMAND/);
  expect(runtime).toMatch(/skills get orchestration/);
  expect(runtime).toMatch(/skills get orca-cli/);
  for (const identity of ['Run', 'Task', 'Dispatch']) expect(runtime).toContain(identity);
  expect(runtime).toMatch(/requested[^.]*effective|effective[^.]*requested/i);
  expect(runtime).toMatch(/permission[^.]*intent[^.]*not[^.]*parity/i);
});

test('runtime boundary requires worker worktrees to carry their parent lineage', () => {
  const runtime = read('skills/axstack/references/orca-runtime.md');
  // Scope to the lineage paragraph so each clause is checked against its own
  // prose, then assert the two tokens that carry the clause in either order.
  // Deleting a clause fails its assertion; rewording one does not.
  const lineage = runtime
    .split('\n\n')
    .find((paragraph) => paragraph.includes('--parent-worktree')) ?? '';
  const carries = (a, b) => a.test(lineage) && b.test(lineage);

  expect(lineage).not.toBe('');
  // a: create the worker worktree parented to the candidate.
  expect(carries(/--parent-worktree/, /candidate'?s? worktree/i)).toBe(true);
  // b: --no-parent is reserved for unrelated work.
  expect(carries(/--no-parent/, /unrelated/i)).toBe(true);
  // c: a wrong lineage is correctable in place.
  expect(carries(/worktree set/, /--parent-worktree/)).toBe(true);
  // d: lineage is never authority.
  expect(carries(/lineage/i, /never\s+authority/i)).toBe(true);
});

test('runtime decisions cover startup, fencing, settlement, and accepted handoff', () => {
  const runtime = read('skills/axstack/references/orca-runtime.md');
  for (const receipt of ['input_accepted', 'turn_started', 'worker_done', 'consumer_fenced', 'user_takeover']) {
    expect(runtime).toContain(receipt);
  }
  expect(runtime).toMatch(/trust[^.]*prompt[^.]*never[^.]*answer|never[^.]*answer[^.]*trust[^.]*prompt/i);
  expect(runtime).toMatch(/worker_done[^.]*Task[^.]*Dispatch|Task[^.]*Dispatch[^.]*worker_done/i);
  expect(runtime).toMatch(/whole delivery[^.]*acknowledg/i);
  expect(runtime).toMatch(/explicit[^.]*acceptance[^.]*before[^.]*ownership/i);
  expect(runtime).toMatch(/same[^.]*owner|current owner/i);
});

test('all active skill runtime instructions are Orca-only', () => {
  const markdown = filesBelow('skills').filter((path) => path.endsWith('.md'));
  for (const path of markdown) {
    expect(readFileSync(path, 'utf8'), `${path} retains active Paseo instructions`).not.toMatch(/Paseo|paseo/);
  }
  for (const phase of ['align', 'audit', 'explain', 'implement', 'improve', 'research', 'review', 'spec', 'tickets', 'watch']) {
    expect(read(`skills/axstack-${phase}/SKILL.md`)).toContain('../axstack/references/orca-runtime.md');
  }
});

test('native watch hold is lifted: driver mutates, watchdog stays read-only', () => {
  const watch = read('skills/axstack-watch/references/watch-runtime.md');
  expect(watch).toMatch(/provider[^.]*supported/i);
  for (const missing of ['model', 'effort', 'permission']) {
    expect(watch).toMatch(new RegExp(`${missing}[^.]*unsupported|cannot[^.]*${missing}`, 'i'));
  }
  expect(watch).not.toMatch(/activation[^.]*(?:is|are|remains?) held|capability hold/i);
  expect(watch).toMatch(/lifted[^.]*user decision|user decision[^.]*lifted/i);
  expect(watch).toMatch(/driver automation[^.]*mutating owner/i);
  expect(watch).toMatch(/watchdog[^.]*read-only/i);
  expect(watch).toMatch(/no[^.]*custom[^.]*scheduler/i);
  expect(watch).toMatch(/five.minute|5.minute/i);
  expect(watch).toMatch(/hourly/i);
  expect(watch).toMatch(/24.hour/i);
});

test('preset bundles retain three role tables in the frozen container', () => {
  const names = ['mixed', 'codex-only', 'claude-only'];
  for (const name of names) {
    const data = JSON.parse(read(`profiles/presets/${name}.json`));
    expect(Object.keys(data)).toEqual(['version', 'roles']);
    expect(data.version).toBe(1);
    expect(data.roles).toHaveLength(21);
    expect(new Set(data.roles.map(({ id }) => id)).size).toBe(21);
  }
  const mixed = JSON.parse(read('profiles/presets/mixed.json'));
  expect(mixed.roles.find(({ id }) => id === 'axstack-checker').model).toBeNull();
});

test('public guidance distinguishes active Orca from historical Paseo state', () => {
  const docs = [read('README.md'), read('docs/installation.md'), read('docs/workflows.md')].join('\n');
  expect(docs).toMatch(/Orca[^.]*only supported(?: active)? runtime|only supported(?: active)? runtime[^.]*Orca/i);
  expect(docs).toMatch(/historical[^.]*Paseo|Paseo[^.]*historical/i);
  expect(docs).toMatch(/compatib[^.]*unverified|unverified[^.]*compatib/i);
  expect(docs).toMatch(/mobile[^.]*unverified|unverified[^.]*mobile/i);
});
