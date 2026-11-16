import { readSkillFile } from './skill-source.js';
import { test } from 'bun:test';
import { checkRule, requires } from './prose-contract.js';

const watch = readSkillFile(`${import.meta.dir}/../../skills/axstack-watch/SKILL.md`, 'utf8')
  .split('## 5. State readiness precisely')[1].split('## 6.')[0];

// Watch is an instruction interface: verify its real consumer, including
// removal/inversion negatives and equivalent wording, rather than simulating it.
for (const [name, concepts, rewording, inversion] of [
  ['runs shape mode at the current head and base',
    [/run/i, /bun skills\/axstack\/scripts\/pr-shape\.js --base <base-sha> --head <head-sha>/,
      /current head and base SHA/i],
    'For the current head and base SHA run bun skills/axstack/scripts/pr-shape.js --base <base-sha> --head <head-sha>.',
    [/\brun\b/i, 'skip']],
  ['consumes a sandbox failure as a user merge',
    [/sandbox-path/i, /fail/i, /requires?/i, /user merge/i, /on the forge/i],
    'A fail for sandbox-path requires user merge on the forge.',
    [/user merge/i, 'automatic merge']],
  ['holds automatic merge when sandbox facts are unknown',
    [/sandbox-path/i, /unknown/i, /holds? automatic merge/i],
    'An unknown sandbox-path holds automatic merge.',
    [/holds? automatic merge/i, 'allows automatic merge']],
]) {
  test(`watch sandbox-path: ${name}`, () => {
    checkRule(watch.replace(/`/g, ''), (text) => requires(text, ...concepts),
      rewording, [inversion], concepts);
  });
}
