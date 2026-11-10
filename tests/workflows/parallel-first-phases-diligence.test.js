import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (phase) => readFileSync(
  `${import.meta.dir}/../../skills/axstack-${phase}/SKILL.md`, 'utf8',
).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// Real shipped instructions, not simulated agent decisions or live compliance.
test('M1 Correct prohibits all file edits except report and private evidence', () => {
  const ban = /(?:never|do not) (?:edit|modify|write)(?: any)? files/i;
  checkRule(read('correct'), (text) => prohibits(text, ban,
    /except|other than/i, /report/i, /workers?.{0,20}private evidence/i),
  "Do not modify any files other than the report and workers' private evidence.",
  [[ban, 'Freely modify files']], [/except|other than/i, /report/i, /private evidence/i]);
});

test('M1 Correct retains selected records, explicit invocation and transcript privacy', () => {
  const source = read('correct');
  checkRule(source, (text) => requires(text, /run|act/i, /only/i, /user.*request/i),
    "Act only at the user's request.", [[/only/i, 'automatically without']]);
  checkRule(source, (text) => requires(text, /write|produce/i, /report only|only a report/i),
    'Produce only a report.', [[/report only|only a report/i, 'report and source fixes']]);
  checkRule(source, (text) => requires(text, /read|inspect/i, /git history/i, /bounded by|within/i, /selected runs/i),
    'Inspect git history within the selected runs.', [[/bounded by|within/i, 'beyond']]);
  checkRule(source, (text) => prohibits(text, /never|do not/i, /read transcripts/i),
    'Do not read transcripts.', [[/never|do not/i, 'Always']]);
});

