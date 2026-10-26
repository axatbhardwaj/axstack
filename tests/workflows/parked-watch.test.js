import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const runtime = 'skills/axstack-watch/references/watch-runtime.md';
const t3 = 'skills/axstack/references/t3-runtime.md';
const autopilot = 'skills/axstack/references/autopilot.md';
const watch = 'skills/axstack-watch/SKILL.md';

function rule(name, path, concepts, rewording, inversion, ban) {
  test(`parked watch: ${name} (${path})`, () => {
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(read(path), accepts, rewording, [inversion], concepts);
  });
}

for (const path of [runtime, t3, autopilot, watch, 'docs/workflows.md', 'docs/host-operations.md']) {
  rule('loads shared parking procedure', path,
    [/parked holds/i, /follow/i, /Parked user-reply holds/i],
    'When handling parked holds, follow the procedure in Parked user-reply holds.', [/follow/i, 'ignore']);
}
for (const path of [runtime, t3, 'docs/host-operations.md']) {
  rule('intentional unwatch bypasses both recovery paths', path,
    [/parking unwatch/i, /triggers?/i, /native re-arm/i, /5-minute recovery cadence/i],
    'A parking unwatch must never trigger the 5-minute recovery cadence or native re-arm.',
    [/never/i, 'always'], /never/i);
}
rule('parked schedule remains disabled until answer', runtime,
  [/while parked/i, /keep|retain/i, /bound run watch disabled/i, /until the answer/i],
  'Until the answer, retain the bound run watch disabled while parked.', [/disabled/i, 'enabled']);
rule('armed-until-completion rule is unparked only', runtime,
  [/unparked chat-run watch/i, /keep/i, /bound run watch armed/i, /until every watched PR is merged or closed/i, /release step/i, /not applicable/i],
  'For an unparked chat-run watch, keep the bound run watch armed until every watched PR is merged or closed, launched work is settled and the release step is settled or not applicable, or until user cancellation.',
  [/unparked/i, 'parked'], /not applicable/i);
for (const path of [runtime, autopilot, watch, 'docs/workflows.md']) {
  rule('closed scope decision respects parking', path,
    [/required PR closed without merging/i, /apply|follow/i, /parking eligibility/i],
    'Apply parking eligibility when handling a required PR closed without merging.', [/apply|follow/i, 'ignore']);
}
rule('watch cadence defers to parked exception', watch,
  [/outside parked holds/i, /own open PRs/i, /chat-run mode/i, /use/i, /60-minute backstop cadence/i],
  'For own open PRs in chat-run mode outside parked holds, use the 60-minute backstop cadence.',
  [/outside/i, 'including']);
