import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const skill = readFileSync(`${import.meta.dir}/../../skills/axstack-scout/SKILL.md`, 'utf8');
const compact = skill.replace(/\s+/g, ' ');
const has = (text, ...concepts) => sentences(text).some((sentence) =>
  concepts.every((concept) => concept.test(sentence)));

// These are agent instruction contracts. Each check removes and inverts the
// accepted instruction in memory, then accepts an equivalent rewording.
const rules = [
  ['single lookup stays in chat',
    (s) => requires(s, /single factual lookup/i, /(?:stays?|remains?) in (?:the current )?chat/i),
    'A single factual lookup remains in the current chat.', [/\b(?:stays?|remains?)\b/i, 'dispatches']],
  ['only driver or owner dispatches',
    (s) => requires(s, /only/i, /driver or (?:PR )?owner/i, /dispatch/i),
    'Only a driver or PR owner dispatches Scout.', [/only/i, 'Any worker, author, or reviewer']],
  ['workers request exploration',
    (s) => requires(s, /workers?, authors? and reviewers?/i, /request/i, /driver/i),
    'Workers, authors and reviewers request exploration from their driver.', [/request/i, 'dispatch']],
  ['facet count and whole-repository search',
    (s) => requires(s, /1[–-]3 facets/i, /whole repository|entire repository/i, /each facet/i),
    'Split into 1–3 facets, with each facet searching the entire repository.', [/whole repository|entire repository/i, 'one directory']],
  ['mixed required pair',
    (s) => requires(s, /mixed/i, /each facet/i, /Haiku/i, /Luna/i, /requires?|required/i),
    'In mixed, each facet requires an independent Haiku and Luna pair.', [/requires?|required/i, 'may use']],
  ['codex required pair',
    (s) => requires(s, /codex-only/i, /each facet/i, /Sol/i, /Luna/i, /requires?|required/i),
    'In codex-only, each facet requires an independent Sol and Luna pair.', [/requires?|required/i, 'may use']],
  ['claude required seat',
    (s) => requires(s, /claude-only/i, /each facet/i, /Haiku/i, /requires?|required/i),
    'In claude-only, each facet requires one Haiku seat.', [/requires?|required/i, 'may use']],
  ['same-family agreement',
    (s) => prohibits(s, /not cross-family corroboration|never cross-family corroboration/i, /Sol/i, /Luna/i),
    'Sol and Luna agreement is not cross-family corroboration.', [/not cross-family corroboration/i, 'cross-family corroboration']],
  ['required unavailable holds without substitute',
    (s) => requires(s, /unavailable or rejected required seat/i, /holds? Scout/i, /without substitution/i),
    'An unavailable or rejected required seat holds Scout without substitution.', [/holds? Scout/i, 'lets Scout continue']],
  ['flash launch failure is absent and continues',
    (s) => requires(s, /Flash/i, /launch failure/i, /trust\/login prompt/i, /prompt block/i, /absent \(<reason>\)/i, /continues?/i),
    'A Flash launch failure, trust/login prompt, or prompt block records absent (<reason>) and Scout continues.', [/continues?/i, 'holds']],
  ['flash hold is local',
    (s) => requires(s, /Flash hold/i, /only (?:the )?Flash seat/i, /other seats/i, /summary/i),
    'A Flash hold covers only the Flash seat, and Scout returns the other seats’ summary.', [/only/i, 'all seats including']],
  ['first launch rejection stops siblings',
    (s) => requires(s, /first (?:dispatch|launch)/i, /provider\/model\/effort/i, /rejection/i, /stops? siblings/i),
    'The first launch for each provider/model/effort must run before siblings, and its rejection stops siblings.', [/stops? siblings/i, 'starts siblings']],
  ['uncertain dispatch is reconciled',
    (s) => prohibits(s, /not (?:called|marked|recorded) absent/i, /uncertain dispatch/i, /reconcil/i),
    'An uncertain dispatch is reconciled, not recorded absent.', [/not recorded absent/i, 'recorded absent']],
  ['not found has bounded evidence',
    (s) => has(s, /not found in <scope>/i, /exact search command/i, /scope/i, /content identity/i),
    'A not-found claim says not found in <scope> and includes the exact search command, scope, and content identity.', [/content identity/i, 'general opinion']],
  ['identity includes dirty tracked and untracked content',
    (s) => requires(s, /content identity/i, /HEAD SHA/i, /git diff --binary HEAD/i, /SHA-256/i, /untracked/i, /non-ignored/i),
    'Content identity pins HEAD SHA, SHA-256 of git diff --binary HEAD, and path and SHA-256 for each untracked, non-ignored file.', [/untracked/i, 'ignored']],
  ['claim cap and labels',
    (s) => requires(s, /each seat report/i, /at most (?:about )?15 claims/i, /verified/i, /inference/i, /unverified/i),
    'Each seat report has at most about 15 claims, each labeled verified, inference, or unverified.', [/at most/i, 'at least']],
  ['reconcile per claim without averaging',
    (s) => requires(s, /driver/i, /per claim/i, /never averages?|without averaging/i),
    'The driver reconciles per claim without averaging.', [/never averages?|without averaging/i, 'by averaging']],
  ['answer-changing absence recheck',
    (s) => has(s, /driver/i, /re-runs?|rechecks?/i, /answer-changing not-found claim/i),
    'The driver rechecks an answer-changing not-found claim before relying on it.', [/rechecks?/i, 'trusts']],
  ['reuse bound to full identity',
    (s) => requires(s, /reuse/i, /only/i, /content identity/i, /unchanged/i, /untracked file contents/i),
    'Reuse findings only when content identity, including untracked file contents, is unchanged.', [/unchanged/i, 'changed']],
  ['seat is read-only and writes only private evidence',
    (s) => requires(s, /each|every/i, /seat/i, /read-only/i, /writes? (?:only|solely) to/i, /private evidence folder/i),
    'Every seat is read-only and writes solely to its private evidence folder.', [/read-only/i, 'write-capable']],
  ['compact summary and saved seat reports',
    (s) => requires(s, /return|deliver/i, /compact summary/i, /driver/i, /store|save/i, /seat reports/i, /run(?:'s)? evidence folder/i),
    'Deliver a compact summary to the driver and save seat reports in the run evidence folder.', [/compact summary/i, 'verbose transcript']],
  ['ordinary chat starts a run with run-init',
    (s) => requires(s, /Scout call/i, /ordinary chat/i, /creates? a run|starts? a run/i, /run-init/i),
    'A Scout call in ordinary chat starts a run using run-init.', [/run-init/i, 'manual setup']],
  ['no mandatory gate for other phases',
    (s) => prohibits(s, /no mandatory gate/i, /Scout/i, /other phases/i),
    'Scout imposes no mandatory gate on other phases.', [/no mandatory gate/i, 'a mandatory gate']],
];

for (const [name, accepts, rewording, [direction, inversion]] of rules) {
  test(`Scout contract: ${name}`, () => checkRule(compact, accepts, rewording, [[direction, inversion]]));
}

test('Scout contract: scaling by facets retains every required seat', () => {
  checkRule(compact,
    (s) => requires(s, /scale/i, /facet count|number of facets/i),
    'Scale only by the number of facets.', [[/facet count|number of facets/i, 'seat availability']]);
  checkRule(compact,
    (s) => requires(s, /keep|retain/i, /every required seat/i, /within each facet|per facet/i),
    'Retain every required seat per facet.', [[/every required seat/i, 'some seats']]);
});

test('Scout trigger is a semantic agent-facing evidence description', () => {
  const description = skill.match(/^description:\s*(.+)$/m)?.[1];
  expect(description).toBeDefined();
  expect(description).toMatch(/evidence/i);
  expect(description).toMatch(/agent/i);
});
