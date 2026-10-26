import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

// These are separate user-facing dispatch entry points, not runtime copies.
const paths = ['docs/concepts.md', 'docs/installation.md', 'docs/workflows.md', 'skills/axstack-review/SKILL.md'];
const rules = [
  [[/every role/i, /including authors/i, /delegate_task/, /isolation:"worktree"/],
    'Use delegate_task for every role including authors with isolation:"worktree".', [/delegate_task/, 't3_thread_launch']],
  [[/top-level drivers/i, /t3_thread_launch/],
    'Top-level drivers use t3_thread_launch.', [/use/, 'avoid']],
  [[/author fallback/i, /t3_thread_launch/, /only when worktree isolation is unavailable/i, /record.*each use.*run record/i],
    'Use t3_thread_launch as an author fallback only when worktree isolation is unavailable and record each use in the run record.', [/only when/i, 'even when']],
];
for (const path of paths) for (const [concepts, rewording, inversion] of rules) {
  test(`hidden author routing in ${path}: ${concepts[0]}`, () => {
    const text = sentences(readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/`/g, '')).join('. ');
    const required = [...concepts, inversion[0]];
    checkRule(text, (source) => requires(source, ...required), rewording, [inversion], required);
  });
}
