import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');
const ref = () => read('skills/axstack/references/autopilot.md');
const skill = (name) => read(`skills/${name}/SKILL.md`);

// These checks prove shipped contract text, not agent decisions or live wakes.
test('eligible delivery advances on completed identity and scopes recorded holds', () => {
  const text = ref();
  expect(text).toMatch(/authorized engineering.delivery runs/i);
  expect(text).toMatch(/completed identity[\s\S]*no hold affects the next action/i);
  expect(text).toMatch(/planning.only[\s\S]*read.only[\s\S]*stop.after.phase[\s\S]*observation.only[\s\S]*peer/i);
  expect(text).toMatch(/status question[\s\S]*observation[\s\S]*not a mode change/i);
  expect(text).toMatch(/hold[\s\S]*reason[\s\S]*resume condition/i);
});

test('small and substantial paths continue after their own authority gates', () => {
  const text = ref();
  expect(text).toMatch(/small[\s\S]*Align read.back[\s\S]*small.change intent[\s\S]*implement[\s\S]*watch/i);
  expect(text).toMatch(/substantial[\s\S]*Align[\s\S]*spec draft[\s\S]*human spec approval[\s\S]*tickets[\s\S]*implement/i);
  expect(skill('axstack-align')).not.toMatch(/The user invokes\s+`axstack-implement` to execute/);
  expect(skill('axstack-tickets')).toMatch(/autopilot/i);
});

test('first run PR arms maintain watch and later verified PRs join', () => {
  const text = ref();
  expect(text).toMatch(/first PR[\s\S]*exactly one[\s\S]*axstack-watch[\s\S]*maintain mode/i);
  expect(text).toMatch(/later[\s\S]*PRs[\s\S]*readback/i);
  expect(text).toMatch(/10.minute[\s\S]*harness[\s\S]*Orca fallback/i);
  expect(text).toMatch(/until[\s\S]*merge.ready[\s\S]*implement §6 step 4[\s\S]*after[\s\S]*watch §5/i);
  expect(text).toMatch(/every watched PR[\s\S]*merged or closed[\s\S]*release step[\s\S]*settled or not applicable/i);
});

test('release authority is per run and release closes after install', () => {
  const text = ref();
  expect(text).toMatch(/Release:[\s\S]*AGENTS\.md[\s\S]*tag.triggered workflow[\s\S]*named install hosts/i);
  expect(text).toMatch(/partial match[\s\S]*not applicable/i);
  expect(text).toMatch(/absent host list[\s\S]*hold/i);
  expect(text).toMatch(/Authority:[\s\S]*per run[\s\S]*never carries over/i);
  expect(text).toMatch(/release PR[\s\S]*authored review[\s\S]*diligence[\s\S]*human merge/i);
  expect(text).toMatch(/tag[\s\S]*staged publish[\s\S]*human npm stage approval[\s\S]*registry[\s\S]*install[\s\S]*Close.out last/i);
  expect(text).toMatch(/never run `npm stage approve`/i);
  expect(text).toMatch(/closed without merging[\s\S]*incomplete scope/i);
});

test('resume, cancel, and notifications retain decisions and budgets', () => {
  const text = ref();
  expect(text).toMatch(/every entry[\s\S]*reconcile[\s\S]*owner[\s\S]*Dispatch[\s\S]*approved revision[\s\S]*wakes/i);
  expect(text).toMatch(/wakes[\s\S]*do not reset attempt budgets[\s\S]*do not grant approvals/i);
  expect(text).toMatch(/cancel[\s\S]*off[\s\S]*stops new actions[\s\S]*watch §6/i);
  expect(text).toMatch(/decision holds[\s\S]*always eligible/i);
  expect(text).toMatch(/merge.ready and merged[\s\S]*two per run[\s\S]*deduplicat/i);
  expect(text).toMatch(/failed or uncertain delivery[\s\S]*hold/i);
  expect(read('skills/axstack/references/run-record.md')).toMatch(/Autopilot: on \| paused[\s\S]*off \(cancelled/i);
});

test('each phase loads the autopilot reference', () => {
  for (const name of ['axstack-align', 'axstack-spec', 'axstack-tickets', 'axstack-implement', 'axstack-watch', 'axstack-relay']) {
    expect(skill(name), name).toMatch(/\]\(\.\.\/axstack\/references\/autopilot\.md\)/);
  }
  expect(read('skills/axstack/references/routing.md')).toMatch(/continues? under autopilot when eligible/i);
});

test('scenario corpus is input-only and covers the approved branches', () => {
  const corpus = JSON.parse(read('tests/workflows/implement-loop-evaluator-inputs.json'));
  const cases = corpus.cases.filter(({ id }) => id.startsWith('autopilot-'));
  expect(cases.map(({ id }) => id)).toEqual([
    'autopilot-small-path', 'autopilot-substantial-gate-one', 'autopilot-tickets-advance',
    'autopilot-first-and-later-pr', 'autopilot-hold-resume', 'autopilot-cancel', 'autopilot-release-path',
    'autopilot-release-not-applicable', 'autopilot-release-missing-hosts', 'autopilot-wake-expiry',
    'autopilot-closed-unmerged-pr', 'autopilot-notification-dedup',
  ]);
  for (const scenario of cases) {
    expect(scenario.input.run_state.length).toBeGreaterThan(30);
    expect(scenario.expected).toBeUndefined();
  }
});
