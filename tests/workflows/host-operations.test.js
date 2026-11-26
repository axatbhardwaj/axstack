import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { publicDocPaths } from './public-docs.js';
import { checkRule, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const markers = /tailscale|t3\s+pair|axstack-review-lane/i;
const withoutHostLinks = (text) => text.replace(/\[[^\]]*\]\((?:docs\/)?host-operations\.md(?:#[^)]+)?\)/g, '');

for (const path of publicDocPaths(root).filter((path) => path !== 'docs/host-operations.md')) {
  test(`host setup has one public home: ${path}`, () => {
    const doc = read(path).replace(/\s+/g, ' ');
    expect(withoutHostLinks(doc)).not.toMatch(markers);
    for (const marker of ['tailscale', 't3 pair', 'axstack-review-lane']) {
      expect(withoutHostLinks(`${doc} ${marker}`)).toMatch(markers);
      expect(withoutHostLinks(`${doc} [${marker}](${path === 'README.md' ? 'docs/' : ''}host-operations.md)`))
        .not.toMatch(markers);
    }
  });
}

// Preserve the public authority boundary separately from skill-only coverage.
test('host preview authority is limited to its unit and private route', () => {
  const doc = read('docs/host-operations.md').replace(/\s+/g, ' ');
  const concepts = [/preview authority/i, /\b(?:covers|includes) only/i, /preview unit/i, /tailscale serve/i, /route/i, /VPS/i];
  const accepts = (text) => sentences(text).some((sentence) => requires(sentence, ...concepts)
    && !/\b(?:plus|also|except|unless)\b/i.test(sentence));
  checkRule(doc, accepts,
    'Preview authority includes only the preview unit and its tailscale serve route on the VPS.',
    [[/\b(?:covers|includes) only/i, 'covers more than'], [/VPS/i, 'VPS, plus any host configuration it needs']], concepts);
  expect(doc).toContain('](workflows.md#automatic-merge-boundaries)');
});

test('an unreadable release run requires both a driver-thread hold and another check', () => {
  const release = read('docs/host-operations.md').split('## Release reinstall')[1]?.split('\n### ')[0] ?? '';
  const unreadable = /\b(?:unreadable|read fails|cannot be read)\b/i;
  const hold = /\bhold\b/i;
  const rearm = /\b(?:re-arm|rearm|schedule the next check)\b/i;
  const concepts = [unreadable, /\bunknown\b/i, /\bdriver thread\b/i, hold, rearm];
  checkRule(release, (text) => requires(text, ...concepts),
    'When the run cannot be read, record one unknown hold in the driver thread and schedule the next check.',
    [[hold, 'skip the hold']], concepts);
});
