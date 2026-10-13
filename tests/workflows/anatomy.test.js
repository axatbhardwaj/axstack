import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const anatomy = 'skills/axstack-anatomy/SKILL.md';
const read = (path) => existsSync(`${root}/${path}`) ? readFileSync(`${root}/${path}`, 'utf8') : '';

// Prompt contracts only: removal/inversion must fail, equivalent prose must pass.
const rules = [
  ['intent-first discovery', anatomy, [/description: When/i, /user explicitly (?:asks|requests)/i, /isometric/i, /physical.object/i, /anatomy.style/i, /use axstack-anatomy/i, /vendored anatomy kit/i],
    'description: When the user explicitly requests an isometric, physical-object, or anatomy-style figure, use axstack-anatomy to build it with the vendored anatomy kit.', [[/use axstack-anatomy/i, 'ignore axstack-anatomy']]],
  ['object explains', anatomy, [/object is the explanation/i, /mechanism/i, /concept/i, /maps to/i, /choose|invent/i],
    'Invent a physical object whose mechanism maps to the concept: the object is the explanation.', [[/maps to/i, 'ignores']]],
  ['parts before geometry', anatomy, [/write/i, /parts list/i, /before/i, /geometry/i],
    'Write the parts list before geometry.', [[/before/i, 'after']]],
  ['tone hierarchy', anatomy, [/use/i, /four.tone hierarchy/i, /subject/i, /lit/i],
    'Use the four-tone hierarchy with the subject as the lit part.', [[/four.tone/i, 'single-tone']]],
  ['painter order', anatomy, [/paint/i, /back to front/i, /bottom to top/i, /painter.s order/i],
    "Paint back to front and bottom to top in painter's order.", [[/back to front/i, 'front to back']]],
  ['line resolution', anatomy, [/require/i, /lines/i, /resolve/i, /stroke/i, /dot/i, /outline/i],
    'Require lines to resolve onto a stroke, dot, or outline.', [[/require/i, 'ignore']]],
  ['verify figure', anatomy, [/verify/i, /truth/i, /geometry/i, /both themes/i, /close.ups/i],
    'Verify truth and geometry in both themes with close-ups.', [[/verify/i, 'skip']]],
  ['Bun build', anatomy, [/build/i, /Bun/i, /vendored kit/i, /bun .*build\.mjs/i],
    'Build with Bun from the vendored kit: `bun <anatomy>/examples/<name>/build.mjs`.', [[/Bun/gi, 'Node']]],
  ['viewer size', anatomy, [/count/i, /final UTF.8 page bytes/i, /cap.*512,000/i],
    'Count final UTF-8 page bytes against the cap of 512,000.', [[/512,000/i, '1,024,000']]],
  ['preview pair', anatomy, [/run/i, /html_preview/i, /728px dark/i, /360px light/i],
    'Run html_preview at 728px dark and 360px light.', [[/run/i, 'skip']]],
  ['driver publication', anatomy, [/driver/i, /publishes/i, /html_render/i, /Inline pages/i],
    'The driver publishes with html_render following Inline pages.', [[/driver/i, 'worker']]],
  ['scratch build', anatomy, [/copy/i, /kit\//i, /scripts\/inline-kit\.mjs/i, /figure directory/i, /dispatch scratch/i, /same layout/i],
    'Copy kit/, scripts/inline-kit.mjs and the figure directory into dispatch scratch with the same layout.', [[/dispatch scratch/i,'installed skill']]],
  ['installed tree unchanged', anatomy, [/require/i, /installed tree hash/i, /unchanged/i],
    'Require the installed tree hash to remain unchanged.', [[/unchanged/i,'different']]],
  ['audited parts', anatomy, [/run/i, /--audit/i, /Bun/i, /audited parts/i, /result/i, /time/i],
    'Run --audit under Bun for audited parts and record result and time.', [[/run/i,'skip']]],
  ['inline cap', anatomy, [/at or below 512,000 bytes/i, /deliver/i, /inline/i],
    'At or below 512,000 bytes, deliver inline.', [[/at or below/i,'above']]],
  ['oversized checks', anatomy, [/above 512,000 bytes/i, /keep/i, /author.*reviewer/i, /network scan/i, /ui.verifier/i, /loopback/i],
    'Above 512,000 bytes, keep the author and reviewer bindings, network scan and ui-verifier loopback pass.', [[/keep/i,'drop']]],
  ['oversized browser appearances', anatomy, [/verifier/i, /emulates/i, /prefers-color-scheme/i, /dark.*light/i, /728.*360/i, /configured browser/i],
    'The verifier emulates prefers-color-scheme dark and light at 728 and 360 in its configured browser.', [[/dark and light/i,'dark only']]],
  ['saved reviewed identity', anatomy, [/require/i, /saved.*SHA.256/i, /equals?/i, /reviewed SHA.256/i],
    'Require the saved file SHA-256 to equal the reviewed SHA-256.', [[/equals?|equal/i,'ignore']]],
  ['host-local oversized delivery', anatomy, [/save/i, /~\/axstack-pages\/<run>\/<name>\.html/i, /driver host/i, /host.local path/i, /chat summary/i],
    'Save to ~/axstack-pages/<run>/<name>.html on the driver host and give its host-local path with a chat summary.', [[/driver host/i,'remote host']]],
  ['unsupported boundary', anatomy, [/mark/i, /Chrome.spawning/i, /capture/i, /drive/i, /lines/i, /turn-check/i, /node:child_process/i, /React examples/i, /unsupported/i],
    'Mark Chrome-spawning capture, drive, lines, turn-check, any node:child_process use and React examples unsupported.', [[/unsupported/i,'supported']]],
  ['size estimate and user gate', anatomy, [/author/i, /size class.*time estimate first/i, /driver asks.*user/i, /before.*above Figure/i],
    'The author returns size class and time estimate first, and the driver asks the user before building above Figure.', [[/before/i,'after']]],

];

for (const [name, path, concepts, rewording, inversions] of rules) {
  test(`anatomy instruction: ${name}`, () => checkRule(sentences(read(path)).join('. '),
    (text) => requires(text, ...concepts), rewording, inversions, concepts));
}

for (const [name, prohibition, concepts, rewording, inversions] of [
  ['no network', /never load|do not load/i, [/network resources/i],
    'Do not load network resources.', [[/never load|do not load/i, 'Load']]],

]) {
  test(`anatomy instruction: ${name}`, () => checkRule(sentences(read(anatomy)).join('. '),
    (text) => prohibits(text, prohibition, ...concepts), rewording, inversions));
}

test('repository discovery excludes vendored tests while running repository tests', () => {
  const fixture = mkdtempSync(`${process.env.TMPDIR}/anatomy-discovery-`);
  mkdirSync(`${fixture}/skills/axstack-anatomy/scripts`, { recursive: true });
  mkdirSync(`${fixture}/tests/workflows`, { recursive: true });
  mkdirSync(`${fixture}/tests/installer`, { recursive: true });
  if (existsSync(`${root}/bunfig.toml`)) writeFileSync(`${fixture}/bunfig.toml`, read('bunfig.toml'));
  writeFileSync(`${fixture}/skills/axstack-anatomy/scripts/probe.test.mjs`,
    'import {test} from "bun:test"; test("VENDORED_SENTINEL", () => {throw Error("vendored test executed")});');
  for (const area of ['workflows', 'installer']) {
    writeFileSync(`${fixture}/tests/${area}/probe.test.js`,
      `import {test} from "bun:test"; test("REPOSITORY_${area}", () => {});`);
  }
  const child = Bun.spawnSync([process.execPath, `${root}/skills/axstack/scripts/test-repository.js`],
    { cwd: fixture, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe' });
  const output = child.stdout.toString() + child.stderr.toString();
  expect(output).toContain('REPOSITORY_workflows');
  expect(output).toContain('REPOSITORY_installer');
  expect(output).not.toContain('VENDORED_SENTINEL');
  expect(child.exitCode).toBe(0);
});
