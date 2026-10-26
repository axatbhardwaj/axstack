import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';

const normalize = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replaceAll('`', '').replace(/\s+/g, ' ');
const source = () => normalize(readFileSync(`${import.meta.dir}/../../skills/axstack/references/contracts.md`, 'utf8')
  .split('### Parked user-reply holds')[1].split('## Serious risk')[0]);

// Match positive actions across the section, including lists and paragraphs.
// Keep their positions so removal, reversal and each adjacent swap test the
// actual selected instructions, rather than another mention in a fallback.
function orderedSteps(text, steps) {
  const found = [];
  let cursor = 0;
  for (const step of steps) {
    const matches = sentences(text).filter((unit) => requires(unit, step))
      .map((unit) => {
        const match = unit.match(step);
        return { index: text.indexOf(unit) + match.index, value: match[0] };
      });
    const next = matches.find(({ index }) => index >= cursor);
    if (!next) return null;
    found.push(next);
    cursor = next.index + next.value.length;
  }
  return found;
}

const sequences = [
  ['parking', [
    /(?:call|use) unwatch_pull_request for each watched member/i,
    /(?:post(?: or update)?|update) the text card.*?answer the prompt/i,
    /(?:call|use) update_scheduled_task enabled:false/i,
    /read(?: it)?[- ]back/i,
    /cancel queued.*?run-watch(?: copies| prompt)/i,
    /(?:use|ask with) (?:the )?harness question tool/i,
  ], [
    '1. Call unwatch_pull_request for each watched member. 2. Post the text card saying answer the prompt. 3. Call update_scheduled_task enabled:false and read it back. 4. Cancel queued run-watch copies. 5. Use the harness question tool.',
    'First use unwatch_pull_request for each watched member; next update the text card saying answer the prompt; next use update_scheduled_task enabled:false; read it back; cancel queued copies of the run-watch prompt; finally ask with the harness question tool.',
  ]],
  ['answer resumption', [
    /reconcile (?:current|live) PR and run state/i,
    /bind the answer to the hold key, head and base/i,
    /re-enable the schedule/i,
    /re-arm watches (?:using|under) the native-watch recovery procedure/i,
    /continue/i,
  ], [
    'On an answer from the question tool or chat: 1. Reconcile current PR and run state. 2. Bind the answer to the hold key, head and base. 3. Re-enable the schedule. 4. Re-arm watches using the native-watch recovery procedure. 5. Continue.',
    'For an answer from the question tool or chat, first reconcile live PR and run state; next bind the answer to the hold key, head and base; next re-enable the schedule; next re-arm watches under the native-watch recovery procedure; finally continue.',
  ]],
];

for (const [name, steps, rewordings] of sequences) {
  test(`parked hold order: ${name} survives lists and read-it-back wording`, () => {
    for (const text of [source(), ...rewordings.map(normalize)]) {
      const matches = orderedSteps(text, steps);
      expect(matches).not.toBeNull();
      for (const { index, value } of matches) {
        const remove = text.slice(0, index) + text.slice(index + value.length);
        expect(orderedSteps(remove, steps)).toBeNull();
        const invert = `${text.slice(0, index)}Do not ${text.slice(index)}`;
        expect(orderedSteps(invert, steps)).toBeNull();
      }
      for (let index = 1; index < matches.length; index++) {
        const left = matches[index - 1];
        const right = matches[index];
        const swap = text.slice(0, left.index) + right.value
          + text.slice(left.index + left.value.length, right.index) + left.value
          + text.slice(right.index + right.value.length);
        expect(orderedSteps(swap, steps)).toBeNull();
      }
    }
  });
}
