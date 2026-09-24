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
  // Each clause is two tokens that must land in the SAME sentence, in either
  // order. Paragraph scope alone let a clause pass by borrowing a token from a
  // neighbour, so the pair is bound to the unit that actually states it.
  const lineage = runtime
    .split('\n\n')
    .find((paragraph) => paragraph.includes('--parent-worktree')) ?? '';
  const sentences = lineage.replace(/\s+/g, ' ').split(/(?<=\.)\s+/);
  const states = (a, b) => sentences.some((sentence) => a.test(sentence) && b.test(sentence));

  expect(lineage, 'no paragraph states the worktree lineage rule').not.toBe('');
  expect(
    states(/--parent-worktree/, /candidate'?s? worktree/i),
    'no sentence requires creating a worker worktree parented to the candidate',
  ).toBe(true);
  expect(
    states(/--no-parent/, /unrelated/i),
    'no sentence reserves --no-parent for unrelated work',
  ).toBe(true);
  expect(runtime).toMatch(/--no-parent[^.]*never[^.]*review or repair checkout/i);
  expect(
    states(/worktree set/, /--parent-worktree/),
    'no sentence says a wrong lineage is correctable in place',
  ).toBe(true);
  expect(
    // Only a denial of authority counts; "not the only authority" is the
    // opposite claim and must not satisfy this clause.
    states(/lineage/i, /\b(?:never|no|not)\s+(?:an?\s+)?authority\b/i),
    'no sentence says lineage is never authority',
  ).toBe(true);
});

test('review placement isolates each reviewer and preserves private run evidence', () => {
  // Prompt-contract regression: the old lineage rule allowed a shared checkout
  // and /tmp reports. This checks the shipped policy, not live agent adherence.
  const runtime = read('skills/axstack/references/orca-runtime.md').replace(/\s+/g, ' ');
  const review = read('skills/axstack-review/SKILL.md').replace(/\s+/g, ' ');
  expect(runtime).toMatch(/each reviewer[^.]*separate Orca-managed child worktree/i);
  expect(runtime).toMatch(/never[^.]*share[^.]*author[^.]*checkout/i);
  expect(runtime).toMatch(/detached[^.]*exact candidate SHA[^.]*pinned base/i);
  expect(runtime).toMatch(/<run dir>\/evidence\/<dispatch>\/[^.]*brief[^.]*completion receipt/i);
  expect(runtime).toMatch(/per-Dispatch run folder[\s\S]*?first-pass cross-read/i);
  expect(runtime).toMatch(/tracked candidate files[^.]*read-only/i);
  expect(runtime).toMatch(/before removing a reviewer worktree[^.]*read back[^.]*private run evidence folder/i);
  expect(runtime).toMatch(/private evidence archive[^.]*only[^.]*legacy in-worktree evidence/i);
  expect(review).toContain('orca-runtime.md#reviewer-workspaces-and-evidence');
  expect(review).toContain('Workspace: <Orca worktree ID + absolute path>');
  expect(review).toContain('Evidence: <run dir>/evidence/<dispatch>/ (report and probe paths)');
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

test('review manager uses capacity admission and requires canary evidence', () => {
  const manager = read('skills/axstack/references/automations.md');
  expect(manager).toContain('dedicated existing Orca workspace');
  expect(manager).toMatch(/native existing-workspace mode[^.]*--fresh-session/i);
  expect(manager).toMatch(/eligible actionable PR events[^.]*measured host capacity/i);
  expect(manager).toMatch(/canary must prove fresh-session/i);
  expect(manager).not.toMatch(/watch manager|watch lane/i);
});

test('preset bundles retain three role tables in the frozen container', () => {
  const names = ['mixed', 'codex-only', 'claude-only'];
  for (const name of names) {
    const data = JSON.parse(read(`profiles/presets/${name}.json`));
    expect(Object.keys(data)).toEqual(['version', 'roles']);
    expect(data.version).toBe(1);
    expect(data.roles).toHaveLength(26);
    expect(new Set(data.roles.map(({ id }) => id)).size).toBe(26);
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
