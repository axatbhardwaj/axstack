import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = () => readFileSync(`${import.meta.dir}/../../skills/axstack-verify/SKILL.md`, 'utf8');
const maintain = () => sentences(read().split('## Maintain\n')[1].split(/\n## /)[0]).join('. ');
// AC16 adds full-map coverage and triage. Create's one-feature proof cannot
// detect a maintain pass that skips source, live driving, or failure recovery.
// Check the maintain procedure itself and mutate real source only in memory.
const rules = [
  ['index hygiene', [/check/i, /index hygiene/i, /\.agents\/skills\/verify-<app>\/features\/README\.md/i, /sibling files/i, /missing/i, /extra/i, /duplicate/i, /dead/i], 'Check index hygiene against .agents/skills/verify-<app>/features/README.md and sibling files for missing, extra, duplicate and dead entries.', [/check/gi, 'skip']],
  ['feature source', [/read/i, /each mapped feature/i, /source/i, /entry points/i, /citations/i], 'Read each mapped feature from source and record entry points with citations.', [/each mapped feature/gi, 'one convenient feature']],
  ['serial source', [/parallel source wave/i], 'Never launch a parallel source wave.', [/never/gi, 'Always'], /never/i],
  ['no schedule', [/schedule/i, /maintain/i], 'Never schedule maintain runs.', [/never/gi, 'Always'], /never/i],
  ['edit boundary', [/edit/i, /only/i, /verification skill/i, /directory/i], "Edit only the verification skill's own directory.", [/only/gi, 'beyond']],
  ['all live', [/drive/i, /every mapped feature/i, /live/i, /even when/i, /source/i, /clean/i], 'Drive every mapped feature live even when source looks clean.', [/every mapped feature/gi, 'one convenient feature']],
  ['doctor ordering', [/doctor/i, /before/i, /each drive/i], 'Run doctor before each drive.', [/before/gi, 'after']],
  ['doc drift', [/doc drift/i, /fix/i, /map/i], 'For doc drift, fix the map.', [/fix/gi, 'retain']],
  ['harness gap', [/harness gap/i, /fix/i, /recipe/i], 'For a harness gap, fix the recipe.', [/fix/gi, 'retain']],
  ['regression route', [/product regression/i, /report/i, /driver/i, /routes/i, /axstack-debug/i], 'For a product regression, report it to the driver, which routes it to axstack-debug.', [/driver/gi, 'docs author']],
  ['no docs regression fix', [/fix/i, /product regression/i, /docs/i], 'Never fix a product regression in docs.', [/never/gi, 'Always'], /never/i],
  ['omitted entry points', [/report/i, /omitted entry points/i, /source paths/i, /separately from passes/i], 'Report omitted entry points with source paths separately from passes.', [/separately from passes/gi, 'as passes']],
  ['unreachable prerequisites', [/report/i, /unreachable prerequisites/i, /attempted routes/i, /separately from passes/i], 'Report unreachable prerequisites with attempted routes separately from passes.', [/separately from passes/gi, 'as passes']],
  ['incomplete hold', [/report/i, /incomplete mapped coverage/i, /clean/i], 'Never report incomplete mapped coverage as clean.', [/never/gi, 'Always'], /never/i],
  ['clean outcome', [/report/i, /clean/i, /only/i, /every mapped feature/i, /source and live coverage/i, /successful drives/i, /zero corrections/i], 'Report clean only when every mapped feature has source and live coverage with successful drives and zero corrections.', [/successful drives/gi, 'failed drives']],
  ['build hold', [/failing build/i, /report/i, /hold live driving/i], 'For a failing build, report it and hold live driving.', [/hold live driving/gi, 'continue live driving']],
  ['changed outcome', [/report/i, /changed/i, /one PR/i, /proven/i, /corrections/i], 'Report changed for one PR of proven corrections.', [/one PR/gi, 'several PRs']],
  ['blocked outcome', [/report/i, /blocked/i, /coverage/i, /cannot finish/i, /safely/i, /ship/i], 'Report blocked when coverage cannot finish or corrections cannot ship safely.', [/blocked/gi, 'clean']],
  ['bounded retry', [/retry/i, /once/i, /after/i, /drift fix/i], 'Retry once after a drift fix.', [/once/gi, 'indefinitely']],
  ['retry failure', [/retry fails/i, /report/i, /blocked/i, /hold acceptance/i], 'If the retry fails, report blocked and hold acceptance.', [/hold acceptance/gi, 'accept the pass']],
  ['failed cleanup', [/clean up/i, /after/i, /every failed attempt/i], 'Clean up after every failed attempt.', [/every failed attempt/gi, 'success only']],
  ['evidence survival', [/confirm/i, /evidence survives/i, /each cleanup/i, /private evidence folder/i], 'Confirm evidence survives each cleanup in the private evidence folder.', [/survives/gi, 'is removed by']],
  ['browser boundary', [/delegate/i, /browser drives/i, /UI verification/i, /axstack-ui-verifier/i, /feature file path/i, /brief/i], 'Delegate browser drives through UI verification to axstack-ui-verifier with the feature file path in the brief.', [/axstack-ui-verifier/gi, 'author']],
  ['isolation reuse', [/follow/i, /attempt isolation/i, /both modes/i], 'Follow attempt isolation for both modes.', [/both modes/gi, 'create only']],
];

for (const [name, concepts, rewording, inversion, prohibition] of rules) {
  test(`verify maintain: ${name}`, () => {
    const accepts = (text) => sentences(text).some((sentence) =>
      !/\b(?:unless|except)\b/i.test(sentence)
      && (prohibition ? prohibits(sentence, prohibition, ...concepts) : requires(sentence, ...concepts)));
    checkRule(maintain(), accepts, rewording.replace(/\.$/, ''),
      [inversion, [/^/, 'Do not '], [/$/, ' unless convenient']], concepts);
  });
}

test('verify maintain: delivery retains one writer and one PR', () => {
  const source = sentences(read()).join('. ');
  checkRule(source, (text) => requires(text, /deliver/i, /maintain/i, /axstack-implement/i, /one writer/i, /one PR/i),
    'Deliver create and maintain through axstack-implement with one writer and one PR.',
    [[/one writer/gi, 'parallel writers'], [/one PR/gi, 'several PRs']], [/maintain/i, /one writer/i, /one PR/i]);
});

test('verify maintain: pinned source credit and license', () => {
  expect(read()).toContain('https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/maintain-verification-skill/SKILL.md');
  expect(read()).toMatch(/maintain-verification-skill\]\([^)]+\) \(MIT\)/);
});
