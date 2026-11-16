import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterAll, expect, test } from 'bun:test';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const watch = readFileSync(`${import.meta.dir}/../../skills/axstack-watch/references/readiness.md`, 'utf8');

// Watch is an instruction interface: verify its real consumer, including
// removal/inversion negatives and equivalent wording, rather than simulating it.
for (const [name, concepts, rewording, inversion] of [
  ['runs the installed helper from a trusted cwd with an explicit repository',
    [/run/i, /installed/i, /pr-shape\.js/, /--no-env-file/,
      /--repo <PR checkout> --base <base-sha> --head <head-sha>/, /trusted cwd/i, /current head and base SHA/i],
    'At the current head and base SHA run the installed pr-shape.js from trusted cwd / with bun --no-env-file <resolved-helper> --repo <PR checkout> --base <base-sha> --head <head-sha>.',
    [/\brun\b/i, 'skip']],
  ['consumes a sandbox failure as a user merge',
    [/sandbox-path/i, /fail/i, /requires?/i, /user merge/i, /on the forge/i],
    'A fail for sandbox-path requires user merge on the forge.',
    [/user merge/i, 'automatic merge']],
  ['holds automatic merge for every non-pass outcome',
    [/sandbox-path: pass/i, /anything other than|every result except/i, /\bfail\b/i,
      /unknown/i, /(?:missing|absent) output/i, /\berror\b/i, /nonzero exit/i, /holds? automatic merge/i],
    'Every result except sandbox-path: pass, including fail, unknown, absent output, error or nonzero exit, holds automatic merge.',
    [/holds? automatic merge/i, 'allows automatic merge']],
]) {
  test(`watch sandbox-path: ${name}`, () => {
    // "no" is part of this CLI flag, not a prose prohibition.
    checkRule(watch.replace(/`/g, ''), (text) => sentences(text).some((unit) =>
      concepts.every((concept) => concept.test(unit)) && requires(unit.replaceAll('--no-env-file', '--env-disabled'), /^/)),
      rewording, [inversion], concepts);
  });
}

for (const [name, prohibition, concepts, rewording] of [
  ['PR checkout is forbidden as cwd', /never (?:use|set)/i, [/PR checkout/i, /cwd/i],
    'Never set the PR checkout as cwd for this command.'],
  ['helper resolution excludes the PR checkout', /never (?:from )?the PR checkout/i,
    [/resolve/i, /helper link/i, /installed reference/i],
    'Resolve the helper link against the installed reference, never from the PR checkout.'],
]) {
  test(`watch sandbox-path: ${name}`, () => {
    checkRule(watch.replace(/`/g, ''), (text) => prohibits(text, prohibition, ...concepts),
      rewording, [[prohibition, name.includes('cwd') ? 'always use' : 'from the PR checkout']], concepts);
  });
}

test('watch resolves pr-shape through the installed skill tree, never through the PR checkout', () => {
  const link = watch.match(/\[pr-shape\.js\]\(([^)]+)\)/)?.[1];
  expect(link).toBeDefined();
  const reference = new URL('../../skills/axstack-watch/references/readiness.md', import.meta.url);
  expect(new URL(link, reference).pathname)
    .toBe(new URL('../../skills/axstack/scripts/pr-shape.js', import.meta.url).pathname);
  expect(watch).not.toMatch(/bun\s+skills\/axstack\/scripts\/pr-shape\.js/);
});

const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/watch-sandbox-bun-`);
afterAll(() => rmSync(root, { recursive: true }));

test('watch-documented invocation ignores PR Bun preloads and dotenv Git/PATH poisoning', async () => {
  const repo = `${root}/PR checkout`;
  mkdirSync(repo);
  const git = (...args) => {
    const result = Bun.spawnSync(['git', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: repo });
    if (result.exitCode) throw Error(result.stderr.toString());
    return result.stdout.toString().trim();
  };
  const commit = () => {
    git('add', '--all');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  writeFileSync(`${repo}/README.md`, 'base\n');
  const base = commit();
  mkdirSync(`${repo}/skills/axstack/sandbox`, { recursive: true });
  writeFileSync(`${repo}/skills/axstack/sandbox/a.txt`, 'sandbox change\n');
  const marker = `${root}/preload-executed`;
  writeFileSync(`${repo}/bunfig.toml`, 'preload = ["./preload.js"]\n');
  writeFileSync(`${repo}/preload.js`, `await Bun.write(${JSON.stringify(marker)}, 'executed'); console.log('{"sandbox-path":{"status":"pass"}}'); process.exit(0);\n`);
  writeFileSync(`${repo}/.env`, `PATH=${root}/fake-bin\nGIT_DIR=${root}/wrong-git\nGIT_WORK_TREE=${root}/wrong-tree\n`);
  commit();
  const reference = new URL('../../skills/axstack-watch/references/readiness.md', import.meta.url);
  const helper = new URL(watch.match(/\[pr-shape\.js\]\(([^)]+)\)/)[1], reference).pathname;
  // Negative control: the old watch invocation really executes this preload.
  const unsafe = Bun.spawnSync([process.execPath, helper, '--base', base, '--head', 'HEAD'], { cwd: repo });
  expect(unsafe.exitCode, unsafe.stderr.toString()).toBe(0);
  expect(JSON.parse(unsafe.stdout.toString())['sandbox-path'].status).toBe('pass');
  expect(await Bun.file(marker).text()).toBe('executed');
  rmSync(marker);
  const template = watch.match(/`(bun [^`]*<resolved-helper>[^`]*)`/)[1];
  const values = { bun: process.execPath, '<resolved-helper>': helper, '<PR checkout>': repo,
    '<base-sha>': base, '<head-sha>': 'HEAD' };
  const argv = template.match(/<[^>]+>|\S+/g).map((token) => values[token] ?? token);
  const cwd = watch.match(/trusted cwd `([^`]+)`/)?.[1] ?? repo;
  const result = Bun.spawnSync(argv, { cwd });
  expect(result.exitCode, result.stderr.toString()).toBe(0);
  expect(JSON.parse(result.stdout.toString())['sandbox-path'].status).toBe('fail');
  expect(await Bun.file(marker).exists()).toBe(false);
});
