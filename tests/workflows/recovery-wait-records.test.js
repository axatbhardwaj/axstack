import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8');
const record = 'axstack/references/run-record.md';
const runtime = 'axstack/references/t3-runtime.md';
const normalize = (text) => text.replace(/`/g, '').replace(/\s+/g, ' ');
function rule(name, path, concepts, paraphrase, direction, inverse, ban) {
  test(`R7c wait: ${name}; removal/inversion/rewording`, () => {
    const accepts = (text) => ban ? prohibits(text, ban, ...concepts) : requires(text, ...concepts);
    checkRule(normalize(read(path)), accepts, paraphrase, [[direction, inverse]], concepts);
  });
}

rule('waiting turn has an owner-authored versioned record', record,
  [/before ending/i, /any waiting turn/i, /owning Coordinator\/Driver/i, /\b(?:writes|records) an\b/i, /assistant-authored/i, /schemaVersion:1/i, /wait block/i],
  'Before ending any waiting turn, the owning Coordinator/Driver records an assistant-authored schemaVersion:1 wait block.',
  /\b(?:writes|records) an\b/i, 'omits an');
rule('latest waiting-turn record alone is current', record,
  [/only/i, /latest owner-authored wait block/i, /latest waiting turn/i, /is current|remains current/i],
  'Only the latest owner-authored wait block in the latest waiting turn remains current.', /only/i, 'any');
rule('later owner activity invalidates stale eligibility', record,
  [/later owner activity/i, /without a fresh block/i, /unknown schema/i, /report-only/i],
  'Later owner activity without a fresh block or an unknown schema stays report-only.', /report-only/i, 'eligible');
rule('waiting differs from parking', record,
  [/parked/i, /reserved/i, /user-reply hold/i, /general waiting turn/i],
  'Parked is reserved for a user-reply hold, never a general waiting turn.', /never/i, 'also', /never/i);
rule('immediate diagnosis precedes waiting', runtime,
  [/Driver/i, /diagnoses|investigates/i, /stale reviews/i, /failing checks/i, /relevant upstream fixes/i, /immediately/i, /before ending a waiting turn/i],
  'The Driver immediately investigates stale reviews, failing checks and relevant upstream fixes before ending a waiting turn.', /diagnoses|investigates/i, 'ignores');
rule('same condition retains dedupe through revalidation', record,
  [/rewriting/i, /same conditionId/i, /never resets/i, /delivery deduplication/i],
  'Rewriting the same conditionId never resets delivery deduplication.', /never resets/i, 'resets', /never resets/i);
rule('owner closing ends registration', record,
  [/owner/i, /\b(?:writes|records) an\b/i, /assistant-authored/i, /closing block/i, /same conditionId/i, /end.*registration/i],
  'To end the registration, the owner records an assistant-authored closing block with the same conditionId.', /\b(?:writes|records) an\b/i, 'omits an');

// Protocol field names are a wire contract, not an assertion about prose wording.
test('R7c wait and closing records carry exact identity, authority, wake and lifetime fields', () => {
  const blocks = [...read(record).matchAll(/```json\n([\s\S]*?)\n```/g)]
    .map(([, json]) => JSON.parse(json));
  const wait = blocks.find((block) => block.recordType === 'waiting-turn');
  const close = blocks.find((block) => block.recordType === 'closing');
  expect(wait).toBeDefined();
  expect(close).toBeDefined();
  for (const block of [wait, close]) {
    expect(block.schemaVersion).toBe(1);
    for (const field of ['conditionId', 'diagnosis', 'owner', 'authority', 'nextAction', 'wake', 'lifetime', 'cleanupOwner']) {
      expect(block).toHaveProperty(field);
    }
    expect(block.owner).toHaveProperty('environmentId');
    expect(block.owner).toHaveProperty('host');
    expect(block.owner).toHaveProperty('threadId');
    expect(block.owner).toHaveProperty('threadLink');
    expect(block.cleanupOwner).toHaveProperty('threadId');
  }
  for (const field of ['waitKind', 'dependency', 'lastMeaningfulProgress', 'nextEligibleCheck', 'pause', 'snoozeUntil']) {
    expect(wait).toHaveProperty(field);
  }
  expect(wait.wake).toHaveProperty('mechanism');
  expect(wait.wake).toHaveProperty('id');
  expect(wait.lifetime).toHaveProperty('expiresAt');
  expect(close).toHaveProperty('outcome');
  expect(close).toHaveProperty('evidence');
  expect(close).toHaveProperty('cleanup');
});

test('R7c wait records are discoverable from runtime and lifecycle', () => {
  for (const path of [runtime, 'axstack/references/lifecycle.md']) {
    expect(loadedReferences(read(path)).some((link) => link.endsWith('run-record.md#waiting-turn-and-closing-records'))).toBe(true);
  }
});

rule('unchanged registered waits refresh only their record', 'axstack-watch/references/watch-runtime.md',
  [/unchanged scheduled wake/i, /registered recovery wait/i, /(?:write|emit) only/i, /fresh structured wait block/i],
  'On an unchanged scheduled wake with a registered recovery wait, emit only a fresh structured wait block.',
  /(?:write|emit) only/i, 'omit');
rule('silent wakes cannot retain stale registration', record,
  [/silent unchanged wake/i, /without a fresh wait block/i, /report-only/i],
  'A silent unchanged wake without a fresh wait block leaves the owner report-only.',
  /report-only/i, 'eligible');
