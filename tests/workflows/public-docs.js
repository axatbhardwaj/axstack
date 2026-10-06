import { existsSync, readdirSync } from 'node:fs';

// Public policy excludes historical baselines under docs/specs and docs/plans.
export function publicDocPaths(root) {
  return ['README.md', ...(existsSync(`${root}/docs`)
    ? readdirSync(`${root}/docs`, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => `docs/${entry.name}`).sort()
    : [])];
}
