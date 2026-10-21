import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readSkillFile } from './skill-source.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readSkillFile(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');
const raw = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');
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

function replaceOnce(source, before, after) {
  expect(source.split(before)).toHaveLength(2);
  return source.replace(before, after);
}

test('mixed first peer review has three independent receipts or two after verified Muse absence', () => {
  const pattern = /mixed first peer review[^.]*\b(?:three|3)\b[^.]*axstack-reviewer-primary[^.]*axstack-reviewer-peer[^.]*axstack-reviewer-muse[^.]*\bor (?:two|2) with verified Muse absence[^.]*exact (?:SHA|head)[^.]*base[^.]*isolated first pass/i;
  rule(candidate, pattern,
    'Mixed first peer review needs 3 receipts from axstack-reviewer-primary, axstack-reviewer-peer and axstack-reviewer-muse, or 2 with verified Muse absence, all at the exact head and base after an isolated first pass.',
    'Mixed first peer review needs two receipts and may ignore a launched Muse seat.');
  expect(pattern.test('Mixed first peer review needs 3 receipts from axstack-reviewer-primary, axstack-reviewer-peer and axstack-reviewer-muse, or two without verified Muse absence, at the exact SHA and base after an isolated first pass.')).toBe(false);
  expect(pattern.test(replaceOnce(candidate.match(pattern)[0], 'or two with verified Muse absence', 'or two without verified Muse absence'))).toBe(false);
  for (const text of [review, peer, lifecycle, automation, docs]) {
    expect(text).toMatch(/(?:mixed|first peer)[^.]*\b(?:three|3)\b[^.]*\b(?:two|2)\b[^.]*verified Muse absence/i);
  }
  expect(peer).toMatch(/never dispatch diligence in peer mode/i);
  expect(peer).toMatch(/peer[^.]*(?:only|terms)[^.]*no authored acceptance/i);
});

test('first peer pass stays isolated and imports no authored gates', () => {
  const isolation = /Each covers the exact (?:SHA|head) and base[^.]*full diff[^.]*all six angles[^.]*identical brief[^.]*(?:and|with|after) an isolated first pass/i;
  rule(peer, isolation,
    'Each covers the exact head and base, full diff and all six angles with the identical brief and an isolated first pass.',
    'Each can cross-read a prior receipt on a stale head.');
  expect(isolation.test('Each covers the exact SHA and base, full diff and all six angles independently with the identical brief and without an isolated first pass.')).toBe(false);
  expect(isolation.test(replaceOnce(peer.match(isolation)[0], 'and an isolated first pass', 'and without an isolated first pass'))).toBe(false);
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
  const block = /(?:\bEither seat(?:'s| with a) validated medium\/high finding blocks approval\b|\bA validated medium\/high finding from either seat blocks approval\b)/i;
  const repairs = /(?:record|log) (?:one|1) `?repairs`? increment per round regardless of seat count|regardless of seat count, (?:record|log) (?:one|1) `?repairs`? increment per round/i;
  rule(candidate, block,
    'A validated medium/high finding from either seat blocks approval.',
    "Neither seat's validated medium/high finding blocks approval.");
  rule(candidate, repairs,
    'Regardless of seat count, record one `repairs` increment per round.',
    'Record one `repairs` increment per blocking seat.');
  const specWording = 'A validated medium/high finding from either seat blocks approval; regardless of seat count, record one `repairs` increment per round.';
  expect(block.test(specWording) && repairs.test(specWording)).toBe(true);
  expect(block.test("Neither seat's validated medium/high finding blocks approval")).toBe(false);
  const blockClause = candidate.match(/Either seat's validated medium\/high finding blocks approval; record one `repairs` increment per round regardless of seat count/)[0];
  expect(block.test(replaceOnce(blockClause, "Either seat's", "Neither seat's"))).toBe(false);
  const fairWording = replaceOnce(blockClause, blockClause, specWording);
  expect(block.test(fairWording) && repairs.test(fairWording)).toBe(true);
  expect(review).toMatch(/(?:either|any) (?:reviewer )?seat[^.]*medium\/high[^.]*blocks?/i);
});

test('Opus authored and single-provider counts stay one; Muse is not dispatched there', () => {
  const pattern = /mixed Opus-authored[^.]*(?:keeps (?:one|1)|retains a single)[^.]*axstack-reviewer-primary[^.]*no Muse seat/i;
  rule(candidate, pattern,
    'Mixed Opus-authored review keeps 1 axstack-reviewer-primary receipt and no Muse seat.',
    'Mixed Opus-authored review adds a Muse seat.');
  expect(pattern.test('Mixed Opus-authored review retains a single `axstack-reviewer-primary` receipt with no Muse seat.')).toBe(true);
  expect(pattern.test(replaceOnce(candidate.match(pattern)[0], 'keeps one', 'retains a single'))).toBe(true);
  const single = /single-provider presets[^.]*\b(?:one|1)\b[^.]*Muse[^.]*never dispatched/i;
  rule(candidate, single,
    'Single-provider presets retain 1 authored receipt; Muse seats are never dispatched.',
    'Single-provider presets dispatch Muse as a second reviewer.');
  rule(peer, /Single-provider first review[^.]*\b(?:two|2)\b[^.]*never dispatches Muse/i,
    'Single-provider first review keeps 2 configured reviewers and never dispatches Muse.',
    'Single-provider first review uses three reviewers including Muse.');
});

test('peer follow-up keeps exactly one primary receipt', () => {
  const pattern = /peer follow-up(?![^.]*axstack-reviewer-muse)[^.]*exactly (?:one|1)[^.]*axstack-reviewer-primary[^.]*receipt/i;
  rule(peer, pattern,
    'Peer follow-up still requires exactly 1 axstack-reviewer-primary receipt.',
    'Peer follow-up requires Muse and primary receipts.');
  expect(pattern.test('Peer follow-up requires exactly one `axstack-reviewer-muse` receipt and one `axstack-reviewer-primary` receipt.')).toBe(false);
  expect(pattern.test(replaceOnce(peer.match(pattern)[0], 'requires exactly one `axstack-reviewer-primary` receipt',
    'requires exactly one `axstack-reviewer-muse` receipt and one `axstack-reviewer-primary` receipt'))).toBe(false);
  expect(candidate).toMatch(pattern);
});

test('watch repair publication requires every mode-required authored receipt', () => {
  const repair = raw('skills/axstack-watch/references/repair-publication.md');
  expect(repair).toMatch(/publication is held until every mode-required authored reviewer receipt[^.]*exact new revision and base/i);
  expect(repair).not.toMatch(/exactly one complete eligible non-author\/non-owner reviewer/i);
});

test('independent copies retain the Sol absence and Opus no-Muse rules', () => {
  const skill = raw('skills/axstack-review/SKILL.md');
  const roleRoster = raw('skills/axstack/references/role-roster.md');
  const sol = /Sol-authored review[^.]*two receipts[^.]*one with verified Muse absence/i;
  const opus = /Opus-authored review[^.]*one Sol receipt[^.]*no Muse seat/i;
  expect(skill).toMatch(sol);
  expect(skill.replace(/or one with verified Muse absence/i, '')).not.toMatch(sol);
  expect(roleRoster).toMatch(opus);
  expect(roleRoster.replace(/no Muse seat/i, 'a Muse seat')).not.toMatch(opus);
});

test('authored counts have an exact upper bound and retain eligible provenance routing', () => {
  expect(raw('skills/axstack-review/SKILL.md')).toMatch(/authored reviewer receipt count other than its mode-required count/i);
  expect(raw('skills/axstack-review/references/review-candidate.md')).toMatch(/exactly the mode-required eligible independent reviewers/i);
  expect(raw('skills/axstack/references/lifecycle.md')).toMatch(/authored[^.]*eligible[^.]*author provenance/i);
  expect(raw('docs/workflows.md')).toMatch(/authored[^.]*eligible[^.]*cross-family\/preset-mapped/i);
});

test('roster table closes before the Sol-authored rule', () => {
  const roleRoster = readFileSync(`${root}/skills/axstack/references/role-roster.md`, 'utf8');
  expect(roleRoster).toMatch(/\| `claude-only` \| `claude\/opus` \|[^\n]*\|\n\n  Mixed Sol-authored review/);
});

test('README and watch readiness describe all mode-required seats', () => {
  const readme = raw('README.md');
  expect(readme).toMatch(/mixed first peer review[^.]*three[^.]*two with verified Muse absence/i);
  expect(readme).toMatch(/authored[^.]*mode-required reviewer receipts/i);
  for (const path of ['skills/axstack-watch/references/readiness.md', 'docs/workflows.md']) {
    const text = raw(path);
    expect(text).toMatch(/every mode-required authored reviewer(?: seat)? rates each non-agent review thread/i);
    expect(text).toMatch(/rated `low` or `addressed` by every required seat does not hold automatic merge/i);
    expect(text).toMatch(/`above low`, unrated or `uncertain` rating from any required seat holds automatic merge/i);
  }
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
