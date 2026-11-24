import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const router = 'skills/axstack-explain/SKILL.md';
const mermaid = 'skills/axstack-explain/references/mermaid.md';
const publish = 'skills/axstack-publish/SKILL.md';
const fidelity = 'skills/axstack-explain/references/fidelity.md';
const ui = 'skills/axstack/references/ui-verification.md';
const pages = 'skills/axstack-explain/references/inline-pages.md';
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';
// Independent prompt contracts: these catch lost routing and fidelity rules.
// Existing explain tests do not cover this skill. All probes use real source
// in memory; no test writes tracked files or adds a production test hook.
const rules = [
  ['Mermaid for every diagram', router, [/every Explain diagram/i, /(?:use|choose) Mermaid/i, /explicitly requests/i, /different drawing format/i],
    /every/i, 'some', 'Choose Mermaid for every Explain diagram unless the user explicitly requests a different drawing format.'],
  ['portable destination', mermaid, [/chat/i, /GitHub/i, /docs/i, /(?:use|choose) Mermaid/i],
    /Mermaid/i, 'plain prose', 'Choose Mermaid for chat, GitHub, and docs.'],
  ['inline page diagrams', router, [/inline pages/i, /embed|insert/i, /checker-rendered SVG/i],
    /checker-rendered SVG/i, 'a client-rendered diagram', 'Insert checker-rendered SVG in inline pages.'],
  ['no Mermaid runtime in pages', router, [/Mermaid/i, /pele/i, /runtime/i, /inline pages/i],
    /never use|do not load/i, 'Use', 'Do not load any Mermaid or pele runtime in inline pages.', /never use|do not load/i],
  ['no Mermaid runtime in Publish', publish, [/Mermaid/i, /pele/i, /runtime/i, /articles/i],
    /never use|do not load/i, 'Use', 'Do not load a Mermaid or pele runtime in articles.', /never use|do not load/i],
  ['Publish embeds checker output', publish, [/embed|insert/i, /checker-rendered SVG/i, /reviewed Mermaid source/i],
    /checker-rendered SVG/i, 'client-rendered diagrams', 'Insert checker-rendered SVG from the reviewed Mermaid source.'],
  ['Mermaid checker required', mermaid, [/run|execute/i, /mermaid-check\.js/i, /every Mermaid view/i, /before delivery/i],
    /every/i, 'some', 'Execute mermaid-check.js on every Mermaid view before delivery.'],
  ['check every Mermaid block before posting in chat', mermaid,
    [/before posting|prior to posting/i, /every|any/i, /Mermaid blocks?/i, /chat/i, /mermaid-check\.js/i, /require|run/i, /parse/i, /render/i, /pinned Pele/i],
    /before posting|prior to posting/i, 'after posting', 'Prior to posting any Mermaid block in chat, run mermaid-check.js to parse and render it with pinned Pele.'],
  ['Mermaid accessibility', mermaid, [/Mermaid/i, /accTitle/i, /accDescr/i, /include|supply/i],
    /include|supply/i, 'omit', 'Supply accTitle and accDescr in each Mermaid view.'],
  ['Mermaid theme', mermaid, [/Mermaid/i, /theme init/i],
    /never use|do not add/i, 'Use', 'Do not add theme init to Mermaid.', /never use|do not add/i],
  ['split Mermaid', mermaid, [/split|divide/i, /(?:wide|large) Mermaid/i, /views/i],
    /split|divide/i, 'merge', 'Divide large Mermaid diagrams into views.'],
  ['system design opens with a whole-system overview', mermaid, [/open|start/i, /every/i, /system.design/i, /one/i, /whole.system/i, /overview/i],
    /open|start/i, 'end', 'Start every system-design explanation with one whole-system overview.'],
  ['tiered TB is the overview default', mermaid, [/flowchart TB/i, /tiered subgraphs/i, /overview/i, /default/i],
    /default/i, 'exception', 'The default overview uses flowchart TB and tiered subgraphs.'],
  ['dense overview uses natural-size labels based on edge count', mermaid,
    [/dense/i, /overview/i, /(?:more than|over) 25 edges/i, /natural.size/i, /labels/i, /zoom or pan/i],
    /(?:more than|over) 25/i, 'at most 25', 'For a dense overview with over 25 edges, keep labels at natural size and provide zoom or pan.'],
  ['ELK is the Mermaid default', mermaid,
    [/(?:set|require|use)/i, /config\.layout/i, /elk/i, /flowcharts?/i, /stateDiagram-v2/i, /erDiagram/i, /default/i],
    /default/i, 'exception', 'As the default, set config.layout to elk for flowchart, erDiagram and stateDiagram-v2.'],
  ['fallback requires one adjacent comment and a reason', mermaid,
    [/fallback/i, /omit|leave out/i, /\blayout\b/i, /(?:exactly one|a single)/i, /%% layout-fallback:/i, /non[- ]?empty/i, /reason/i, /immediately after/i, /diagram header/i],
    /immediately after/i, 'before', 'For a fallback, leave out layout and put a single %% layout-fallback: comment with a nonempty reason immediately after the diagram header.'],
  ['T3 accepts ELK syntax and uses Pele for layout', mermaid,
    [/T3/i, /chat/i, /accepts|recognizes/i, /layout: elk/i, /(?:lays? out|layouts?|positions?)/i, /(?:with|using) Pele/i],
    /(?:with|using) Pele/i, 'using ELK', 'T3 chat recognizes layout: elk and positions diagrams using Pele.'],
  ['chat label sizing is nominal', mermaid,
    [/chat/i, /(?:nominal|estimated)/i, /16px/i, /(?:edge|connector) labels/i, /14px/i],
    /nominal|estimated/i, 'guaranteed', 'The chat check uses an estimated 16px baseline even though connector labels are 14px.'],
  ['ELK export measures browser labels at target width', mermaid,
    [/ELK/i, /export/i, /smallest|minimum/i, /(?:rendered|displayed) label/i, /browser/i, /12px/i, /target width/i],
    /12px/i, '8px', 'For ELK exports, require the minimum displayed label to reach 12px in the browser at the target width.'],
  ['quoted flowchart and accessibility semicolons', mermaid, [/allow|permit/i, /semicolons/i, /double.quoted/i, /flowchart labels/i, /accTitle/i, /accDescr/i],
    /allow|permit/i, 'forbid', 'Permit semicolons in double-quoted flowchart labels, accTitle and accDescr.'],
  ['sequence semicolons remain banned', mermaid, [/semicolons/i, /sequence/i, /aliases/i, /messages/i, /comma|dash/i, /in place of|instead of/i],
    /in place of|instead of/i, 'alongside', 'Choose commas instead of semicolons in sequence aliases and messages.'],
  ['dashed Mermaid classes need visible status text', mermaid, [/every/i, /node label/i, /dashed class/i, /status word/i, /put|include/i],
    /every/i, 'some', 'Include a status word in every node label that uses a dashed class.'],
  ['keep the overview when splitting', mermaid, [/split/i, /only/i, /retain|keep/i, /overview/i],
    /retain|keep/i, 'discard', 'Split only if you retain the overview.'],
  ['restructure a diagram that fails legibility', mermaid, [/restructure|reorganize/i, /fail|below/i, /legibility|12px/i],
    /restructure|reorganize/i, 'leave', 'Reorganize a diagram that fails legibility.'],
  ['never shrink labels to pass', mermaid, [/shrink|reduce/i, /text|label/i, /legibility/i],
    /never|do not/i, 'always', 'Do not reduce label size to pass the legibility gate.', /never|do not/i],
  ['checker proof is exact', mermaid, [/checker pass/i, /proves|establishes/i, /contract/i, /pinned.pele/i, /parse/i, /size/i, /exact/i],
    /exact/i, 'approximate', 'A checker pass establishes contract compliance and pinned-pele parse and size on the exact source bytes.'],
  ['host render is separate', mermaid, [/checker pass/i, /prove|establish/i, /T3/i, /GitHub/i, /appearance/i],
    /never proves|does not establish/i, 'proves', 'A checker pass does not establish T3 or GitHub appearance.', /never proves|does not establish/i],
  ['unobserved T3 boundary', mermaid, [/record|mark/i, /T3 render: unobserved/i, /unless|without/i, /actual.*(?:render|inline)/i],
    /unobserved/i, 'verified', 'Mark T3 render: unobserved without an actual inline observation.'],
  ['GitHub/docs fidelity needs a fixture', mermaid, [/claim/i, /GitHub.*docs|docs.*GitHub/i, /fidelity/i, /only after/i, /fixture render/i, /host/i],
    /only after/i, 'without', 'Claim docs or GitHub fidelity only after a fixture render on that host.'],
  ['factual source pins', fidelity, [/factual nodes and edges/i, /inspected (?:source )?path/i, /recorded full revision/i, /map|bind/i],
    /recorded full revision/i, 'floating branch', 'Bind factual nodes and edges to an inspected source path at a recorded full revision.'],
  ['unsupported facts', fidelity, [/drop|remove/i, /unsupported factual/i],
    /drop|remove/i, 'retain', 'Remove unsupported factual elements.'],
  ['uncommitted sources', fidelity, [/uncommitted sources/i, /content hash/i, /pins/i, /unknown/i, /use|record/i],
    /unknown/i, 'verified', 'For uncommitted sources, record the content hash and mark their pins unknown.'],
  ['planned and unknown labels', fidelity, [/planned and unknown (?:nodes|elements)/i, /visible/i, /marker/i, /node label/i, /require|give/i],
    /visible/i, 'hidden', 'Give planned and unknown nodes a visible marker in the node label.'],
  ['planned and unknown edges', fidelity, [/planned and unknown edges/i, /visible/i, /status/i, /edge labels?/i, /surrounding text/i, /give|mark/i],
    /visible/i, 'hidden', 'Mark planned and unknown edges with visible status in the edge labels or surrounding text.'],
  ['private source map', fidelity, [/source map/i, /outside/i, /reader view/i, /keep|retain/i],
    /outside/i, 'inside', 'Retain the source map outside the reader view.'],
  ['display revision', fidelity, [/show|display/i, /short SHA/i],
    /short SHA/i, 'floating branch', 'Display the short SHA.'],
  ['offline HTML', fidelity, [/HTML/i, /network assets/i],
    /never load|do not fetch/i, 'Load', 'Do not fetch network assets in the HTML.', /never load|do not fetch/i],
  ['density signal', fidelity, [/Mermaid/i, /density/i, /advisory|signal/i, /split/i, /legibility/i, /gate/i],
    /advisory|signal/i, 'hard limit', 'Treat Mermaid density as an advisory to split and legibility as a gate.'],
  ['flowchart accent hue', fidelity, [/one|single/i, /accent hue/i, /flowchart/i, /\b(?:use|limit|keep)\b/i],
    /one|single/i, 'multiple', 'Keep every flowchart to a single accent hue.'],
  ['repository persistence', fidelity, [/diagrams/i, /repo docs/i, /only/i, /user (?:asks|requests)/i, /write|save/i],
    /only/i, 'even without', 'Save diagrams into repo docs only when the user requests them.'],
  ['driver previews are the first exception', ui, [/first/i, /named (?:author )?browser exception/i, /driver.*two.*html_preview/i, /728px dark/i, /360px light/i],
    /first/i, 'sole', 'The first named browser exception is the driver running two html_preview checks at 728px dark and 360px light.'],
  ['preview gates', pages, [/require|check/i, /layout/i, /theme/i, /zero console errors/i, /height/i, /network/i, /word count/i],
    /require|check/i, 'waive', 'Check layout, theme, zero console errors, height, network, and word count.'],
  ['previews never replace verifier', ui, [/html_preview/i, /replace/i, /verifier.*interaction pass/i],
    /never replace|do not replace/i, 'Replace', 'Do not replace the verifier interaction pass with html_preview.', /never replace|do not replace/i],
  ['other browser checks stay delegated', ui, [/other browser checks/i, /outside.*three named exceptions/i, /remain|stay/i, /delegated/i, /configured UI verifier roles/i],
    /remain|stay/i, 'leave', 'All other browser checks outside the three named exceptions stay delegated to configured UI verifier roles.'],
  ['reviewing-seat image exception', ui, [/third/i, /named browser exception/i, /permits|allows/i, /reviewing seat/i, /axstack-explainer-review/i, /inline.page image check/i, /Playwright MCP/i],
    /permits|allows/i, 'prohibits', 'The third named browser exception allows the reviewing seat axstack-explainer-review to run the inline-page image check through the Playwright MCP.'],
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

function checkContract(text, rule) {
  const [name, , concepts, flip, inverse, rewording, prohibition] = rule;
  const accepts = acceptsRule(rule);
  expect(sentences(text).filter(accepts), `${name}: one instruction owns this rule`).toHaveLength(1);
  checkRule(text, accepts, rewording,
    [[flip, inverse], ...(!prohibition ? [[/^/, 'Do not ']] : [])], concepts);
}

for (const rule of rules) {
  const [name, path, , , , rewording] = rule;
  test(`explain fidelity: ${name}`, () => checkContract(read(path), rule));
  test(`explain real-source rewording: ${name}`, () => {
    const source = read(path);
    const original = source.replace(/\s+/g, ' ').split(/[.!?;]\s+/).find(acceptsRule(rule));
    expect(original, `${name}: missing source instruction`).toBeTruthy();
    const pattern = new RegExp(original.split(/\s+/).map((word) =>
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
    expect(source).toMatch(pattern);
    const reworded = source.replace(pattern, rewording.replace(/[.!?]$/, ''));
    for (const sibling of rules.filter((row) => row[1] === path)) checkContract(reworded, sibling);
  });
}

function alternativeDiagramDefault(source) {
  return sentences(source).find((clause) => {
    const alternative = /\b(?:bespoke|custom|hand[- ](?:drawn|authored|written|coded))\s+(?:SVG|HTML)\b/i;
    const offered = /\b(?:use|draw|choose|accept|allow|offer|prefer|include|option|example)\w*\b/i;
    const prohibited = /\b(?:never|do not|don't)\s+(?:use|draw|choose|offer|include|allow)\b|\b(?:forbidden|prohibited|banned)\b/i;
    const explicitRequest = /\b(?:only (?:on|at|upon|if|when)|if|when|upon)\b.*\b(?:explicit(?:ly)?|specific(?:ally)?)\b.*\b(?:request|ask)\w*\b/i;
    return alternative.test(clause) && offered.test(clause)
      && !prohibited.test(clause) && !explicitRequest.test(clause);
  });
}

test('Explain reserves custom diagram formats for explicit requests', () => {
  const source = read(router);
  expect(alternativeDiagramDefault(source)).toBeUndefined();

  const superseded = 'Choose the best visual for the concept: flowchart, sequence, state, architecture map, timeline, comparison or bespoke SVG are examples, not a taxonomy.';
  const reworded = 'Authors may choose custom SVG as another diagram format.';
  const inverted = 'Use hand-drawn HTML diagrams unless the user requests a different format.';
  for (const addition of [superseded, reworded, inverted]) {
    expect(alternativeDiagramDefault(`${source}\n\n${addition}`)).toBeDefined();
  }
  for (const allowed of [
    'Use a bespoke SVG diagram only on an explicit user request.',
    'If the user specifically asks for a custom SVG diagram, use that format.',
    'Never offer hand-authored SVG as a default diagram format.',
  ]) {
    expect(alternativeDiagramDefault(`${source}\n\n${allowed}`)).toBeUndefined();
  }
});
