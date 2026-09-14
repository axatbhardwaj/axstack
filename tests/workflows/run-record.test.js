import { test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const referencePath = `${root}/skills/axstack/references/run-record.md`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

function filesBelow(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    return entry.isDirectory() ? filesBelow(child) : [child];
  });
}

test('run-record: shared reference exists and lifecycle links to it', () => {
  expect(existsSync(referencePath), 'missing shared run-record reference').toBe(true);
  expect(read('skills/axstack/references/lifecycle.md')).toContain('[Run record](run-record.md)');
});

test('run-record: path, identity, fallback, and archive stay local and stable', () => {
  const text = read('skills/axstack/references/run-record.md');
  const command = 'git rev-parse --path-format=absolute --git-common-dir';
  expect(text).toContain(`<${command}>/axstack/runs/<id>/progress.md`);
  expect(text.match(new RegExp(command, 'g'))?.length ?? 0).toBeGreaterThanOrEqual(1);
  expect(text).toMatch(/without[\s\S]*?path-format=absolute[\s\S]*?relative `\.git`[\s\S]*?ambiguous[\s\S]*?worktrees[\s\S]*?current working\s+directory/i);
  expect(text).toMatch(/main checkout[\s\S]*linked worktrees|linked worktrees[\s\S]*main checkout/i);
  expect(text).toMatch(/never[^.]*tracked tree/i);
  expect(text).toMatch(/<UTCdate>-<slug>/i);
  expect(text).toMatch(/UTCdate[^.]*YYYYMMDD[^.]*20260913-local-progress/i);
  expect(text).toMatch(/driver[^.]*chooses[^.]*slug/i);
  expect(text).toMatch(/slug[^.]*lowercase letters[^.]*digits[^.]*hyphens[^.]*only/i);
  expect(text).toMatch(/never[^.]*raw request text/i);
  expect(text).toMatch(/no[^.]*separators[^.]*path segments[^.]*inside `?axstack\/runs\/?`?/i);
  expect(text).toMatch(/collision[^.]*suffix/i);
  expect(text).toMatch(/non-Git[^.]*private host state/i);
  expect(text).toMatch(/Archived[^.]*status/i);
  expect(text).toMatch(/never[^.]*move[^.]*delete|nothing[^.]*moved[^.]*deleted/i);
});

test('run-record: compact template carries required run and task fields', () => {
  const text = read('skills/axstack/references/run-record.md');
  const templates = [...text.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1]);
  const template = templates.find((block) => block.includes('Run:') && block.includes('| Task |'));
  expect(template, 'missing compact progress.md template').toBeTruthy();
  for (const field of ['Driver:', 'Scope:', 'Source base:', 'Updated:']) {
    expect(template).toContain(field);
  }
  for (const column of ['Dependencies', 'Owner', 'State', 'Revision evidence', 'Next action']) {
    expect(template).toContain(column);
  }
  expect(template).toMatch(/Driver:[^\n]*sole writer/i);
  const header = template.split('\n').find((line) => line.startsWith('| Task |'));
  const example = template.split('\n').find((line) => line.startsWith('| <task> |'));
  const cellCount = (line) => line.split('|').length - 2;
  expect(cellCount(example), 'task example must match header cell count').toBe(cellCount(header));
  expect(example).toContain('<role + session ID + worktree, or receipt ref>');
});

test('run-record: reconciliation protects ownership and revision evidence', () => {
  const text = read('skills/axstack/references/run-record.md');
  expect(text).toMatch(/driver[^.]*sole writer/i);
  expect(text).toMatch(/prompt contract[^.]*not a lock/i);
  expect(text).toMatch(/discover[^.]*existing runs/i);
  expect(text).toMatch(/match[^.]*repo[^.]*scope|match[^.]*scope[^.]*repo/i);
  expect(text).toMatch(/never[^.]*blindly[^.]*latest/i);
  expect(text).toMatch(/duplicate writer/i);
  expect(text).toMatch(/approval[^.]*evidence[^.]*older\s+revision|stale[^.]*evidence[^.]*revision/i);
  expect(text).toMatch(/task completion[^.]*capability[^.]*merged/i);
  expect(text).toMatch(/prior driver[^.]*inactive|inactive[^.]*prior driver/i);
  expect(text).toMatch(/inactive[^.]*actual Orca session[^.]*Dispatch state/i);
  expect(text).toMatch(/idle alone[^.]*never[^.]*reassign/i);
  expect(text).toMatch(/explicit[^.]*accepted transfer/i);
  expect(text).toMatch(/uncertain[^.]*live conflict[^.]*hold|live conflict[^.]*uncertain[^.]*hold/i);
  expect(text).toMatch(/never[^.]*overwrite/i);
  expect(text).toMatch(/prior driver[^.]*different valid accepted\s+owner[^.]*stop/i);
  expect(text).toMatch(/derived progress[^.]*not authority/i);
  for (const source of ['Orca sessions and Dispatches', 'Git revisions', 'forge/PR state', 'approved spec']) {
    expect(text).toContain(source);
  }
  expect(text).toMatch(/driver[^.]*verifies[^.]*exact SHAs[^.]*receipts[^.]*before recording a transition/i);
  expect(text).toMatch(/worker[^.]*claim[^.]*not verification/i);
});

test('run-record: use is proportional and content stays compact and private', () => {
  const text = read('skills/axstack/references/run-record.md');
  expect(text).toMatch(/required[^.]*substantive[^.]*delegated[^.]*resumable/i);
  expect(text).toMatch(/one-step direct[^.]*no|not required[^.]*one-step direct/i);
  for (const excluded of ['tokens', 'transcripts', 'full\\s+worker\\s+output']) {
    expect(text).toMatch(new RegExp(`no[^.]*${excluded}`, 'i'));
  }
  expect(text).toMatch(/Git metadata[^.]*not pushed/i);
  expect(text).toMatch(/copied|backed up/i);
});

test('run-record: feature remains prose-only with no runtime companion', () => {
  const runtimeFiles = [
    ...filesBelow(`${root}/src`),
    ...filesBelow(`${root}/bin`),
  ];
  expect(runtimeFiles.filter((path) => /run-record|progress-ledger|progress\.md/i.test(path))).toEqual([]);
  expect(filesBelow(`${root}/skills`).filter((path) => path.includes('/scripts/'))).toEqual([]);
});

test('descriptions: every shipped skill is one-line, intent-first, and named', () => {
  const skillFiles = filesBelow(`${root}/skills`).filter((path) => path.endsWith('/SKILL.md'));
  expect(skillFiles).toHaveLength(12);
  for (const path of skillFiles) {
    const lines = readFileSync(path, 'utf8').split('\n');
    const descriptions = lines.filter((line) => line.startsWith('description:'));
    expect(descriptions, `${path}: exactly one description line`).toHaveLength(1);
    expect(descriptions[0], `${path}: intent-first description`).toMatch(
      /^description: When .+, use axstack(?:-[a-z-]+)? /,
    );
  }
  expect(read('skills/axstack-watch/SKILL.md')).toMatch(
    /^description: When .*babysit.*existing PR.*use axstack-watch /im,
  );
});

test('run-record scenarios: five bounded decisions have the owned scenario shape', () => {
  const data = JSON.parse(read('tests/workflows/run-record-scenarios.json'));
  expect(data.version).toBe(1);
  const ids = data.cases.map((entry) => entry.id);
  expect(ids).toEqual([
    'resume-no-duplicate-writer',
    'ownership-seize-refused',
    'stale-evidence-hold',
    'task-done-vs-capability-merged',
    'proportional-scope-identity',
  ]);
  expect(new Set(ids).size).toBe(ids.length);
  for (const entry of data.cases) {
    expect(entry.title && entry.skill_ref && entry.input && entry.expected).toBeTruthy();
    expect(entry.input.request && entry.input.facts).toBeTruthy();
  }
});
