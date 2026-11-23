import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const readJson = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
const presetNames = ['mixed', 'codex-only', 'claude-only'];
test('preset bundles retain three role tables in the frozen container', () => {
  for (const name of presetNames) {
    const data = readJson(`profiles/presets/${name}.json`);
    expect(Object.keys(data)).toEqual(['version', 'roles']);
    expect(data.version).toBe(1);
    expect(data.roles.length).toBeGreaterThan(0);
    expect(new Set(data.roles.map(({ id }) => id)).size).toBe(data.roles.length);
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
  ['axstack-explainer', [/driver authors/i, /ordinary inline HTML/i, /chat Mermaid/i, /by default/i],
    'By default, the driver authors ordinary inline HTML and chat Mermaid.', [[/driver authors/i, 'driver delegates']]],
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

test('mixed visual author pins Opus 5.5 medium and reviewer uses Sol high', () => {
  const roles = readJson('profiles/presets/mixed.json').roles;
  expect(roles.find(({id}) => id === 'axstack-explainer')).toMatchObject({
    provider: 'claude', modelClass: 'opus', model: 'claude-opus-5-5', thinkingOptionId: 'medium',
  });
  expect(readJson('profiles/presets/claude-only.json').roles.find(({id}) => id === 'axstack-explainer'))
    .toMatchObject({ provider: 'claude', modelClass: 'opus', model: 'claude-opus-5-5', thinkingOptionId: 'medium' });
  expect(readJson('profiles/presets/codex-only.json').roles.find(({id}) => id === 'axstack-explainer'))
    .toMatchObject({ provider: 'codex', modelClass: 'sol', thinkingOptionId: 'high' });
  expect(roles.find(({id}) => id === 'axstack-explainer-review')).toMatchObject({provider:'codex', modelClass:'sol', thinkingOptionId:'high'});
});

test('shipped explainer seat docs name the exact Opus 5.5 medium pin', () => {
  const roster = readFileSync(`${root}/skills/axstack/references/role-roster.md`, 'utf8');
  const entry = roster.split('- `axstack-explainer`:')[1]?.split('\n- ')[0] ?? '';
  expect(entry).toMatch(/Opus 5\.5 \(`claude-opus-5-5`\) medium/);
  expect(entry).not.toMatch(/sonnet/i);
  const docs = readFileSync(`${root}/docs/workflows.md`, 'utf8').replace(/\s+/g, ' ');
  expect(docs).toMatch(/`axstack-explainer` pins `claude-opus-5-5` medium with class `opus`/);
  expect(docs).not.toMatch(/`axstack-explainer` pins `claude-sonnet/);
});

for (const preset of presetNames) {
  test(`Publish explicit theme captures: ${preset} explanation reviewer`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    const concepts = [/explicit user theme/i, /PNGs/i, /that theme/i, /same four widths/i];
    checkRule(notes, (text) => requires(text, ...concepts),
      'With an explicit user theme, the PNGs show that theme at the same four widths.',
      [[/that theme/i, 'the dark theme']], concepts);
  });
}

for (const preset of presetNames) {
  test(`design render sources: ${preset} explanation reviewer`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    const rules = [
      [[/non-anatomy Explain inline pages/i, /reviewer inspects/i, /driver/i, /final.byte/i, /html_preview screenshots/i, /728px dark/i, /360px light/i, /artifact SHA-256/i],
        "For non-anatomy Explain inline pages, the reviewer inspects the driver's final-byte html_preview screenshots at 728px dark and 360px light bound to the artifact SHA-256.",
        [[/inspects/i, 'ignores'], [/final.byte/i, 'draft'], [/artifact SHA-256/i, 'page title']]],
      [[/missing/i, /stale/i, /unreadable/i, /inadequate/i, /preview evidence/i, /requires/i, /fresh capture/i, /before review/i],
        'Missing, stale, unreadable or inadequate preview evidence requires fresh capture before review.',
        [[/requires/i, 'waives'], [/before review/i, 'after delivery']]],
      [[/Publish/i, /reviewer/i, /opens/i, /axstack-ui-verifier/i, /PNGs/i, /360px/i,
        /390px mobile/i, /728px/i, /1440px desktop/i, /all four widths dark/i, /artifact SHA-256/i, /before review/i],
        'For Publish the reviewer opens axstack-ui-verifier PNGs at 360px, 390px mobile, 728px and 1440px desktop, all four widths dark, bound to the artifact SHA-256 before review.',
        [[/opens/i, 'skips'], [/axstack-ui-verifier/i, 'author'], [/before review/i, 'after review'],
          [/390px mobile/i, '390px omitted'], [/1440px desktop/i, '728px intermediate'],
          [/all four widths dark/i, 'one width dark']]],
      [[/design review/i, /follows/i, /design\.md/i, /neon\.md/i, /palette/i, /FRONTEND-DESIGN\.md/i, /lead design and craft authority/i, /every inline HTML page/i, /every explicitly requested standalone HTML file/i, /every Publish article adaptation/i],
        'Design review follows design.md hard rules, the neon.md palette and FRONTEND-DESIGN.md as lead design and craft authority for every inline HTML page, every explicitly requested standalone HTML file and every Publish article adaptation.',
        [[/follows/i, 'skips'], [/lead/i, 'subordinate'], [/every inline HTML page/i, 'some inline pages'], [/every explicitly requested standalone HTML file/i, 'some standalone files'], [/every Publish article adaptation/i, 'some Publish articles']]],
    ];
    for (const [concepts, rewording, inversions] of rules) {
      checkRule(notes, (text) => requires(text, ...concepts), rewording, inversions, concepts);
    }
  });
}

for (const preset of presetNames) {
  test(`design repair ownership: ${preset} explanation reviewer`, () => {
    const notes = readJson(`profiles/presets/${preset}.json`).roles.find(({ id }) => id === 'axstack-explainer-review').notes;
    for (const [concepts, rewording, inversions] of [
      [[/fail(?:ing|s) to look decent/i, /blocking design finding/i, /same author/i],
        'A page that fails to look decent is a blocking design finding repaired by the same author.',
        [[/fail(?:ing|s) to look decent/i, 'looks decent'], [/blocking design finding/i, 'advisory observation'], [/same author/i, 'driver']]],
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
