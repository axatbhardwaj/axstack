import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const router = 'skills/axstack-explain/SKILL.md';
const fidelity = 'skills/axstack-explain/references/fidelity.md';
const ui = 'skills/axstack/references/ui-verification.md';
const pages = 'skills/axstack-explain/references/inline-pages.md';
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
// Independent prompt contracts: these catch lost routing and fidelity rules.
// Existing explain tests do not cover this skill. All probes use real source
// in memory; no test writes tracked files or adds a production test hook.
const rules = [
  ['portable destination', router, [/chat/i, /GitHub/i, /docs/i, /(?:use|choose) Mermaid/i],
    /Mermaid/i, 'plain prose', 'Choose Mermaid for chat, GitHub, and docs.'],
  ['inline page diagrams', router, [/inline pages/i, /inline SVG/i, /CSS/i, /use|choose/i],
    /inline SVG/i, 'remote image', 'Choose inline SVG or CSS inside inline pages.'],
  ['no Mermaid in pages', router, [/Mermaid/i, /inline pages/i],
    /never use|do not use/i, 'Use', 'Do not use Mermaid in inline pages.', /never use|do not use/i],
  ['Mermaid accessibility', router, [/Mermaid/i, /accTitle/i, /accDescr/i, /include|supply/i],
    /include|supply/i, 'omit', 'Supply accTitle and accDescr in each Mermaid view.'],
  ['Mermaid theme', router, [/Mermaid/i, /theme init/i],
    /never use|do not add/i, 'Use', 'Do not add theme init to Mermaid.', /never use|do not add/i],
  ['split Mermaid', router, [/split|divide/i, /large Mermaid/i, /views/i],
    /split|divide/i, 'merge', 'Divide large Mermaid diagrams into views.'],
  ['factual source pins', fidelity, [/factual nodes and edges/i, /inspected (?:source )?path/i, /recorded full revision/i, /map|bind/i],
    /recorded full revision/i, 'floating branch', 'Bind factual nodes and edges to an inspected source path at a recorded full revision.'],
  ['unsupported facts', fidelity, [/drop|remove/i, /unsupported factual/i],
    /drop|remove/i, 'retain', 'Remove unsupported factual elements.'],
  ['uncommitted sources', fidelity, [/uncommitted sources/i, /content hash/i, /pins/i, /unknown/i, /use|record/i],
    /unknown/i, 'verified', 'For uncommitted sources, record the content hash and mark their pins unknown.'],
  ['planned and unknown labels', fidelity, [/planned and unknown (?:nodes|elements)/i, /visible/i, /marker/i, /node label/i, /require|give/i],
    /visible/i, 'hidden', 'Give planned and unknown nodes a visible marker in the node label.'],
  ['planned and unknown edges', fidelity, [/planned and unknown edges/i, /visible/i, /marker/i, /edge label/i, /give|mark/i],
    /visible/i, 'hidden', 'Mark planned and unknown edges with a visible planned or unknown marker in the edge label.'],
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
  ['driver previews are the first exception', ui, [/first/i, /named (?:author )?browser exception/i, /driver.*two.*html_preview/i, /728px dark/i, /360px light/i],
    /first/i, 'sole', 'The first named browser exception is the driver running two html_preview checks at 728px dark and 360px light.'],
  ['preview gates', pages, [/require|check/i, /layout/i, /theme/i, /zero console errors/i, /empty.*missingImages/i, /height/i, /network/i, /word count/i],
    /require|check/i, 'waive', 'Check layout, theme, zero console errors, empty missingImages, height, network, and word count.'],
  ['previews never replace verifier', ui, [/html_preview/i, /replace/i, /verifier.*interaction pass/i],
    /never replace|do not replace/i, 'Replace', 'Do not replace the verifier interaction pass with html_preview.', /never replace|do not replace/i],
  ['other browser checks stay delegated', ui, [/other browser checks/i, /outside.*two named exceptions/i, /remain|stay/i, /delegated/i, /configured UI verifier roles/i],
    /remain|stay/i, 'leave', 'All other browser checks outside the two named exceptions stay delegated to configured UI verifier roles.'],
  ['dispatched preview self-check exception', ui, [/second/i, /named (?:author )?browser exception/i, /permits|allows/i, /dispatched roles/i, /html_preview/i, /non-publishing self-check/i],
    /non-publishing self-check/i, 'publishing check', 'The second named browser exception allows dispatched roles to use html_preview for a non-publishing self-check.'],
  ['dispatched self-check never replaces required passes', ui, [/dispatched-role self-checks/i, /replace/i, /driver.*two previews/i, /axstack-ui-verifier.*pass/i],
    /never replace|do not replace/i, 'Replace', 'Do not replace the driver two previews or axstack-ui-verifier pass with dispatched-role self-checks.', /never replace|do not replace/i],
  ['dispatched self-check never publishes', ui, [/dispatched roles/i, /html_render/i],
    /never call|do not call/i, 'Always call', 'Dispatched roles do not call html_render.', /never call|do not call/i],
  ['interactive page pass', ui, [/every interactive page/i, /require|obtain/i, /real-browser/i, /axstack-ui-verifier/i, /interaction pass/i],
    /every interactive page/i, 'some interactive pages', 'For every interactive page, obtain a real-browser axstack-ui-verifier interaction pass.'],
  ['page brief exact bytes', ui, [/give|include/i, /evidence path/i, /SHA-256/i, /exact bytes/i, /verifier brief/i],
    /exact bytes/i, 'similar bytes', 'Include the evidence path and SHA-256 of the exact bytes in the verifier brief.'],
  ['page loopback', ui, [/verifier/i, /serve|host/i, /exact bytes/i, /loopback/i],
    /loopback/i, 'public hosting', 'The verifier hosts the exact bytes on loopback.'],
  ['configured browser policy', ui, [/use|honor/i, /configured verifier browser/i, /user.*browser.tool policy/i],
    /configured/i, 'arbitrary', 'Use the configured verifier browser and honor the user browser-tool policy.'],
  ['page interactions and accessibility', ui, [/check|verify/i, /clicks/i, /keyboard/i, /focus order/i, /screen-reader names/i, /expanded states/i, /reduced motion/i],
    /check|verify/i, 'waive', 'Verify clicks, keyboard, focus order, screen-reader names, expanded states, and reduced motion.'],
  ['page resource entries empty', ui, [/require|check/i, /performance.*getEntriesByType.*resource/i, /\bempty\b/i],
    /\bempty\b/i, 'nonempty', "Check that performance.getEntriesByType('resource') is empty."],
  ['page without candidate checkout exception', ui, [/page without a candidate/i, /detached-checkout rule/i, /appl(?:y|ies)/i],
    /does not apply|never applies/i, 'always applies', 'The detached-checkout rule never applies to a page without a candidate.', /does not apply|never applies/i],
];

const acceptsRule = ([, , concepts, , , , prohibition, conflicts]) => (text) =>
  (prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts))
  && !conflicts?.(text);

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
  test(`explain fidelity: ${name}`, () => checkRule(read(path), rule));
  test(`explain real-source rewording: ${name}`, () => {
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

