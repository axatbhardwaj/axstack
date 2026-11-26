import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => Bun.file(new URL(`../../skills/${path}`, import.meta.url));
const watchdogPath = read('axstack/workflows/watchdog-prompt.md');
const voa = readFileSync(new URL('../../skills/voa/SKILL.md', import.meta.url), 'utf8');

test('the watchdog is read-only and never grants authority or clears holds', async () => {
  const prompt = await watchdogPath.exists() ? await watchdogPath.text() : '';
  const readOnly = /read.only|observation.only/i;
  checkRule(prompt, (text) => requires(text, readOnly), 'Conduct an observation-only check.',
    [[readOnly, 'read and write']], [readOnly]);
  for (const [action, rewording] of [
    [/\b(?:grant|confer)\b.*\bauthority\b/i, 'Do not confer authority.'],
    [/\b(?:clear|lift)\b.*\bholds?\b/i, 'Do not lift holds.'],
    [/\b(?:start|launch)\b.*\bruns?\b/i, 'Do not launch workflow runs.'],
    [/\b(?:resume|restart)\b.*\bruns?\b/i, 'Do not restart paused runs.'],
    [/\b(?:cancel|stop)\b.*\bruns?\b/i, 'Do not stop active runs.'],
  ]) {
    const denial = /\b(?:never|do not)\b/i;
    checkRule(prompt, (text) => prohibits(text, denial, action), rewording,
      [[denial, 'Always']], [action]);
  }
});

test('the sweep reports workflow health per host and reads the latest watchdog report', () => {
  const health = [
    /\b(?:report|list|surface)\b/i, /\b(?:per host|for each host)\b/i,
    /\bpaus\w*/i, /\b(?:stale|wedged)\b/i, /\bworkflow\w*\b/i,
    /\bdefinition\w*\b.*\b(?:problem|fail|error)\w*/i,
  ];
  checkRule(voa, (text) => requires(text, ...health),
    'For each host, surface paused or wedged workflow runs and definition registration failures.',
    [[health[0], 'Skip']], health);
  const latest = [/\b(?:read|inspect)\b/i, /\b(?:latest|most recent)\b/i, /\bwatchdog\b/i, /\b(?:report|findings)\b/i];
  checkRule(voa, (text) => requires(text, ...latest),
    'Inspect the most recent watchdog findings.', [[latest[0], 'Skip']], latest);
});
