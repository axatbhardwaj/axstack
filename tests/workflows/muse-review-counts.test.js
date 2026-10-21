import { expect, test } from 'bun:test';
import { readSkillFile } from './skill-source.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readSkillFile(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');
const candidate = read('skills/axstack-review/references/review-candidate.md');
const peer = read('skills/axstack-review/references/peer-mode.md');
const review = read('skills/axstack-review/SKILL.md');
const roster = read('skills/axstack/references/role-roster.md');
const lifecycle = read('skills/axstack/references/lifecycle.md');
const automation = read('skills/axstack/references/automations.md');
const docs = read('docs/workflows.md');
const readiness = read('skills/axstack-watch/references/readiness.md');

// Each probe changes a scratch string in memory; shipped files stay untouched.
function rule(source, pattern, rewording, inversion) {
  const match = source.match(pattern);
  expect(match, `missing rule: ${pattern}`).not.toBeNull();
  const sentence = match[0];
  expect(source.replace(sentence, '')).not.toMatch(pattern);
  expect(source.replace(sentence, inversion)).not.toMatch(pattern);
  expect(source.replace(sentence, rewording)).toMatch(pattern);
}

test('mixed first peer review has three independent receipts or two after verified Muse absence', () => {
  const pattern = /mixed first peer review[^.]*\b(?:three|3)\b[^.]*axstack-reviewer-primary[^.]*axstack-reviewer-peer[^.]*axstack-reviewer-muse[^.]*\b(?:two|2)\b[^.]*verified Muse absence[^.]*exact (?:SHA|head)[^.]*base[^.]*isolated first pass/i;
  rule(candidate, pattern,
    'Mixed first peer review needs 3 receipts from axstack-reviewer-primary, axstack-reviewer-peer and axstack-reviewer-muse, or 2 with verified Muse absence, all at the exact head and base after an isolated first pass.',
    'Mixed first peer review needs two receipts and may ignore a launched Muse seat.');
  for (const text of [review, peer, lifecycle, automation, docs]) {
    expect(text).toMatch(/(?:mixed|first peer)[^.]*\b(?:three|3)\b[^.]*\b(?:two|2)\b[^.]*verified Muse absence/i);
  }
  expect(peer).toMatch(/never dispatch diligence in peer mode/i);
  expect(peer).toMatch(/peer[^.]*(?:only|terms)[^.]*no authored acceptance/i);
});

test('first peer pass stays isolated and imports no authored gates', () => {
  rule(peer, /Each covers the exact (?:SHA|head) and base[^.]*full diff[^.]*all six angles[^.]*identical brief[^.]*isolated first pass/i,
    'Each covers the exact head and base, full diff and all six angles with the identical brief and an isolated first pass.',
    'Each can cross-read a prior receipt on a stale head.');
  rule(peer, /Peer terms only[^.]*no authored acceptance[^.]*diligence[^.]*imported/i,
    'Peer terms only: no authored acceptance or diligence obligation is imported.',
    'Peer review imports authored acceptance and diligence.');
  rule(peer, /(?:Never dispatch diligence|Diligence is never dispatched) in peer mode/i,
    'Diligence is never dispatched in peer mode.',
    'Dispatch diligence in peer mode.');
});

test('mixed Sol authored review has two receipts or one with verified Muse absence', () => {
  const pattern = /mixed Sol-authored[^.]*\b(?:two|2)\b[^.]*axstack-reviewer-secondary[^.]*axstack-reviewer-muse[^.]*\b(?:one|1)\b[^.]*verified Muse absence/i;
  rule(candidate, pattern,
    'Mixed Sol-authored review needs 2 receipts, axstack-reviewer-secondary and axstack-reviewer-muse, or 1 after verified Muse absence.',
    'Mixed Sol-authored review needs only the secondary reviewer, even when Muse launched.');
  for (const text of [review, roster, docs]) expect(text).toMatch(/Sol.authored[^.]*\b(?:two|2)\b[^.]*\b(?:one|1)\b[^.]*verified Muse absence/i);
});

test('either Sol-authored seat can block, and repairs increments once per round', () => {
  const pattern = /(?:either|any) (?:reviewer )?seat[^.]*validated medium\/high[^.]*blocks?[^.]*\b(?:one|1)\b[^.]*repairs[^.]*per round/i;
  rule(candidate, pattern,
    'Either seat with a validated medium/high finding blocks approval; one repairs increment is recorded per round.',
    'Only Opus findings block; repairs increments for each seat.');
  expect(review).toMatch(/(?:either|any) (?:reviewer )?seat[^.]*medium\/high[^.]*blocks?/i);
  rule(candidate, /Either seat(?:'s| with a) validated medium\/high finding blocks approval/i,
    'Either seat with a validated medium/high finding blocks approval.',
    'Only the Opus seat can block approval.');
  rule(candidate, /(?:record|log) (?:one|1) `repairs` increment per round regardless of seat count/i,
    'Log 1 `repairs` increment per round regardless of seat count.',
    'Log one repairs increment for each blocking seat.');
});

test('Opus authored and single-provider counts stay one; Muse is not dispatched there', () => {
  const pattern = /mixed Opus-authored[^.]*\b(?:one|1)\b[^.]*axstack-reviewer-primary[^.]*no Muse seat/i;
  rule(candidate, pattern,
    'Mixed Opus-authored review keeps 1 axstack-reviewer-primary receipt and no Muse seat.',
    'Mixed Opus-authored review adds a Muse seat.');
  const single = /single-provider presets[^.]*\b(?:one|1)\b[^.]*Muse[^.]*never dispatched/i;
  rule(candidate, single,
    'Single-provider presets retain 1 authored receipt; Muse seats are never dispatched.',
    'Single-provider presets dispatch Muse as a second reviewer.');
  rule(peer, /Single-provider first review[^.]*\b(?:two|2)\b[^.]*never dispatches Muse/i,
    'Single-provider first review keeps 2 configured reviewers and never dispatches Muse.',
    'Single-provider first review uses three reviewers including Muse.');
});

test('peer follow-up keeps exactly one primary receipt', () => {
  const pattern = /peer follow-up[^.]*exactly (?:one|1)[^.]*axstack-reviewer-primary[^.]*receipt/i;
  rule(peer, pattern,
    'Peer follow-up still requires exactly 1 axstack-reviewer-primary receipt.',
    'Peer follow-up requires Muse and primary receipts.');
  expect(candidate).toMatch(pattern);
});

test('readiness requires every mode-required authored approval at current head and base', () => {
  const pattern = /every mode-required authored reviewer receipt[^.]*APPROVE[^.]*current head and base[^.]*verified Muse absence allowed/i;
  rule(readiness, pattern,
    'Every mode-required authored reviewer receipt must APPROVE at the current head and base; verified Muse absence allowed.',
    'One reviewer approval at an old head is enough.');
  expect(review).toMatch(pattern);
  expect(lifecycle).toMatch(pattern);
  expect(docs).toMatch(pattern);
});
