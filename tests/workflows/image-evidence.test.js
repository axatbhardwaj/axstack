import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { imageEvidence } from '../../skills/axstack/scripts/image-evidence.js';

const digest = (bytes) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const saved = (bytes, resources) => ({ sha256: digest(bytes), resources });
const observed = (url, status, evidence = 'Playwright decode result') => ({ url, status, evidence });

test('extracts HTML images, candidates, SVG, and inline CSS from bytes without executing scripts', async () => {
  const bytes = `<!-- <img src="comment.png"> --><script>const fake='<img src="script.png">'</script>
    <IMG SRC='one.png?x=1&amp;y=2' srcset="small.png 1x, large.png 2x">
    <picture><source srcset="data:image/png;base64,YQ== 1x, wide.png 2x"></picture>
    <input type=image src="button.png"><video poster="poster.png"></video>
    <svg><image href="svg.png"/><use href="#local"/></svg>
    <div style="background:URL( 'inline.png' ); mask:url(#mask)"></div>
    <style>/* url(comment.css) */ .a{background:url("style.png")} .a::before{content:"url(text.png)"}
      .b{background:url(escaped\\ image.png)} .c{background:knurl(fake.png)}</style>`;
  const report = await imageEvidence(bytes);
  expect(report.sha256).toBe(digest(bytes));
  expect(report.resources.map((r) => r.url).sort()).toEqual([
    'one.png?x=1&y=2', 'small.png', 'large.png', 'data:image/png;base64,YQ==', 'wide.png',
    'button.png', 'poster.png', 'svg.png', 'inline.png', 'style.png', 'escaped image.png',
  ].sort());
  expect(report.resources.every((r) => r.status === 'unknown' && r.locations.length > 0)).toBe(true);
});

test('keeps data-URI commas and decodes numeric attribute entities', async () => {
  const report = await imageEvidence(`<img srcset="data:image/svg+xml,%3Csvg%3E,%3C/svg%3E 1x, second.png 2x">
    <img src="&#x61;&#46;png"><img srcset="first.png, second.png 2x">`);
  expect(report.resources.map((r) => r.url).sort()).toEqual([
    'data:image/svg+xml,%3Csvg%3E,%3C/svg%3E', 'second.png', 'a.png', 'first.png',
  ].sort());
});

test('unrecognized entity names stay literal for an unknown result', async () => {
  const report = await imageEvidence('<img src="&constructor;.png">');
  expect(report.resources[0]).toMatchObject({ url: '&constructor;.png', status: 'unknown' });
});

test('maps explicit pass/fail/unknown and absent observations without an aggregate verdict', async () => {
  const bytes = '<img src="good"><img src="broken"><img src="unobservable"><img src="absent">';
  const report = await imageEvidence(bytes, saved(bytes, [
    observed('good', 'pass'), observed('broken', 'fail'), observed('unobservable', 'unknown', 'candidate not selected'),
    observed('unrelated', 'pass'),
    observed('dynamic.png', 'fail'),
  ]));
  expect(report.resources.map(({ url, status }) => [url, status])).toEqual([
    ['good', 'pass'], ['broken', 'fail'], ['unobservable', 'unknown'], ['absent', 'unknown'],
    ['unrelated', 'pass'], ['dynamic.png', 'fail'],
  ]);
  expect(report.resources[3].evidence).toMatch(/absent|no observation/i);
  expect(report.resources.slice(4).every((row) => row.source === 'observation-only')).toBe(true);
  expect(report.summary).toEqual({ pass: 2, fail: 2, unknown: 2, 'n/a': 0 });
  expect(report.verdict).toBeUndefined();
});

test('extracts image-set string and url candidates, including prefixed and nested forms', async () => {
  const report = await imageEvidence(`<style>.a{background:image-set("a.png" 1x, url(b.png) 2x)}
    .b{background:-webkit-image-set('c.png' 1x, url("d.png") 2x)}
    .c{background:image-set("e.png" type("image/png") 1x, linear-gradient(red, blue) 2x)}
    .d::before{content:'image-set("fake.png" 1x)'}</style>`);
  expect(report.resources.map((r) => r.url).sort()).toEqual(['a.png', 'b.png', 'c.png', 'd.png', 'e.png']);
});

test('link as is case-insensitive', async () => {
  const report = await imageEvidence('<link rel="preload" as="IMAGE" href="preload.png">');
  expect(report.resources.map((r) => r.url)).toEqual(['preload.png']);
});

test('extracts legacy HTML image src without confusing SVG image href', async () => {
  const report = await imageEvidence('<image src="legacy.png"><svg><image href="vector.png"/></svg>');
  expect(report.resources.map((r) => r.url)).toEqual(['legacy.png', 'vector.png']);
});

test('CSS imports and font-face sources are not image resources', async () => {
  const report = await imageEvidence(`<style>@import url("theme.css") screen;
    @media screen { @font-face { font-family: "url(fake.png)"; src: url(font.woff2) format("woff2"); } }
    .x{background:url(actual.png)} .x::before{content:'@import url(fake.css);'}
    /* @font-face { src:url(comment.woff) } */ .y{mask:url(mask.png)}</style>`);
  expect(report.resources.map((r) => r.url)).toEqual(['actual.png', 'mask.png']);
});

test('extracts legacy body/table/td/th backgrounds', async () => {
  const report = await imageEvidence('<body background="body.png"><table background="table.png"><tr><td background="td.png"></td><th background="th.png"></th></tr></table></body>');
  expect(report.resources.map((r) => r.url)).toEqual(['body.png', 'table.png', 'td.png', 'th.png']);
});

test('invalid numeric HTML and CSS scalars become U+FFFD', async () => {
  const report = await imageEvidence(`<img src="&#xD800;.png"><img src="&#1114112;.png">
    <style>.a{background:url(\\dfff .png)} .b{background:url(\\110000 .png)}</style>`);
  expect(report.resources.map((r) => r.url)).toEqual(['\ufffd.png']);
  expect(report.resources[0].locations).toHaveLength(4);
});

const helper = `${import.meta.dir}/../../skills/axstack/scripts/image-evidence.js`;
const fixture = `${import.meta.dir}/fixtures/image-evidence`;
const cli = (...args) => Bun.spawnSync([process.execPath, helper, ...args], { stdout: 'pipe', stderr: 'pipe' });

test('CLI help exits 0, lists every flag and takes precedence over other args', () => {
  for (const args of [['--help'], ['--page', 'missing.html', '--help'], ['--help', '--bad']]) {
    const result = cli(...args);
    expect(result.exitCode).toBe(0);
    for (const flag of ['--page', '--observations', '--help']) expect(result.stdout.toString()).toContain(flag);
  }
});

test('CLI unknown resources exit 2', () => {
  const unknown = cli('--page', `${fixture}/good.html`);
  expect(unknown.exitCode).toBe(2);
  expect(JSON.parse(unknown.stdout.toString()).summary.unknown).toBe(1);
});

test('CLI measured failure exits 0', async () => {
  const temporary = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/axstack-image-cli-`);
  try {
    const path = `${fixture}/broken.html`, bytes = await Bun.file(path).text();
    const observations = `${temporary}/observations.json`;
    writeFileSync(observations, JSON.stringify(saved(bytes, [observed('data:image/png;base64,YnJva2Vu', 'fail')])));
    const measured = cli('--page', path, '--observations', observations);
    expect(measured.exitCode).toBe(0);
    expect(JSON.parse(measured.stdout.toString()).summary.fail).toBe(1);
  } finally { rmSync(temporary, { recursive: true }); }
});

test('CLI bad arguments exit 1', () => {
  for (const args of [[], ['--bad'], ['--page']]) {
    const result = cli(...args);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toMatch(/Image evidence:/);
  }
});

test('CLI missing page file exits 1', () => {
  const result = cli('--page', `${fixture}/intentionally-absent.html`);
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toMatch(/Image evidence:/);
});

test('extracts object, embed, image links and feImage declarations', async () => {
  const report = await imageEvidence(`<object data="object.svg"></object><embed src="embed.svg">
    <link rel="icon" href="icon.png"><link rel="preload" as="image" href="link.png" imagesrcset="one.png 1x, two.png 2x">
    <svg><filter><feImage xlink:href="filter.svg"/></filter></svg>`);
  expect(report.resources.map((r) => r.url)).toEqual([
    'object.svg', 'embed.svg', 'icon.png', 'link.png', 'one.png', 'two.png', 'filter.svg',
  ]);
});

test('stale bytes, conflicting results, and unsupported entities cannot produce a pass', async () => {
  const bytes = '<img src="same"><img src="other&NotEqual;image">';
  const stale = await imageEvidence(bytes, saved('different bytes', [observed('same', 'pass')]));
  expect(stale.resources[0].status).toBe('unknown');
  expect(stale.resources[0].evidence).toMatch(/SHA-256/i);
  const conflict = await imageEvidence(bytes, saved(bytes, [
    observed('same', 'pass'), observed('same', 'fail'), observed('other&NotEqual;image', 'pass'),
  ]));
  expect(conflict.resources.every((r) => r.status === 'unknown')).toBe(true);
});

test('deduplicates expected URLs but retains their locations, rejects malformed observations', async () => {
  const bytes = '<img src="same"><style>.x{background:url(same)}</style><img src="same">';
  const report = await imageEvidence(bytes, saved(bytes, [observed('same', 'fail')]));
  expect(report.resources).toHaveLength(1);
  expect(report.resources[0]).toMatchObject({ url: 'same', status: 'fail' });
  expect(report.resources[0].locations).toHaveLength(3);
  await expect(imageEvidence(bytes, saved(bytes, [{ url: 'same', status: 'pass' }]))).rejects.toThrow(/evidence/i);
  await expect(imageEvidence(bytes, saved(bytes, [observed('same', 'n/a')]))).rejects.toThrow(/status/i);
});

test('an img without any source still needs an observation, while a srcset-only img has candidates', async () => {
  const report = await imageEvidence('<img alt="missing"><img srcset="candidate.png 1x"><img src="">');
  expect(report.resources.map(({ url, status }) => [url, status])).toEqual([
    ['', 'unknown'], ['candidate.png', 'unknown'],
  ]);
  expect(report.resources[0].locations).toHaveLength(2);
});
