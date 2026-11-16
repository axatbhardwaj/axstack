import { afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';

export function makeTempDir(prefix) {
  const root = mkdtempSync(prefix);
  // Register on allocation, in the active test file, even when this module is cached.
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
