import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';

const skills = `${import.meta.dir}/../../skills`;
const files = readdirSync(skills, { recursive: true });

function citedFlags(markdown) {
  const citations = [];
  // Inline commands, fenced commands with continuations, and wrapped flags.
  for (const [, script, args] of markdown.matchAll(
    /scripts\/([\w-]+\.js)((?:[^`\n]|\\\n|\n(?=\s*[\[(]?--))*)/g,
  )) {
    for (const flag of args.match(/--[a-z][a-z0-9-]*/g) ?? []) citations.push({ script, flag });
  }
  return citations;
}

function missingFlags(markdown, help) {
  return citedFlags(markdown).filter(({ script, flag }) => {
    if (!help.has(script)) return false; // Existing helpers without --help keep their contract.
    const advertised = new Set(help.get(script).match(/--[a-z][a-z0-9-]*/g));
    return !advertised.has(flag);
  });
}

test('packaged script flags are advertised by the supporting helper --help', () => {
  const help = new Map();
  for (const path of files.filter((path) => /\/scripts\/[^/]+\.js$/.test(path))) {
    // Do not execute legacy helpers that lack a help interface (some can write).
    if (!readFileSync(`${skills}/${path}`, 'utf8').includes('--help')) continue;
    const result = Bun.spawnSync([process.execPath, `${skills}/${path}`, '--help'], {
      stdout: 'pipe', stderr: 'pipe', timeout: 5000,
    });
    expect(result.exitCode, `${path} --help: ${result.stderr}`).toBe(0);
    help.set(path.split('/').at(-1), result.stdout.toString());
  }
  expect(help.size).toBeGreaterThan(0);
  const gaps = files.filter((path) => path.endsWith('.md')).flatMap((path) =>
    missingFlags(readFileSync(`${skills}/${path}`, 'utf8'), help).map((gap) => ({ path, ...gap })));
  expect(gaps).toEqual([]);
});

test('flag discovery covers future helpers, alternatives, continuations and exact flag tokens', () => {
  const prose = '`scripts/future.js --repo <path with spaces> [--rev <sha>]`\n'
    + '```sh\nbun scripts/future.js \\\n  --run (--out <path> | --baseline <file>)\n```\n'
    + '`scripts/future.js\n  --verify <read-back>`\n'
    + '`scripts/legacy.js --old`';
  const help = new Map([['future.js', '--repo --rev --run --out --baseline --verify']]);
  expect(citedFlags(prose).map(({ flag }) => flag)).toEqual([
    '--repo', '--rev', '--run', '--out', '--baseline', '--verify', '--old',
  ]);
  expect(missingFlags(prose, help)).toEqual([]);
  help.set('future.js', '--repo --revision --run --out --baseline --verify');
  expect(missingFlags(prose, help)).toEqual([{ script: 'future.js', flag: '--rev' }]);
});
