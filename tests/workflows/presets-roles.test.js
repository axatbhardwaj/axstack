import { expect, test } from 'bun:test';
import { publicDocPaths } from './public-docs.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { checkRule, loadedReferences, prohibits, requires, sentences } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const readJson = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
const presetDir = `${root}/profiles/presets`;
const presetNames = ['mixed', 'codex-only', 'claude-only'];
test('preset bundles retain three role tables in the frozen container', () => {
  const names = ['mixed', 'codex-only', 'claude-only'];
  const expectedIds = readJson('profiles/presets/mixed.json').roles.map(({ id }) => id);
  for (const name of names) {
    const data = readJson(`profiles/presets/${name}.json`);
    expect(Object.keys(data)).toEqual(['version', 'roles']);
    expect(data.version).toBe(1);
    expect(data.roles.map(({ id }) => id)).toEqual(expectedIds);
    expect(new Set(data.roles.map(({ id }) => id)).size).toBe(expectedIds.length);
  }
  const mixed = readJson('profiles/presets/mixed.json');
  expect(mixed.roles.find(({ id }) => id === 'axstack-checker').modelClass).toBe('sonnet');
});

test('presets: mixed owner independently uses Sol high with full access', () => {
  const owner = readJson('profiles/presets/mixed.json').roles.find(({ id }) => id === 'axstack-owner');
  expect(owner).toMatchObject({
    provider: 'codex', modelClass: 'sol', thinkingOptionId: 'high', modeId: 'full-access',
  });
});

// Runtime snapshots copy these notes from the presets. The role matrix checks
// cannot catch stale author/reviewer/verifier responsibilities in that prompt.
const explanationRoles = [
  ['axstack-explainer', [/authors every visual Explain delivers/i],
    'The explainer authors every visual Explain delivers.', [[/every/i, 'some']]],
  ['axstack-explainer-review', [/always reviews every visual/i],
    'The reviewer always reviews every visual.', [[/always/i, 'sometimes'], [/every/i, 'some']]],
  ['axstack-ui-verifier', [/owns|performs/i, /inline page/i, /interaction pass/i,
    /every interactive page/i, /exact bytes/i, /SHA-256/i],
    'The verifier performs the inline page interaction pass for every interactive page, bound to the exact bytes and SHA-256.',
    [[/owns|performs/i, 'skips'], [/every interactive page/i, 'some interactive pages']]],
];
for (const [id, concepts, rewording, inversions] of explanationRoles) {
  for (const preset of presetNames) {
    test(`explanation role contract: ${preset}: ${id}`, () => {
      const notes = readJson(`profiles/presets/${preset}.json`).roles.find((role) => role.id === id).notes;
      checkRule(notes, (text) => requires(text, ...concepts), rewording, inversions, concepts);
    });
  }
  test(`explanation role contract: roster: ${id}`, () => {
    const roster = sentences(readFileSync(`${root}/skills/axstack/references/role-roster.md`, 'utf8')).join('. ');
    checkRule(roster, (text) => requires(text, new RegExp(id), ...concepts), `${id}: ${rewording}`, inversions, concepts);
  });
}

test('mixed visual author pins Sonnet 5.5 high and reviewer uses Terra', () => {
  const roles = readJson('profiles/presets/mixed.json').roles;
  expect(roles.find(({id}) => id === 'axstack-explainer')).toMatchObject({
    provider: 'claude', modelClass: 'sonnet', model: 'claude-sonnet-5-5', thinkingOptionId: 'high',
  });
  expect(roles.find(({id}) => id === 'axstack-explainer-review')).toMatchObject({provider:'codex', modelClass:'terra', thinkingOptionId:'medium'});
});

for (const preset of presetNames) {
  test(`design render sources: ${preset} explanation reviewer`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    const rules = [
      [[/inline/i, /reviewer/i, /itself/i, /renders/i, /exact bytes/i, /html_preview/i, /728px dark/i, /360px light/i, /non-publishing self-check/i],
        'For inline pages the reviewer itself renders exact bytes with html_preview at 728px dark and 360px light as a non-publishing self-check.',
        [[/renders/i, 'skips'], [/itself/i, 'via the author'], [/html_preview/i, 'html_render']]],
      [[/Publish/i, /reviewer/i, /opens/i, /axstack-ui-verifier/i, /PNGs/i, /728px dark/i, /360px light/i,
        /390px mobile/i, /1440px desktop/i, /all four widths in both themes/i, /artifact SHA-256/i, /before review/i],
        'For Publish the reviewer opens axstack-ui-verifier PNGs at 728px dark and 360px light plus 390px mobile and 1440px desktop, covering all four widths in both themes bound to the artifact SHA-256 before review.',
        [[/opens/i, 'skips'], [/axstack-ui-verifier/i, 'author'], [/before review/i, 'after review'],
          [/390px mobile/i, '390px omitted'], [/1440px desktop/i, '728px intermediate'],
          [/all four widths in both themes/i, 'one theme per width']]],
      [[/design review/i, /follows/i, /design\.md/i, /FRONTEND-DESIGN\.md/i, /every inline HTML page/i, /every Publish article adaptation/i],
        'Design review follows design.md and FRONTEND-DESIGN.md for every inline HTML page and every Publish article adaptation.',
        [[/follows/i, 'skips'], [/every inline HTML page/i, 'some inline pages'], [/every Publish article adaptation/i, 'some Publish articles']]],
    ];
    for (const [concepts, rewording, inversions] of rules) {
      checkRule(notes, (text) => requires(text, ...concepts), rewording, inversions, concepts);
    }
  });
}

for (const preset of presetNames) {
  test(`design repair limit: ${preset} explanation reviewer`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    for (const [concepts, rewording, inversions] of [
      [[/fail(?:ing|s) to look decent/i, /blocking design finding/i, /same author/i, /within/i, /two.round/i],
        'Within the two-round visual limit, the same author repairs a blocking design finding for a page that fails to look decent.',
        [[/fail(?:ing|s) to look decent/i, 'looks decent'], [/blocking design finding/i, 'advisory observation'], [/within/i, 'outside']]],
      [[/only design findings remain/i, /after/i, /second round/i, /deliver/i, /visual/i, /finding/i, /named/i],
        'Deliver the visual with each finding named if only design findings remain after the second round.',
        [[/second round/i, 'first round'], [/named/i, 'hidden']]],
    ]) checkRule(notes, (text) => requires(text, ...concepts), rewording, inversions, concepts);
  });
}

for (const preset of presetNames) {
  test(`remaining design findings stay disclosed: ${preset} explanation reviewer`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    const concepts = [/remaining finding/i, /fixed/i, /clean pass/i];
    checkRule(notes, (text) => prohibits(text, /never describe/i, ...concepts),
      'Never describe any remaining finding as a clean pass or fixed.',
      [[/never/i, 'always']], concepts);
  });
}

// These duties also ship in roles.json; checking only visual-qa.md misses stale presets.
for (const [label, concepts, rewording, inversions] of [
  ['desktop', [/inspect/i, /1440px desktop screenshot/i, /balanced composition/i, /horizontal margins/i,
    /prose measure/i, /typography/i, /section spacing/i, /chart legibility/i],
  'Inspect typography, section spacing and chart legibility alongside prose measure, horizontal margins and balanced composition in the 1440px desktop screenshot.',
  [[/inspect/i, 'skip'], [/1440px desktop screenshot/i, '728px screenshot'],
    [/balanced composition/i, 'overflow only'], [/chart legibility/i, 'chart presence']]],
  ['mobile', [/inspect/i, /360px and 390px mobile screenshots/i, /gutters/i, /readable text/i, /chart labels/i],
  'Inspect gutters, readable text and chart labels in the 360px and 390px mobile screenshots.',
  [[/inspect/i, 'skip'], [/gutters/i, 'edge-to-edge text'], [/readable text/i, 'text presence']]],
]) {
  for (const preset of presetNames) {
    test(`Publish ${label} inspection: ${preset} explanation reviewer`, () => {
      const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
      checkRule(notes, (text) => requires(text, ...concepts), rewording, inversions, concepts);
    });
  }
}

for (const preset of presetNames) {
  test(`design exclusions: ${preset} reviewer preserves Mermaid and anatomy review`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    const concepts = [/chat Mermaid/i, /anatomy/i, /keep|retain/i, /existing|current/i, /review/i];
    checkRule(notes, (text) => requires(text, ...concepts),
      'Retain the current review for anatomy and chat Mermaid.',
      [[/keep|retain/i, 'discard'], [/existing|current/i, 'new'], [/anatomy/i, 'other figures']], concepts);
  });
  test(`Publish author: ${preset} explainer authors article adaptations`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer').notes;
    const concepts = [/authors|creates/i, /Publish article adaptations/i];
    checkRule(notes, (text) => requires(text, ...concepts),
      'Creates Publish article adaptations too.',
      [[/authors|creates/i, 'ignores'], [/Publish article adaptations/i, 'draft pages']], concepts);
  });
}
