import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const publication = 'skills/axstack/references/candidate-publication.md';
const repair = 'skills/axstack-watch/references/repair-publication.md';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// M1: missing publication obligations escaped the existing chain/checkout checks.
// Exercise shipped instructions with removal, concept loss, inversion and paraphrase;
// these are declared safety contracts, not proof of live forge or agent behavior.
const rules = [
  ['legacy publication prefers fast-forward', publication,
    [/legacy/i, /native/i, /gh stack/i, /prefer|favor/i, /fast.forward/i, /push/i],
    /prefer|favor/i, 'reject',
    'Favor a fast-forward push for legacy native gh stack publication.'],
  ['rewrite lease has a narrow justification', publication,
    [/history rewrite/i, /lease/i, /narrow|limited|specific/i, /justif/i],
    /narrow|limited|specific/i, 'arbitrary',
    'A history rewrite uses a lease with a specific justification.'],
  ['every repair operation binds the reviewed revision and verifies both outcomes', repair,
    [/every|each/i, /publication operation/i, /bind|tie/i, /exact reviewed revision/i,
      /then|afterwards/i, /verify|check/i, /submission receipt/i, /remote state/i],
    /verify|check/i, 'ignore',
    'Tie each publication operation to the exact reviewed revision, then check the submission receipt and remote state.'],
  ['publication holds until the complete new-revision and base receipt', repair,
    [/publication/i, /held until|blocked until/i, /current authored review receipt/i,
      /exact new revision/i, /base/i, /code/i, /repl/i, /all six angles/i,
      /applicable acceptance/i, /affected boundaries/i, /exact reply identities/i],
    /held until|blocked until/i, 'permitted before',
    'Publication is blocked until the current authored review receipt covers the exact new revision and base, code and replies, all six angles, applicable acceptance, affected boundaries and exact reply identities with no unresolved material finding or urgent hold.',
    /no unresolved material finding or urgent hold/i],
  ['unresolved material findings and urgent holds prevent publication', repair,
    [/publication/i, /held until|blocked until/i, /current authored review receipt/i,
      /material finding/i, /urgent hold/i],
    /no unresolved material finding or urgent hold/i, 'unresolved material finding or urgent hold allowed',
    'Publication stays held until the current authored review receipt is complete with no unresolved material finding or urgent hold.',
    /no unresolved material finding or urgent hold/i],
  ['serious risk records both durable holds and preserves the candidate', repair,
    [/serious.risk/i, /record(?:s)? (?:a )?serious.risk hold/i, /both/i, /run record/i, /durable GitHub or user.owned conversation/i,
      /preserv/i, /candidate/i, /context/i],
    /\brecord(?:s)? (?:a )?/i, 'discard ',
    'Preserve candidate and context and record a serious-risk hold in both the run record and a durable GitHub or user-owned conversation.'],
  ['serious-risk notification needs authorization and deduplication', repair,
    [/notification/i, /authorized/i, /deduplicated/i],
    /only/i, 'freely',
    'Send only an authorized deduplicated notification.', /only/i],
  ['publication waits for a decision at the durable location and exact revalidation', repair,
    [/publication/i, /waits|held until/i, /user/i, /decision|decides/i,
      /that durable location/i, /exact.inputs?|exact inputs/i, /revalidat/i],
    /waits|held until/i, 'proceeds before',
    'Publication stays held until the user decides at that durable location and exact inputs are revalidated.'],
  ['terminal publication is a receipt or an accountable hold', repair,
    [/publication/i, /ends|terminal outcome/i, /either/i, /receipt/i, /reviewed revision/i,
      /exact replies/i, /landed once/i, /or/i, /recorded hold/i, /unmatched input/i, /next owner/i],
    /either/i, 'optionally',
    'The publication terminal outcome is either a receipt proving the reviewed revision and exact replies landed once or a recorded hold naming the unmatched input and next owner.'],
  ['review checkout is disposable and bound to the exact attempt', publication,
    [/bind|tie/i, /disposable/i, /checkout/i, /exact attempt identity/i],
    /exact attempt identity/i, 'any attempt',
    'Tie the disposable checkout to the exact attempt identity.'],
  ['release checks reuse driver-made SHA-pinned detached checkout', publication,
    [/release checks/i, /same/i, /driver.made/i, /SHA.pinned/i, /detached.checkout/i, /procedure/i],
    /same/i, 'different',
    'Release checks follow the same driver-made SHA-pinned detached-checkout procedure.'],
];

for (const [name, path, concepts, direction, inverse, rewording, prohibition] of rules) {
  test(`publication M1: ${name}`, () => {
    const accepts = (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(read(path), accepts, rewording, [[direction, inverse]], concepts);
  });
}
