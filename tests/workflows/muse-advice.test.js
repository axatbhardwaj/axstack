import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');

// Match the policy across rewrapped sentences and exercise removal and inversion.
const check = (text, required, inverted, equivalent) => {
  expect(text).toMatch(required);
  expect(text.replace(required, '')).not.toMatch(required);
  expect(text.replace(required, inverted)).not.toMatch(required);
  if (equivalent) expect(text.replace(required, equivalent)).toMatch(required);
};

test('only required Astra and Opus outages hold Align, Spec, and debug L1', () => {
  const rules = [
    ['axstack-align/SKILL.md', /Astra or Opus is unavailable[^.]*hold Align/i],
    ['axstack-spec/SKILL.md', /Astra or Opus is unavailable[^.]*hold Spec/i],
    ['axstack-debug/SKILL.md', /unavailable Astra or Opus[^.]*holds L1/i],
  ];
  for (const [path, rule] of rules) check(read(`skills/${path}`), rule, 'Muse outage holds the phase');
  const contracts = read('skills/axstack/references/contracts.md');
  check(contracts, /Astra or Opus is unavailable[^.]*hold[^.]*\. Verified Muse absence does not hold/i,
    'Muse unavailability holds Align and Spec');
});

test('advised self-close requires completed same-option agreement, never synthesis unanimity', () => {
  const text = read('skills/axstack/references/contracts.md');
  check(text, /every adviser that ran[^.]*(?:same|identical) option[^.]*one advice.driven attempt per PR and cause kind/i,
    'a split permits repeated advice-driven attempts',
    'Every adviser that ran recommends the identical option to permit one advice-driven attempt per PR and cause kind to close the cause within existing authority');
  check(text, /1-1-1[^.]*AGREE-WITH-CHANGES[^.]*split[^.]*card/i,
    'AGREE-WITH-CHANGES permits self-close');
  check(text, /pending Muse adviser blocks self.close/i, 'pending Muse permits self-close');
  check(text, /Late Muse advice never retroactively unlocks a self.close/i,
    'Late Muse advice retroactively unlocks self-close');
  check(text, /Align and Spec synthesis does not require unanimity/i,
    'Align and Spec synthesis requires unanimity');
  for (const status of ['advisers agree 3/3', 'advisers split 2-1',
    'advisers agree 2/2; advice unavailable: axstack-advisor-muse',
    'advisers agree 2/2; advice pending: axstack-advisor-muse']) {
    expect(text).toContain(status);
  }
  expect(text).toMatch(/Recommended: <option n> \(<combined adviser and availability statuses>\)/i);
});

test('verify-skip and step-back use the same completed-adviser boundary', () => {
  const align = read('skills/axstack-align/SKILL.md');
  check(align, /Skipping this first PR requires plain AGREE[^.]*every Muse adviser[^.]*unnecessary\. A pending Muse adviser blocks/i,
    'verify-skip accepts one conditional answer');
  const step = read('skills/axstack-implement/references/step-back.md');
  check(step, /every adviser that ran[^.]*(?:same|identical) path[^.]*pending Muse[^.]*blocks/i,
    'a split permits step-back',
    'Every adviser that ran recommends the identical path; pending Muse advice blocks the extra round');
  check(step, /unavailable Astra or Opus[^.]*counts as no agreement[^.]*\. Verified Muse absence does not count as no agreement/i,
    'Muse absence counts as no agreement');
});

test('arena sessions and Spark scope survive equivalent wording but reject inverted guidance', () => {
  const arena = read('skills/axstack-brainstorm/references/arena.md');
  check(arena, /Round-2 Astra uses a fresh session[^.]*never receives its round-1 receipt/i,
    'Round-2 Astra reuses its round-1 session and receipt',
    'Round-2 Astra uses a fresh session, never receives its round-1 receipt');
  const scout = read('skills/axstack-scout/SKILL.md');
  check(scout, /one optional `axstack-explore-codebase-flash` and one optional `axstack-explore-codebase-spark`[^.]*whole bounded question[^.]*eight seats/i,
    'Flash and Spark each run per facet with no cap',
    'One optional `axstack-explore-codebase-flash` and one optional `axstack-explore-codebase-spark` search the whole bounded question, for at most eight seats');
});
