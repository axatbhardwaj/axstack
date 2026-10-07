import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
const skill = () => read('skills/axstack-verify/SKILL.md');
// These prompt contracts guard generated recipes and their acceptance boundary.
// Existing UI proof tests do not cover generation, isolation, or harness discovery.
const rules = [
  ['single behavior', [/single.behavior/i, /route|send/i, /existing/i, /verify-<app>/i, /UI verification/i], 'Send single-behavior requests to an existing verify-<app> skill or UI verification delegation.', [/existing/gi, 'newly generated']],
  ['creation guard', [/create/i, /single.behavior/i], 'Never use create for single-behavior requests.', [/never/gi, 'Always'], /never/i],
  ['delivery', [/create/i, /axstack-implement/i, /one writer/i, /one PR/i], 'Deliver create through axstack-implement with one writer and one PR.', [/one writer/gi, 'parallel writers']],
  ['repo discovery', [/read|inspect/i, /repository/i, /surface/i, /run/i, /drive/i, /observe/i, /isolate/i], 'Inspect the repository for surface, run, drive, observe and isolate facts.', [/inspect|read/gi, 'skip']],
  ['harness reuse', [/reuse/i, /existing harnesses/i, /before/i, /new/i], 'Reuse existing harnesses before choosing new tools.', [/before/gi, 'after']],
  ['preservation', [/preserve/i, /existing skills/i], 'Preserve existing skills.', [/preserve/gi, 'overwrite']],
  ['collision', [/resolve/i, /name collisions/i, /explicitly/i, /before/i, /writing/i], 'Resolve name collisions explicitly before writing.', [/before/gi, 'after']],
  ['skill layout', [/write/i, /\.agents\/skills\/verify-<app>\/SKILL\.md/i, /Launch/i, /Doctor/i, /Drive/i, /Evidence/i, /Cleanup/i, /Helpers/i], 'Write .agents/skills/verify-<app>/SKILL.md with Launch, Doctor, Drive, Evidence, Cleanup and Helpers sections.', [/write/gi, 'skip']],
  ['frontmatter', [/only/i, /name/i, /description/i, /frontmatter/i, /keys/i], 'Use only name and description as frontmatter keys.', [/only/gi, 'extra keys beyond']],
  ['feature map', [/write/i, /features\/README\.md/i, /index/i, /top 3-5/i, /user features/i], 'Write features/README.md as an index of the top 3-5 user features.', [/top 3-5/gi, 'one convenient']],
  ['feature proof', [/each feature file/i, /entry points/i, /prerequisites/i, /drive/i, /observable/i, /proof/i], 'Give each feature file its entry points, prerequisites, drive steps and observable proof.', [/observable/gi, 'assumed']],
  ['symlink', [/commit/i, /relative symlink/i, /\.claude\/skills\/verify-<app>/i, /\.agents\/skills\/verify-<app>/i], 'Commit a relative symlink from .claude/skills/verify-<app> to .agents/skills/verify-<app>.', [/relative/gi, 'absolute']],
  ['helpers', [/helpers/i, /executable/i, /invocation/i, /skill body/i], 'Make helpers executable and show each invocation in the skill body.', [/executable/gi, 'disabled']],
  ['helper logic', [/helper logic/i, /red\/green/i, /before/i, /implementation/i], 'Test helper logic red/green before implementation.', [/before/gi, 'after']],
  ['executed proof', [/execute/i, /launch/i, /doctor/i, /drive one mapped feature/i, /capture evidence/i, /clean up/i, /confirm/i, /evidence survives/i], 'Execute launch, doctor, drive one mapped feature, capture evidence, clean up and confirm evidence survives.', [/execute/gi, 'skip']],
  ['TDD exception', [/record/i, /bounded exception/i, /generated.skill content/i, /TDD:/i, /implement.*5/i], 'Record the bounded exception for generated-skill content on the implement §5 TDD: line.', [/bounded exception/gi, 'unlimited exemption']],
  ['prose TDD', [/keep/i, /axstack-verify/i, /prose.contract/i, /red\/green/i], 'Keep axstack-verify prose-contract red/green tests.', [/keep/gi, 'skip']],
  ['browser boundary', [/browser drives/i, /UI verification/i, /axstack-ui-verifier/i, /feature file path/i, /brief/i], 'Delegate browser drives through UI verification to axstack-ui-verifier with the feature file path in the brief.', [/axstack-ui-verifier/gi, 'author']],
  ['author surfaces', [/author drives/i, /only/i, /non.browser surfaces/i], 'The author drives only non-browser surfaces.', [/only non-browser/gi, 'all']],
  ['harness checks', [/check/i, /discovery/i, /relative.helper execution/i, /Claude Code/i, /Codex/i], 'Check discovery and relative-helper execution in both Claude Code and Codex.', [/both Claude Code and Codex/gi, 'one harness']],
  ['doctor ordering', [/doctor/i, /before/i, /each drive/i], 'Run doctor before each drive.', [/before/gi, 'after']],
  ['bounded retry', [/retry/i, /once/i, /after/i, /drift fix/i], 'Retry once after a drift fix.', [/once/gi, 'indefinitely']],
  ['failed cleanup', [/clean up/i, /after/i, /every failed attempt/i], 'Clean up after every failed attempt.', [/every failed attempt/gi, 'success only']],
  ['evidence', [/keep/i, /evidence/i, /private evidence folder/i, /after cleanup/i], 'Keep evidence in the private evidence folder after cleanup.', [/after cleanup/gi, 'until cleanup']],
  ['product boundary', [/edit product code/i, /fix the build/i], 'Never edit product code or fix the build.', [/never/gi, 'Always'], /never/i],
  ['build hold', [/failing build/i, /report/i, /hold/i], 'For a failing build, report it and hold generation.', [/hold/gi, 'continue']],
  ['scratch', [/launch/i, /owned 0700 TMPDIR/i, /outside HOME/i, /data/i, /home/i, /port bookkeeping/i], 'Launch with an owned 0700 TMPDIR outside HOME for data, home and port bookkeeping.', [/outside HOME/gi, 'inside HOME']],
  ['loopback', [/listen/i, /loopback only/i], 'Listen on loopback only.', [/loopback only/gi, 'all interfaces']],
  ['secrets', [/production secrets/i], 'Never use production secrets.', [/never/gi, 'Always'], /never/i],
  ['literal cleanup', [/clean up/i, /literal absolute paths/i, /owned/i], 'Clean up owned resources by literal absolute paths.', [/literal absolute paths/gi, 'shared roots']],
  ['peer recipe', [/peer PR/i, /read/i, /Launch recipe/i, /helpers/i, /base revision/i, /execute/i, /pinned candidate/i], 'For a peer PR, read the Launch recipe and helpers from the base revision and execute against the pinned candidate.', [/base revision/gi, 'peer candidate']],
  ['served revision', [/evidence/i, /served SHA/i], 'Bind evidence to the served SHA.', [/served SHA/gi, 'branch name']],
  ['unavailable run', [/unavailable candidate run/i, /report/i, /unverified/i], 'Report an unavailable candidate run as unverified.', [/unverified/gi, 'passed']],
];

for (const [name, concepts, rewording, inversion, prohibition] of rules) {
  test(`verify create: ${name}`, () => {
    const source = skill().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
    const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(source, accepts, rewording, [inversion], concepts);
  });
}

test('verify is model-invocable with two modes and pinned MIT credit', () => {
  expect(skill().match(/^---\n([\s\S]*?)\n---/)?.[1].split('\n').map((line) => line.split(':')[0])).toEqual(['name', 'description']);
  expect(skill()).toMatch(/^## Create$/m);
  expect(skill()).toMatch(/^## Maintain$/m);
  expect(skill()).toContain('https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/create-verification-skill/SKILL.md');
  expect(skill()).toContain('(MIT)');
});

test('verification skill requests route to axstack-verify', () => {
  const source = read('skills/axstack/references/routing.md').split('\n').find((line) => /verification skill/i.test(line)) ?? '';
  checkRule(source, (text) => requires(text, /create|maintain/i, /verification skill/i, /route|send/i, /axstack-verify/i),
    'Send requests to create or maintain a verification skill to axstack-verify.', [[/axstack-verify/gi, 'axstack-perf']], [/axstack-verify/i]);
});
