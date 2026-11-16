import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const inventory = JSON.parse(readFileSync(`${import.meta.dir}/../../skills/axstack/sandbox/inventory.json`, 'utf8'));
const limitations = new Set(['swift-on-linux', 'private-package', 'per-pr-non-registry-download']);
const states = new Set(['pass', 'fail', 'unknown', 'n/a']);
const text = (value) => typeof value === 'string' && value.trim().length > 0;

// This is a packaged configuration contract, not a provisioning or smoke-test verdict.
function validate(data) {
  expect(data.schemaVersion).toBe(1);
  expect(data.host).toBe('axat-vps');
  expect(data.inventoryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const evidence = (value) => {
    expect(Array.isArray(value) && value.length > 0).toBe(true);
    for (const source of value) expect(text(source)).toBe(true);
  };
  const ids = new Set();
  expect(data.requiredToolchains.length).toBeGreaterThan(0);
  for (const entry of data.requiredToolchains) {
    expect(text(entry.id) && !ids.has(entry.id)).toBe(true);
    ids.add(entry.id);
    expect(text(entry.name)).toBe(true);
    if (!text(entry.version)) throw new Error(`required toolchain ${entry.id} needs a version`);
    expect(['exact', 'major', 'minor', 'constraint'].includes(entry.versionPrecision)).toBe(true);
    expect(states.has(entry.availability)).toBe(true);
    evidence(entry.evidence);
  }
  expect(data.repositories.length).toBeGreaterThan(0);
  const repositories = new Set();
  for (const repo of data.repositories) {
    expect(repo.name).toMatch(/^[\w.-]+\/[\w.-]+$/);
    expect(repositories.has(repo.name)).toBe(false);
    repositories.add(repo.name);
    expect(states.has(repo.status)).toBe(true);
    if (repo.status === 'pass') expect(repo.revision).toMatch(/^[a-f0-9]{40}$/);
    evidence(repo.evidence);
    for (const id of repo.toolchains) expect(ids.has(id)).toBe(true);
    for (const service of repo.services) {
      expect(text(service.name)).toBe(true);
      expect(text(service.version)).toBe(true);
      evidence(service.evidence);
    }
    expect(Array.isArray(repo.privatePackages)).toBe(true);
    expect(text(repo.inodeSizing.method)).toBe(true);
    expect(states.has(repo.inodeSizing.status)).toBe(true);
    evidence(repo.inodeSizing.evidence);
  }
  expect(data.registryAllowlist.length).toBeGreaterThan(0);
  expect(new Set(data.registryAllowlist).size).toBe(data.registryAllowlist.length);
  for (const hostname of data.registryAllowlist) {
    expect(hostname).toMatch(/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/);
    evidence(data.registries.find((entry) => entry.hostname === hostname)?.evidence);
  }
  for (const repo of data.repositories) {
    for (const hostname of repo.registries) expect(data.registryAllowlist.includes(hostname)).toBe(true);
  }
  for (const entry of data.limitations) {
    if (!limitations.has(entry.type)) throw new Error(`unapproved limitation type: ${entry.type}`);
    expect(text(entry.detail)).toBe(true);
    evidence(entry.evidence);
  }
  for (const entry of data.openObligations) {
    expect(text(entry.detail)).toBe(true);
    expect(entry.status).toBe('unknown');
    evidence(entry.evidence);
  }
}

test('packaged review inventory has versions, sources and only agreed limitations', () => {
  validate(inventory);
});

test('a missing required version fails the inventory contract', () => {
  for (const value of [undefined, null, '', '  ']) {
    const invalid = structuredClone(inventory);
    invalid.requiredToolchains[0].version = value;
    expect(() => validate(invalid)).toThrow(/needs a version/);
  }
});

test('toolchain provisioning gaps cannot become accepted limitations', () => {
  for (const type of ['missing-toolchain', 'unavailable-service', 'network-failure', 'unknown-repository']) {
    const invalid = structuredClone(inventory);
    invalid.limitations.push({ type, detail: 'not an agreed exception', evidence: ['fixture'] });
    expect(() => validate(invalid)).toThrow(/unapproved limitation type/);
  }
});

test('selected build pins resolve source ranges without rewriting frozen repository declarations', async () => {
  const pins = await Bun.file(new URL('../../skills/axstack/sandbox/probes-image-pins.json', import.meta.url)).json();
  const selected = inventory.selectedProvisioning ?? [];
  for (const id of ['node-20', 'python-3.12', 'python-3.13', 'jdk-11', 'jdk-25', 'android-build-tools', 'android-cmdline', 'go']) {
    const pin = pins.artifacts.find(p => p.id === id);
    expect(selected.find(p => p.id === id)).toEqual({ id, version: pin.version, algorithm: pin.algorithm, checksum: pin.checksum, source: pin.source });
  }
  expect(inventory.requiredToolchains.find(t => t.id === 'node-20').version).toBe('20');
});
