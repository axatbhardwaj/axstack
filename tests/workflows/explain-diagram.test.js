import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { loadedReferences, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const explain = 'skills/axstack-explain/SKILL.md';
const qa = 'skills/axstack-explain/references/visual-qa.md';
const pages = 'skills/axstack-explain/references/inline-pages.md';
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

// Prompt contracts, not live compliance. Existing explain coverage predates
// diagram routing, card exemptions, and finalize-bound QA. Each mutation uses
// the real source in memory; tests never write tracked files.
const rules = [
  ['shared page gate owner', 'skills/axstack/references/ui-verification.md', [/follow|read/i, /page checks/i],
    /follow|read/i, 'ignore', 'Read [Inline pages](../../axstack-explain/references/inline-pages.md) for the page checks.', null, '../../axstack-explain/references/inline-pages.md'],
  ['discovery triggers', explain, [/description: When/i, /asks how, why, explain, or show/i, /do not understand|cannot understand/i, /spec.*finaliz/i, /judge.*need to understand/i, /use axstack-explain/i, /show how it works/i, /exists/i, /missing/i, /unverified/i],
    /use axstack-explain/i, 'ignore axstack-explain', 'description: When the user asks how, why, explain, or show, says they cannot understand, a spec is being finalized, or you judge they need to understand something, use axstack-explain to show how it works and what exists, is missing, or remains unverified.', /do not understand|cannot understand/i],
  ['limited chat path', explain, [/chat/i, /only/i, /explicit chat request/i, /outside the description's conditions/i, /inline-page fallback/i],
    /only/i, 'also by default', 'Chat is used only for an explicit chat request, an answer outside the description\'s conditions, or inline-page fallback.'],
  ['inline page default', explain, [/conditions in the description/i, /inline page/i, /default/i, /create|make/i],
    /default/i, 'exception', 'For the conditions in the description, make an inline page by default.'],
  ['requested artifact format', explain, [/explicitly requested artifact format/i, /honou?r|use/i],
    /honou?r|use/i, 'ignore', 'Use an explicitly requested artifact format.'],
  ['page QA routing', explain, [/inline pages/i, /follow|read/i],
    /follow|read/i, 'ignore', 'For inline pages, read [Inline pages](references/inline-pages.md).', null, 'references/inline-pages.md'],
  ['non-inline visual QA routing', explain, [/every explicitly requested (?:HTML or visual|visual or HTML) artifact/i, /outside inline T3 pages|separate from inline T3 pages/i, /follow|read/i],
    /every/i, 'some', 'For every explicitly requested visual or HTML artifact separate from inline T3 pages, read [Visual QA](references/visual-qa.md).', null, 'references/visual-qa.md'],
  ['independent claim review', explain, [/require|obtain/i, /independent/i, /axstack-explainer-review/i, /consequential or complex claims/i, /on request/i],
    /require|obtain/i, 'waive', 'Obtain independent axstack-explainer-review for consequential or complex claims or on request.'],
  ['consequential examples', explain, [/consequential claims/i, /include|cover/i, /gap or missing-claim reports/i, /blast-radius safety facts/i, /spec readbacks/i],
    /include|cover/i, 'exclude', 'Consequential claims cover gap or missing-claim reports, blast-radius safety facts, and spec readbacks.'],
  ['reply complements page', explain, [/reply/i, /add|contain/i, /only/i, /page omits/i],
    /only/i, 'everything beyond what', 'The reply contains only what the page omits.'],
  ['explain ownership', explain, [/explain owns/i, /evidence gathering/i, /claim labels/i, /700-word cap/i, /dispatch/i, /delivery/i],
    /explain owns/i, 'diagram owns', 'Explain owns evidence gathering, claim labels, the 700-word cap, dispatch, and delivery.'],
  ['non-card words counted', explain, [/count|include/i, /node labels/i, /headings/i, /captions/i, /all non-card text/i],
    /count|include/i, 'exclude', 'Include node labels, headings, captions, and all non-card text in the word count.'],
  ['essential answers and evidence visible', explain, [/essential answers/i, /hidden|hide/i, /links/i, /evidence/i, /silently discard/i],
    /must not be hidden behind links, and evidence must not be silently discarded|never hide/i, 'must be hidden', 'Never hide essential answers behind links or silently discard evidence.', /must not be hidden behind links, and evidence must not be silently discarded|never hide/i],
  ['one page', pages, [/publish|show/i, /one page per answer/i],
    /one/i, 'multiple', 'Show one page per answer.'],
  ['live theme', pages, [/use|follow/i, /T3 theme variables/i, /live theme/i],
    /live/i, 'fixed', 'Follow the live theme with T3 theme variables.'],
  ['theme override', pages, [/only|alone/i, /explicit user theme request/i, /overrides/i],
    /only|alone/i, 'any inferred preference or', 'An explicit user theme request alone overrides the page theme.'],
  ['fluid width', pages, [/use|keep/i, /fluid width/i],
    /fluid/i, 'fixed', 'Keep fluid width with zero outer horizontal padding.'],
  ['zero outer padding', pages, [/zero outer horizontal padding/i, /use|keep/i],
    /zero/i, 'large', 'Keep fluid width with zero outer horizontal padding.'],
  ['page framing', pages, [/outer frame/i, /banner/i, /viewport heights/i],
    /never use|do not use/i, 'use', 'Do not use an outer frame, banner, or viewport heights.', /never use|do not use/i],
  ['chart heights', pages, [/fixed chart heights/i, /use|set/i],
    /fixed/i, 'viewport', 'Set fixed chart heights.'],
  ['frame height', pages, [/height/i, /larger contentHeight/i, /two previews/i, /capped at 2000/i, /set|use/i],
    /larger/i, 'smaller', 'Use the larger contentHeight of the two previews for height, capped at 2000.'],
  ['content chooses shape', pages, [/choose|derive/i, /shape from.*content/i, /fixed template/i],
    /from.*content/i, 'from a fixed template', 'Derive the shape from the content rather than a fixed template.'],
  ['content layout mapping', pages, [/map|match/i, /stages.*connected diagram/i, /sequence.*timeline/i, /comparison.*side by side or table/i, /separate equal items.*list/i],
    /map|match/i, 'ignore', 'Match stages to a connected diagram, sequence to a timeline, comparison to side by side or table, and separate equal items to a list.'],
  ['diagram preference', pages, [/prefer|favor/i, /diagrams and timelines/i],
    /prefer|favor/i, 'reject', 'Favor diagrams and timelines.'],
  ['bordered box grids', pages, [/grids of bordered boxes/i],
    /avoid|never use/i, 'prefer', 'Never use grids of bordered boxes.', /avoid|never use/i],
  ['minimal borders and meaningful color', pages, [/borders.*minimal/i, /color.*only.*meaning/i, /keep|use/i],
    /minimal/i, 'heavy', 'Use color only where it conveys meaning and keep borders minimal.'],
  ['network resources', pages, [/network resources/i, /CDN scripts/i, /fonts/i, /images/i, /Mermaid/i],
    /never load|do not load/i, 'load', 'Do not load network resources, including CDN scripts, fonts, images, or Mermaid.', /never load|do not load/i],
  ['inline images and paths', pages, [/images/i, /data:/i, /use|embed/i],
    /data:/i, 'https:', 'Embed images as data: URIs.'],
  ['absolute local paths', pages, [/absolute local paths/i],
    /never include|do not include/i, 'include', 'Do not include absolute local paths in page bytes.', /never include|do not include/i],
  ['plain links', pages, [/allow|permit/i, /plain.*href.*links/i, /source links/i, /GitHub URLs/i, /path@(?:sha|<sha>)/i],
    /allow|permit/i, 'reject', 'Permit plain <a href> links, with GitHub URLs or path@<sha> for source links.'],
  ['diagram alternative', pages, [/use|draw/i, /inline SVG or CSS/i, /diagrams/i, /text alternative/i],
    /text alternative/i, 'image-only labels', 'Draw diagrams with inline SVG or CSS and a text alternative.'],
  ['page word count', pages, [/count|include/i, /page and reply together/i, /700-word/i],
    /together/i, 'separately', 'Include page and reply together in the 700-word cap.'],
  ['page text measurement', pages, [/use|measure/i, /body.*textContent/i, /minus script and style/i, /collapsed content/i, /SVG labels/i],
    /minus/i, 'plus', 'Measure body textContent minus script and style, including collapsed content and SVG labels.'],
  ['no page card exemption', pages, [/inline pages/i, /card exemption/i],
    /have no|never receive/i, 'receive', 'Inline pages never receive a card exemption.', /have no|never receive/i],
  ['static preference', pages, [/prefer|favor/i, /static pages/i],
    /prefer|favor/i, 'avoid', 'Favor static pages.'],
  ['interactive definition', pages, [/interactive/i, /means|defined/i, /script/i, /form controls/i, /details/i],
    /script/i, 'plain links', 'Interactive is defined as having script, form controls, or <details>.'],
  ['links stay static', pages, [/plain links/i, /interactive/i],
    /are not|never count as/i, 'are', 'Plain links never count as interactive.', /are not|never count as/i],
  ['resource attribute scan', pages, [/scan/i, /exact bytes/i, /every page/i, /remote.*src.*srcset.*href/i, /loaded resources/i],
    /every/i, 'some', 'For every page, scan its exact bytes for remote src, srcset, and href on loaded resources.'],
  ['CSS and API scan', pages, [/scan/i, /@import/i, /\burl\(/i, /fetch/i, /XHR/i, /WebSocket/i, /EventSource/i, /meta refresh/i],
    /scan/i, 'ignore', 'Scan meta refresh, EventSource, WebSocket, XHR, fetch, url(, and @import.'],
  ['scan rejection and fragment exception', pages, [/reject/i, /scan matches/i, /except/i, /local.*url\(#id\)/i, /SVG markers and gradients/i],
    /reject/i, 'accept', 'Except local url(#id) references such as SVG markers and gradients, reject scan matches.'],
  ['CSS target normalization', pages, [/trim/i, /target whitespace and quotes/i, /before/i, /starts.*#/i],
    /before/i, 'after', 'Trim CSS URL target whitespace and quotes before checking whether it starts with #.'],
  ['accessibility', pages, [/use|provide/i, /semantic elements/i, /labels/i, /visible focus/i, /sufficient contrast/i, /both themes/i],
    /both/i, 'one of the', 'Provide semantic elements, labels, visible focus, and sufficient contrast in both themes.'],
  ['page side effects', pages, [/pages/i, /storage/i, /cookies/i, /modals/i, /popups/i],
    /never use|do not use/i, 'use', 'Pages do not use storage, cookies, modals, or popups.', /never use|do not use/i],
  ['two preview checks', pages, [/run|check/i, /html_preview/i, /728px dark/i, /360px light/i, /before publishing/i],
    /before/i, 'after', 'Before publishing, check html_preview at 728px dark and 360px light.'],
  ['preview acceptance', pages, [/require|check/i, /layout/i, /theme/i, /console/i, /missingImages/i, /height/i, /network/i, /word count/i],
    /require|check/i, 'waive', 'Check layout, theme, height, network, word count, zero console errors, and empty missingImages.'],
  ['source fidelity', pages, [/check|verify/i, /every claim/i, /against its source/i],
    /every/i, 'some', 'Verify every claim against its source.'],
  ['verifier interaction route', pages, [/interactive page/i, /require|obtain/i, /real-browser/i, /axstack-ui-verifier/i, /clicks/i, /keyboard/i, /expanded states/i],
    /require|obtain/i, 'waive', 'For every interactive page, obtain a real-browser axstack-ui-verifier pass for clicks, keyboard, and expanded states.'],
  ['verifier exact bytes', pages, [/brief/i, /give|include/i, /evidence path/i, /SHA-256/i, /exact bytes/i],
    /exact/i, 'approximate', 'Include the evidence path and SHA-256 of the exact bytes in the verifier brief.'],
  ['page evidence', pages, [/keep|retain/i, /page bytes/i, /SHA-256/i, /attachmentId/i, /run evidence/i],
    /keep|retain/i, 'discard', 'Retain page bytes, SHA-256, and attachmentId in run evidence.'],
  ['exact checked publication', pages, [/publish|render/i, /html_render/i, /exactly the checked bytes/i],
    /exactly/i, 'approximately', 'Render html_render from exactly the checked bytes.'],
  ['repair and rerun', pages, [/fix|repair/i, /failed check/i, /rerun/i, /new bytes/i],
    /rerun/i, 'skip checks on', 'Repair a failed check and rerun on the new bytes.'],
  ['ambiguous render no retry', pages, [/ambiguous.*html_render/i, /retry/i],
    /never retry|do not retry/i, 'retry', 'After an ambiguous html_render result, do not retry.', /never retry|do not retry/i],
  ['QA scope', qa, [/inline pages/i, /follow|read/i],
    /follow|read/i, 'ignore', 'For inline pages, read [Inline pages](inline-pages.md).', null, 'inline-pages.md'],
  ['byte changes refresh both checks', qa, [/any|every/i, /byte change/i, /requires|needs/i, /fresh QA and review/i],
    /fresh/i, 'stale', 'Every byte change needs fresh QA and review.'],
];

const accepts = ([, , concepts, , , , prohibition, reference], text) => {
  const instruction = prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
  return instruction && (!reference || loadedReferences(text).includes(reference));
};

function check(source, rule) {
  const [name, , , flip, inverse, rewording] = rule;
  expect(accepts(rule, source), `${name}: missing instruction`).toBe(true);
  const clauses = source.replace(/\s+/g, ' ').split(/[.!?;]\s+/);
  const matching = clauses.filter((clause) => accepts(rule, clause));
  expect(matching, `${name}: one instruction owns the rule`).toHaveLength(1);
  // Find the actual source span, preserving Markdown, links, and other rules.
  const pattern = new RegExp(matching[0].split(/\s+/).map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
  expect(source).toMatch(pattern);
  const rewrite = (replacement) => source.replace(pattern, () => replacement);
  expect(accepts(rule, rewrite('')), `${name}: removal`).toBe(false);
  expect(matching[0]).toMatch(flip);
  expect(accepts(rule, rewrite(matching[0].replace(flip, inverse))), `${name}: inversion`).toBe(false);
  const reworded = rewrite(rewording.replace(/[.!?]$/, ''));
  expect(accepts(rule, reworded), `${name}: equivalent wording`).toBe(true);
  for (const sibling of rules.filter((row) => row[1] === rule[1])) {
    expect(accepts(sibling, reworded), `${name}: preserves ${sibling[0]}`).toBe(true);
  }
  if (!rule[6]) expect(accepts(rule, rewrite(`Do not ${rewording}`)), `${name}: whole-rule negation`).toBe(false);
}

for (const rule of rules) {
  test(`explain diagram contract: ${rule[0]}`, () => check(read(rule[1]), rule));
}
