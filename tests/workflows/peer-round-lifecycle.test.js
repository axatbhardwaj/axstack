import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const peer = 'skills/axstack-review/references/peer-mode.md';
const shape = 'skills/axstack/references/pr-shape.md';
const automation = 'skills/axstack/references/automations.md';
const skill = 'skills/axstack-review/SKILL.md';
const rules = [
  [shape, [/eligible only/i, /user-recorded pair/i, /<repo>: <source> -> <base>/i, /manager durable record/i, /user-named/i, /manual review/i],
    'Sync is eligible only for a user-recorded pair <repo>: <source> -> <base> in the manager durable record or user-named for manual review.', /only/i, 'also without'],
  [shape, [/head repo/i, /must equal/i, /base repo/i],
    'The head repo must equal the base repo.', /must equal/i, 'can differ from'],
  [shape, [/source S/i, /fetched base-repo ref/i, /SHA recorded/i],
    'Source S must be a fetched base-repo ref with its SHA recorded.', /fetched base-repo ref/i, 'PR-supplied ref'],
  [shape, [/sync term/i, /grants no authority/i],
    'The sync term grants no authority.', /grants no authority/i, 'grants approval', /grants no authority/i],
  [shape, [/sync pass/i, /no reviewer dispatch/i, /submit nothing/i, /sync skip/i, /event identity/i, /dedupe/i, /user/i],
    'On sync pass, use no reviewer dispatch and submit nothing, record sync skip with event identity for dedupe, and leave the PR for the user.', /no reviewer dispatch and submit nothing/i, 'dispatch reviewers and submit APPROVE', /no reviewer dispatch and submit nothing|sync skip/gi],
  [shape, [/sync fail or unknown/i, /ordinary review/i],
    'Sync fail or unknown takes ordinary review.', /ordinary review/i, 'sync skip'],
  [peer, [/requires/i, /sync admission/i, /user-recorded pair/i, /head repo/i, /base repo/i, /fetched source SHA/i, /PR shape/i],
    'Sync admission requires the user-recorded pair, matching head repo and base repo, and fetched source SHA under PR shape.', /requires/i, 'ignores'],
  [peer, [/sync pass/i, /no reviewer dispatch/i, /submit nothing/i, /sync skip/i, /event identity/i, /user/i],
    'On sync pass, use no reviewer dispatch and submit nothing, record sync skip with event identity, and leave the PR for the user.', /no reviewer dispatch and submit nothing/i, 'dispatch and approve', /no reviewer dispatch and submit nothing|sync skip/gi],
  [peer, [/sync fail or unknown/i, /ordinary review/i],
    'Sync fail or unknown enters ordinary review.', /ordinary review/i, 'sync skip'],
  [automation, [/before admission/i, /sync/i, /user-recorded pair/i, /durable record/i, /PR shape/i],
    'Before admission, check sync eligibility against the user-recorded pair in the durable record under PR shape.', /before admission/i, 'after dispatch'],
  [automation, [/sync pass/i, /no reviewer dispatch/i, /submit nothing/i, /sync skip/i, /event identity/i, /dedupe/i, /user/i],
    'On sync pass, use no reviewer dispatch and submit nothing, record sync skip with event identity for dedupe, and leave the PR for the user.', /no reviewer dispatch and submit nothing/i, 'dispatch and approve', /no reviewer dispatch and submit nothing|sync skip/gi],
  [automation, [/sync fail or unknown/i, /ordinary review/i],
    'Sync fail or unknown follows ordinary review.', /ordinary review/i, 'sync skip'],
  [skill, [/sync skips/i, /binding-verdict/i, /exempt/i],
    'Sync skips are exempt from binding-verdict requirements.', /exempt/i, 'subject to'],
  [skill, [/\bnever\b/i, /sync skip/i, /internal verdict/i],
    'For a sync skip, never fabricate an internal verdict.', /never/i, 'Always', /never|sync skip/gi],
  [peer, [/before each dispatch/i, /before reconcile/i, /before submission/i, /re-read/i, /PR state/i, /head/i, /base branch/i, /base SHA/i, /draft/i],
    'Before each dispatch, before reconcile and before submission, re-read PR state, head, base branch, base SHA and draft.', /before each dispatch/i, 'only after dispatch'],
  [peer, [/merged or closed/i, /head or base SHA moved/i, /base retargeted/i, /draft/i, /discard/i],
    'Discard if merged or closed, head or base SHA moved, base retargeted, or draft.', /discard/i, 'continue'],
  [peer, [/discard/i, /cancel owned tasks/i, /verify settlement/i, /preserve evidence/i, /discarded: <reason>/i],
    'On discard, cancel owned tasks, verify settlement, preserve evidence and record discarded: <reason>.', /verify settlement/i, 'assume settlement'],
  [peer, [/discard/i, /submit nothing/i],
    'On discard, submit nothing.', /submit nothing/i, 'submit APPROVE', /submit nothing/i],
  [peer, [/merged or closed/i, /existing cleanup/i],
    'For merged or closed PRs, run existing cleanup.', /existing cleanup/i, 'retain all active tasks'],
  [peer, [/new head/i, /new event/i, /restart inside the job/i],
    'A new head is a new event, never a restart inside the job.', /never/i, 'always', /never/i],
  [peer, [/unknown GitHub state/i, /holds/i, /never discards/i],
    'Unknown GitHub state holds, never discards.', /never discards/i, 'always discards', /never discards/i],
  [peer, [/polling loop/i, /watcher/i],
    'Add no polling loop or watcher.', /no/i, 'a', /no/i],
  [automation, [/bounded PR job/i, /stale-round discard/i, /before each dispatch/i, /before reconcile/i, /before submission/i, /Peer mode/i],
    'Each bounded PR job follows Peer mode stale-round discard before each dispatch, before reconcile and before submission.', /before each dispatch/i, 'after all dispatches'],
];

for (const [path, concepts, rewording, direction, inversion, prohibition] of rules) {
  test(`peer round: ${rewording}`, () => {
    const source = readFileSync(`${import.meta.dir}/../../${path}`, 'utf8')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
    const accepts = (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(source, accepts, rewording, [[direction, inversion]], concepts);
  });
}
