import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const router = 'skills/axstack-diagram/SKILL.md';
const fidelity = 'skills/axstack-diagram/references/fidelity.md';
const archify = 'skills/axstack-diagram/references/archify.md';
const ui = 'skills/axstack/references/ui-verification.md';
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';

// Independent prompt contracts: these catch lost routing and fidelity rules.
// Existing explain tests do not cover this skill. All probes use real source
// in memory; no test writes tracked files or adds a production test hook.
const rules = [
  ['required viewer', router, [/explicit viewer request/i, /complex-visual path/i, /archify HTML/i, /use|choose/i],
    /archify HTML/i, 'Mermaid', 'Choose archify HTML for an explicit viewer request or the complex-visual path.'],
  ['portable destination', router, [/otherwise/i, /chat/i, /GitHub/i, /docs/i, /Mermaid/i, /use|choose/i],
    /Mermaid/i, 'archify HTML', 'Otherwise choose Mermaid for chat, GitHub, or docs.'],
  ['Mermaid accessibility', router, [/Mermaid/i, /accTitle/i, /accDescr/i, /include|supply/i],
    /include|supply/i, 'omit', 'Supply accTitle and accDescr in each Mermaid view.'],
  ['Mermaid theme', router, [/Mermaid/i, /theme init/i],
    /never use|do not add/i, 'Use', 'Do not add theme init to Mermaid.', /never use|do not add/i],
  ['split Mermaid', router, [/split|divide/i, /large Mermaid/i, /views/i],
    /split|divide/i, 'merge', 'Divide large Mermaid diagrams into views.'],
  ['one-way roles', router, [/explain owns/i, /evidence/i, /claim labels/i, /word cap/i, /dispatch/i, /delivery/i],
    /explain owns/i, 'diagram owns', 'Explain owns evidence, claim labels, the word cap, dispatch, and delivery.'],
  ['no recursion', router, [/call|invoke/i, /explain/i],
    /never call|do not invoke/i, 'Always call', 'Do not invoke explain.', /never call|do not invoke/i],
  ['direct invocation', router, [/direct (?:use|invocation)/i, /keep|retain/i, /fidelity/i, /rendered QA/i],
    /keep|retain/i, 'drop', 'For direct invocation, retain fidelity and rendered QA.'],
  ['factual source pins', fidelity, [/factual nodes and edges/i, /inspected (?:source )?path/i, /recorded full revision/i, /map|bind/i],
    /recorded full revision/i, 'floating branch', 'Bind factual nodes and edges to an inspected source path at a recorded full revision.'],
  ['unsupported facts', fidelity, [/drop|remove/i, /unsupported factual/i],
    /drop|remove/i, 'retain', 'Remove unsupported factual elements.'],
  ['uncommitted sources', fidelity, [/uncommitted sources/i, /content hash/i, /pins/i, /unknown/i, /use|record/i],
    /unknown/i, 'verified', 'For uncommitted sources, record the content hash and mark their pins unknown.'],
  ['planned and unknown labels', fidelity, [/planned and unknown (?:nodes|elements)/i, /visible/i, /marker/i, /node label/i, /card/i, /require|give/i],
    /visible/i, 'hidden', 'Give planned and unknown nodes a visible marker in the node label and their card, if any.'],
  ['planned and unknown edges', fidelity, [/planned and unknown edges/i, /visible/i, /marker/i, /edge label/i, /give|mark/i],
    /visible/i, 'hidden', 'Mark planned and unknown edges with a visible planned or unknown marker in the edge label.'],
  ['schema-valid dashed cues', fidelity, [/dashed styling/i, /only/i, /properties/i, /pinned schema/i, /validate/i],
    /only/i, 'also', 'Use dashed styling only through properties the pinned schema accepts, verified with validate.'],
  ['schema-valid legends', fidelity, [/planned.*unknown/i, /legend entry/i, /only/i, /sequence/i, /dataflow/i],
    /only/i, 'also outside', 'Add a planned or unknown legend entry only for sequence and dataflow.'],
  ['private source map', fidelity, [/source map/i, /outside/i, /reader view/i, /keep|retain/i],
    /outside/i, 'inside', 'Retain the source map outside the reader view.'],
  ['display revision', fidelity, [/show|display/i, /short SHA/i],
    /short SHA/i, 'floating branch', 'Display the short SHA.'],
  ['offline HTML', fidelity, [/HTML/i, /network assets/i],
    /never load|do not fetch/i, 'Load', 'Do not fetch network assets in the HTML.', /never load|do not fetch/i],
  ['density signal', fidelity, [/about (?:9|nine) core nodes/i, /split/i, /signal/i],
    /split/i, 'merge', 'Treat about nine core nodes as a signal to split.'],
  ['repository persistence', fidelity, [/diagrams/i, /repo docs/i, /only/i, /user (?:asks|requests)/i, /write|save/i],
    /only/i, 'even without', 'Save diagrams into repo docs only when the user requests them.'],
  ['installed binding record', archify, [/read|load/i, /archify.json/i, /path/i, /sha/i, /record/i],
    /read|load/i, 'ignore', 'Load archify.json for its record with path and sha.'],
  ['HEAD verification', archify, [/verify|check/i, /git -C/i, /rev-parse HEAD/i, /equals|matches/i, /recorded SHA/i],
    /equals|matches/i, 'ignores', 'Check that git -C <path> rev-parse HEAD matches the recorded SHA.'],
  ['dependency hold', archify, [/record.*copy.*missing/i, /HEAD.*mismatch/i, /Chrome.*missing/i, /hold/i, /ask.*user/i],
    /hold/i, 'continue', 'If the record or copy is missing, HEAD mismatches the pin, or Chrome is missing, hold and ask the user.'],
  ['only passing receipts', archify, [/accept|require/i, /only/i, /receipt/i, /status.*\bpass\b/i, /success/i],
    /only/i, 'also', 'Require only receipt status pass as success.'],
  ['exit codes', archify, [/exit codes/i, /pass/i],
    /never trust|do not accept/i, 'Trust', 'Do not accept exit codes as proof of a pass.', /never trust|do not accept/i],
  ['non-pass holds delivery', archify, [/receipt/i, /non-pass/i, /missing/i, /hold/i, /ask.*user/i],
    /hold/i, 'continue', 'When a receipt is missing or still non-pass after two repair rounds, hold delivery and ask the user.'],
  ['Chrome skipped diagnosis', archify, [/Chrome.*missing/i, /viewer not verified: Chrome missing/i, /report|state/i],
    /report|state/i, 'conceal', 'If Chrome is missing, state "viewer not verified: Chrome missing".', /viewer not verified: Chrome missing/i],
  ['disabled updates', archify, [/set|apply/i, /ARCHIFY_UPDATE_CHECK_DISABLED=1/i, /every.*call/i],
    /every/i, 'one', 'Apply ARCHIFY_UPDATE_CHECK_DISABLED=1 to every archify call.'],
  ['finalize command', archify, [/run|execute/i, /bun/i, /archify.mjs.*finalize/i, /--quality showcase/i, /--json/i, /--out-dir/i, /--repo-root/i],
    /--quality showcase/i, '--quality standard', 'Execute bun <path>/archify/bin/archify.mjs finalize <type> <ir.json> <out.html> --quality showcase --json --out-dir <evidence dir> --repo-root <repo>.'],
  ['Chrome override', archify, [/honor|use/i, /ARCHIFY_CHROME/i, /when set|if set/i],
    /honor|use/i, 'ignore', 'Use ARCHIFY_CHROME if set.'],
  ['evidence output boundary', archify, [/write|save/i, /IR/i, /HTML/i, /receipt/i, /only/i, /private evidence folder/i],
    /only/i, 'also outside', 'Save the IR, HTML, and receipt only inside the private evidence folder.'],
  ['repair limit', archify, [/at most two|limit.*to two/i, /repair rounds/i, /then hold/i, /remaining defects/i, /user.*decision/i],
    /at most two|limit.*to two/i, 'at least three', 'Limit repair rounds to two, then hold remaining defects for the user decision.'],
  ['required viewer has no fallback', archify, [/Mermaid/i, /unverified HTML/i, /viewer.*required/i],
    /never substitute|do not substitute/i, 'Substitute', 'Do not substitute Mermaid or unverified HTML when the viewer is required.', /never substitute|do not substitute/i],
  ['artifact bound verifier', archify, [/require|obtain/i, /axstack-ui-verifier/i, /artifact.sha256/i, /desktop/i, /390px mobile/i, /keyboard/i, /reduced motion/i, /text alternative/i],
    /require|obtain/i, 'waive', 'Obtain axstack-ui-verifier checks of artifact.sha256 bytes on desktop, 390px mobile, keyboard, reduced motion, and the text alternative.'],
  ['node and edge source review', archify, [/require|obtain/i, /explainer-review/i, /every node and edge/i, /source/i, /archify output/i],
    /require|obtain/i, 'waive', 'Obtain explainer-review of every node and edge against source for archify output.'],
  ['changed artifact', archify, [/byte change/i, /fresh/i, /checks/i, /require|need/i],
    /fresh/i, 'stale', 'Each byte change needs fresh checks.'],
  ['card word cap', archify, [/each.*detail card/i, /at most 40 words|40-word ceiling/i, /source/i],
    /at most 40 words|40-word ceiling/i, 'at least 400 words', 'Each detail card has a 40-word ceiling and cites its source.'],
  ['card exemption', archify, [/detail cards/i, /exempt/i, /explain.*700-word cap/i],
    /exempt/i, 'included', 'Detail cards are exempt from explain\'s 700-word cap.'],
  ['non-card word count', archify, [/node labels/i, /headings/i, /captions/i, /all non-card text/i, /count|include/i],
    /count|include/i, 'exclude', 'Count node labels, headings, captions, and all non-card text.'],
  ['feature defaults', archify, [/keep|leave/i, /trace motion/i, /exports/i, /share cards/i, /brand marks/i, /off unless.*user asks/i],
    /off unless.*user asks/i, 'on by default', 'Leave trace motion, exports, share cards, and brand marks off unless the user asks.'],
  ['dark default', archify, [/open|start/i, /viewer/i, /dark/i, /unless.*user.*theme/i],
    /dark/i, 'light', 'Start the viewer dark unless the user names a theme.'],
  ['finalize exception is singular', ui, [/sole|only/i, /author browser exception/i, /archify.*finalize/i, /headless build gate/i],
    /sole|only/i, 'one', 'The only author browser exception is archify finalize as a headless build gate.'],
  ['finalize evidence boundary', ui, [/finalize/i, /outputs/i, /only/i, /private evidence folder/i],
    /only/i, 'also outside', 'Keep finalize outputs only in the private evidence folder.'],
  ['finalize never replaces verifier', ui, [/finalize/i, /replace/i, /verifier.*rendered pass/i],
    /never replace|do not replace/i, 'Replace', 'Do not replace the verifier\'s rendered pass with finalize.', /never replace|do not replace/i],
  ['other browser checks stay delegated', ui, [/other browser checks/i, /remain|stay/i, /delegated/i, /axstack-ui-verifier/i],
    /remain|stay/i, 'leave', 'All other browser checks stay delegated to axstack-ui-verifier.'],
];

const acceptsRule = ([, , concepts, , , , prohibition]) => (text) => prohibition
  ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);

function checkRule(text, rule) {
  const [name, , , flip, inverse, rewording, prohibition] = rule;
  const accepts = acceptsRule(rule);
  expect(accepts(text), `${name}: missing required instruction`).toBe(true);
  const clauses = sentences(text);
  const matching = clauses.filter(accepts);
  expect(matching, `${name}: one instruction owns this rule`).toHaveLength(1);
  const rewrite = (replacement) => clauses.map((clause) =>
    matching.includes(clause) ? replacement(clause) : clause).join('. ');
  expect(accepts(rewrite(() => '')), `${name}: removal`).toBe(false);
  expect(matching[0]).toMatch(flip);
  expect(accepts(rewrite((clause) => clause.replace(flip, inverse))), `${name}: inversion`).toBe(false);
  expect(accepts(rewrite(() => rewording)), `${name}: equivalent wording`).toBe(true);
  if (!prohibition) expect(accepts(rewrite(() => `Do not ${rewording}`)), `${name}: whole-rule negation`).toBe(false);
}

for (const rule of rules) {
  const [name, path, , , , rewording] = rule;
  test(`diagram contract: ${name}`, () => checkRule(read(path), rule));
  test(`diagram real-source rewording: ${name}`, () => {
    const source = read(path);
    const original = source.replace(/\s+/g, ' ').split(/[.!?;]\s+/).find(acceptsRule(rule));
    expect(original, `${name}: missing source instruction`).toBeTruthy();
    const pattern = new RegExp(original.split(/\s+/).map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    expect(source).toMatch(pattern);
    const reworded = source.replace(pattern, rewording.replace(/[.!?]$/, ''));
    for (const sibling of rules.filter((row) => row[1] === path)) checkRule(reworded, sibling);
  });
}
