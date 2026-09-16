// A manually runnable credential check. Its whole purpose is to prove the
// registry token works WITHOUT performing the irreversible publish, so the
// contract worth enforcing is that it can never publish.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const PATH_ = '.github/workflows/registry-auth-check.yml';
const source = () => readFileSync(join(ROOT, PATH_), 'utf8');
const parsed = () => {
  const doc = Bun.YAML.parse(source());
  return { ...doc, on: doc.on ?? doc[true] };
};

test('credential check is manual only', () => {
  expect(existsSync(join(ROOT, PATH_)), `missing ${PATH_}`).toBe(true);
  expect(Object.keys(parsed().on)).toEqual(['workflow_dispatch']);
});

test('credential check cannot publish or mutate anything', () => {
  const doc = parsed();
  expect(doc.permissions).toEqual({ contents: 'read' });
  for (const step of doc.jobs['registry-auth-check'].steps) {
    const body = step.run ?? '';
    expect(body, 'this workflow must never publish').not.toMatch(/\bpublish\b/);
    expect(body).not.toMatch(/\bnpm\s+(?:publish|deprecate|unpublish|owner|access)\b/);
  }
});

test('credential check never prints the token', () => {
  const doc = parsed();
  const steps = doc.jobs['registry-auth-check'].steps;
  for (const step of steps) {
    expect(step.run ?? '').not.toMatch(/secrets\.NPM_ACCESS_TOKEN/);
    expect(step.run ?? '', 'shell tracing would print the token').not.toMatch(/set\s+-[a-z]*x|xtrace/);
  }
  // The response is reduced to a yes/no; whoami echoes the account name, which
  // is fine, but nothing may echo the credential itself.
  const holder = steps.find((step) =>
    Object.values(step.env ?? {}).some((value) => String(value).includes('secrets.NPM_ACCESS_TOKEN')));
  expect(holder, 'no step holds the token').toBeDefined();
  expect(Object.keys(holder.env)).toEqual(['NPM_CONFIG_TOKEN']);
});
