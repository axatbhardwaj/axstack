import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const shared = (name) => `skills/axstack/references/${name}.md`;

// Shipped instruction contracts, not proof of agent or live-provider behavior.
function rule(name, path, concepts, rewording, inversions, select = (text) => text,
  accepts = (text, concepts) => requires(text, ...concepts)) {
  test(name, () => checkRule(sentences(select(read(path))).join('. '),
    (text) => accepts(text, concepts),
    rewording, inversions, concepts));
}

const explainRoles = JSON.parse(read('profiles/presets/claude-only.json')).roles;
const authorEffort = explainRoles.find(({ id }) => id === 'axstack-explainer').thinkingOptionId;
const reviewEffort = explainRoles.find(({ id }) => id === 'axstack-explainer-review').thinkingOptionId;
rule('F1: Claude-only explanation efforts agree with the selected preset',
  'skills/axstack-explain/SKILL.md', [/claude-only/i, /Sonnet/i,
    new RegExp(`author ${authorEffort}\\b`), new RegExp(`reviewer ${reviewEffort}\\b`), /separate/i],
  `For claude-only explanations, separate Sonnet reviewer ${reviewEffort} and author ${authorEffort} sessions are allowed.`,
  [[new RegExp(`author ${authorEffort}\\b`), 'author xhigh'], [/separate/i, 'shared']]);

rule('F2: weekly test audit names its review-before-publication exception',
  shared('test-audit-weekly'), [/weekly test audit/i, /exception/i,
    /Implement/i, /publish.then.review/i, /review.before.publication/i],
  'The weekly test audit is an exception to Implement publish-then-review and uses review-before-publication.',
  [[/review.before.publication/i, 'publication-before-review'], [/exception/i, 'conforming application']]);

rule('F3: installed roles snapshot supplies the preset', shared('routing'),
  [/new runs/i, /(?:read|use) (?:the )?`?preset`?/i, /preset/i, /skills\/axstack\/roles\.json/i, /actually loaded skills root/i],
  'For new runs, use preset from skills/axstack/roles.json at the actually loaded skills root.',
  [[/roles\.json/i, 'manifest.json'], [/read (?:the )?`?preset`?|use preset/i, 'ignore preset']]);
rule('F3: legacy manifest is ignored, including stale values', shared('routing'),
  [/legacy manifest/i, /profiles\.preset/i, /ignored/i, /stale/i, /inert/i],
  'The legacy manifest profiles.preset is inert and ignored, including stale values.',
  [[/ignored/i, 'used as a routing source'], [/inert/i, 'authoritative']]);
rule('F3: missing or conflicting active preset sources still hold', shared('routing'),
  [/missing or contradictory/i, /installed|active/i, /explicit user selection/i, /setup gap/i, /hold/i],
  'Missing or contradictory installed preset and explicit user selection sources are a setup gap: hold.',
  [[/hold/i, 'proceed'], [/missing or contradictory/i, 'consistent']]);

for (const path of [shared('routing'), shared('t3-runtime')]) {
  rule(`S1: resolver invocation includes model selection and effort in ${path}`, path,
    [/resolve-models\.js/i, /--provider\s+<provider>/i, /--capabilities\s+<path>/i,
      /--class\s+<class>\s*\|\s*--model\s+<model>/i, /--effort\s+<effort>/i],
    'Resolve with resolve-models.js --provider <provider> --capabilities <path> (--class <class> | --model <model>) --effort <effort> using saved capabilities.',
    [[/--effort/i, '--verbosity'], [/--class/i, '--category'], [/--model/i, '--label']]);
}

rule('S2: digest uses a separate repository JSON watermark',
  'skills/axstack-watch/references/watch-runtime.md', [/watermark/i, /per.repository/i,
    /JSON file/i, /private run directory/i, /separate from.*progress\.md/i],
  'Use a per-repository JSON file in the private run directory for the watermark, separate from progress.md.',
  [[/separate from/i, 'stored in'], [/JSON file/i, 'Markdown record'], [/private run directory/i, 'public workspace']]);
rule('S2: run-record schema names the per-repository JSON file', shared('run-record'),
  [/PR digest watermarks:/i, /repo ->/i, /absolute path/i, /per-repository JSON file/i, /private run directory/i],
  'PR digest watermarks: <repo -> absolute path of its per-repository JSON file inside the private run directory> | none',
  [[/JSON file/i, 'progress.md'], [/private run directory/i, 'public documentation']],
  (text) => text.split('\n').find((line) => line.startsWith('PR digest watermarks:')) ?? '');

rule('S3: small delivery starts from intent read-back and uses Align only if unclear', shared('autopilot'),
  [/Small:/i, /small.change intent read.back/i, /implement/i, /watch/i, /Align only when unclear/i],
  'Small: small-change intent read-back, implement, watch and guarded merge, with Align only when unclear.',
  [[/small.change intent read.back/i, 'mandatory spec approval'], [/Align only when unclear/i, 'Align for every small change']]);
rule('S3: small intent read-back presents release and host authority', shared('autopilot'),
  [/small.change intent read.back/i, /Release/i, /host.mutation authority/i, /explicit hosts/i],
  'The small-change intent read-back names Release and host-mutation authority and explicit hosts.',
  [[/host.mutation authority/i, 'implicit installation'], [/explicit hosts/i, 'inferred hosts']]);
rule('S3: release decision is presented at the proportional human gate', shared('autopilot'),
  [/Show/i, /Release:/i, /spec.*human approval.*gate 1/i, /small.change intent read.back/i],
  'Show the Release: line in the spec for human approval at gate 1, or in the small-change intent read-back.',
  [[/small.change intent read.back/i, 'mandatory small-work Align'], [/human approval/i, 'agent approval']]);

rule('S4: only unsettled material Rung 1 questions are Unclear', shared('routing'),
  [/Only/i, /unsettled/i, /material/i, /Rung 1/i, /design question/i, /Unclear/i],
  'Only an unsettled material Rung 1 design question is Unclear.',
  [[/unsettled/i, 'settled'], [/material/i, 'minor'], [/Only/i, 'Every']]);

rule('S5: private records include the paths their schema requires', shared('run-record'),
  [/Private records/i, /include|retain/i, /checkout/i, /evidence/i, /worktree paths/i, /schema requires/i],
  'Private records retain the checkout, evidence and worktree paths that the schema requires.',
  [[/include|retain/i, 'omit'], [/private records/i, 'public summaries']]);
const secrets = [/tokens/i, /credentials/i, /transcripts/i, /private prompts/i];
rule('S5: secrets remain prohibited in private records', shared('run-record'), secrets,
  'Include no tokens, credentials, transcripts or private prompts in private records.',
  [[/Include no/i, 'Include']], (text) => text,
  (text) => prohibits(text, /Include no/i, ...secrets));
rule('S5: publication requires separate authority and sanitization', shared('run-record'),
  [/Publication/i, /sanitized summary/i, /separate authority/i],
  'Publication of a sanitized summary requires separate authority.',
  [[/sanitized/i, 'raw'], [/separate authority/i, 'implicit consent']]);

rule('S6: audit schema measures simplification applicability and receipt completeness',
  'skills/axstack-audit/references/record.md', [/Simplification:/i,
    /applicability.*evidenced.*total candidate diffs/i,
    /complete.*receipts.*total candidates/i, /applied/i, /not-applicable/i, /UNKNOWN.*reason/i],
  'Simplification: <applicability determinations evidenced / total candidate diffs, complete receipts / total candidates, applied, not-applicable, or UNKNOWN with reason>',
  [[/complete/i, 'partial'], [/UNKNOWN/i, 'assumed PASS']],
  (text) => text.split('\n').find((line) => line.startsWith('Simplification:')) ?? '',
  (text, concepts) => sentences(text).some((line) =>
    !/incomplete|partial|not complete/i.test(line) && concepts.every((concept) => concept.test(line))));

rule('S7: writer dispatch keeps authors and repairs without the retired category', shared('t3-runtime'),
  [/Author and repairs/i, /t3_thread_launch/i, /own worktree/i, /merges or closes/i],
  'Author and repairs use t3_thread_launch in their own worktree kept until the PR merges or closes.',
  [[/Author and repairs/i, 'code-arena writers']],
  (text) => text.split('\n').find((line) => line.startsWith('| Author')) ?? '');
test('S7: runtime has no remaining code-arena writer category', () => {
  expect(read(shared('t3-runtime'))).not.toMatch(/code-arena/i);
});
