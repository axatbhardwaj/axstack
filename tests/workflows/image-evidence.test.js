import { expect, test } from 'bun:test';
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
  ]));
  expect(report.resources.map(({ url, status }) => [url, status])).toEqual([
    ['good', 'pass'], ['broken', 'fail'], ['unobservable', 'unknown'], ['absent', 'unknown'],
  ]);
  expect(report.resources[3].evidence).toMatch(/absent|no observation/i);
  expect(report.summary).toEqual({ pass: 1, fail: 1, unknown: 2, 'n/a': 0 });
  expect(report.verdict).toBeUndefined();
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
