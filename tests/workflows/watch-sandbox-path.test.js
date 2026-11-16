import { readFileSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { checkRule, requires } from './prose-contract.js';

const watch = readFileSync(`${import.meta.dir}/../../skills/axstack-watch/references/readiness.md`, 'utf8');

// Watch is an instruction interface: verify its real consumer, including
// removal/inversion negatives and equivalent wording, rather than simulating it.
for (const [name, concepts, rewording, inversion] of [
  ['runs the installed helper in the PR repository at the current head and base',
    [/run/i, /installed/i, /pr-shape\.js/, /--base <base-sha> --head <head-sha>/,
      /(?:PR repository as cwd|cwd (?:in|to) the PR repository)/i, /current head and base SHA/i],
    'At the current head and base SHA run the installed pr-shape.js with --base <base-sha> --head <head-sha>, setting cwd to the PR repository.',
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
    checkRule(watch.replace(/`/g, ''), (text) => requires(text, ...concepts),
      rewording, [inversion], concepts);
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
