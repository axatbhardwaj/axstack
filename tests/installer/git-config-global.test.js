import { expect, test } from 'bun:test';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { makeTempRoot } from './helpers.js';

const root = `${import.meta.dir}/../..`;
const negativeFixture = 'tests/installer/fixtures/git-config-global-negative.json';
const examples = JSON.parse(readFileSync(`${root}/${negativeFixture}`, 'utf8'));

function unsafeAssignments(text, markdown = false) {
  // Recipes are executable fenced blocks; prose and comments are not assignments.
  if (markdown) text = [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1]).join('\n');
  // Consume comments and other strings whole so their examples cannot match.
  const tokens = /(?:\bGIT_CONFIG_GLOBAL\b|["']GIT_CONFIG_GLOBAL["'])\s*\]?\s*[:=]\s*(["'`]?)\/dev\/null\1(?=\s|[,;})]|$)|#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`/g;
  return [...text.matchAll(tokens)].filter((match) => match[1] !== undefined);
}

function violationsIn(directory) {
  const files = Bun.spawnSync(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: directory, stdout: 'pipe', stderr: 'pipe' });
  expect(files.exitCode).toBe(0);
  return [...new Set(files.stdout.toString().split('\0'))].filter((path) => {
    if (!path || path.startsWith('docs/') || path === negativeFixture) return false;
    const file = `${directory}/${path}`;
    if (!lstatSync(file).isFile()) return false;
    return unsafeAssignments(readFileSync(file, 'utf8'), path.endsWith('.md')).length > 0;
  }).sort();
}

test('shell, JavaScript and config assignments cannot redirect global git writes to the null device', () => {
  expect(violationsIn(root)).toEqual([]);
});

test('scan recognizes unsafe assignment forms and ignores comments, prose and private files', () => {
  for (const source of examples.unsafe) expect(unsafeAssignments(source).length).toBe(1);
  for (const source of examples.safe) expect(unsafeAssignments(source)).toEqual([]);
  expect(unsafeAssignments(examples.unsafe[0], true)).toEqual([]);
  expect(unsafeAssignments(`\`\`\`bash\n${examples.unsafe[0]}\n\`\`\``, true).length).toBe(1);
});

test('scan covers code, config and recipes while excluding docs and only its isolated negative fixture', () => {
  const directory = makeTempRoot('git-config-scan-');
  const git = Bun.spawnSync(['git', 'init', '--quiet', directory], { stdout: 'pipe', stderr: 'pipe' });
  expect(git.exitCode).toBe(0);
  const files = {
    'probe.sh': examples.unsafe[0],
    'probe.js': examples.unsafe[3],
    'config.json': examples.unsafe[4],
    'recipe.md': `\`\`\`sh\n${examples.unsafe[0]}\n\`\`\``,
    'docs/history.md': `\`\`\`sh\n${examples.unsafe[0]}\n\`\`\``,
    [negativeFixture]: examples.unsafe[0],
    'tests/another-fixture.js': examples.unsafe[3],
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(`${directory}/${path.slice(0, path.lastIndexOf('/') + 1)}`, { recursive: true });
    writeFileSync(`${directory}/${path}`, text);
  }
  expect(violationsIn(directory)).toEqual(['config.json', 'probe.js', 'probe.sh', 'recipe.md', 'tests/another-fixture.js']);
});
