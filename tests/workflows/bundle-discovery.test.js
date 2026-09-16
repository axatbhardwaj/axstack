import { test, expect } from 'bun:test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const root = `${import.meta.dir}/../../skills`;
const skills = readdirSync(root).filter((name) => existsSync(`${root}/${name}/SKILL.md`)).sort();

test('skill catalog exposes thirteen owned entrypoints and keeps handoff runtime-owned', () => {
  expect(skills).toEqual([
    'axstack', 'axstack-align', 'axstack-audit', 'axstack-debug', 'axstack-explain',
    'axstack-implement', 'axstack-improve', 'axstack-relay', 'axstack-research',
    'axstack-review', 'axstack-spec', 'axstack-tickets', 'axstack-watch',
  ]);
  expect(existsSync(`${root}/axstack-handoff`)).toBe(false);
  expect(existsSync(`${root}/paseo-handoff`)).toBe(false);
});

test('every bundled Markdown pointer resolves inside the installed skill bundle', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`) : entry.name.endsWith('.md') ? [`${dir}/${entry.name}`] : []);
  const base = new URL(`file://${root}/`);
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    for (const [, link] of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      if (/^(?:https?:|mailto:)/.test(link)) continue;
      const url = new URL(link, `file://${file}`);
      expect(url.pathname.startsWith(base.pathname), `${file}: outside bundle: ${link}`).toBe(true);
      expect(existsSync(url.pathname), `${file}: missing ${link}`).toBe(true);
      if (url.hash) {
        const target = readFileSync(url.pathname, 'utf8');
        const anchors = [...target.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) =>
          heading.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-'));
        expect(anchors, `${file}: missing anchor ${link}`).toContain(decodeURIComponent(url.hash.slice(1)));
      }
    }
  }
});
