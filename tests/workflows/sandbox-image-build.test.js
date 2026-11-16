import { expect, test } from 'bun:test';
import { provisionPlan } from '../../skills/axstack/sandbox/probes-image-build.js';

const pins = await Bun.file(new URL('../../skills/axstack/sandbox/probes-image-pins.json', import.meta.url)).json();

test('provision plan verifies each frozen download before installing it and never executes content scripts', () => {
  const plan = provisionPlan(pins);
  expect(plan.length).toBe(pins.artifacts.length);
  for (const artifact of pins.artifacts) {
    const step = plan.find((s) => s.id === artifact.id);
    expect(step.verify.checksum).toBe(artifact.checksum);
    expect(step.downloadArgv.at(-1)).toBe(artifact.url);
    expect(step.evidence).toContain(artifact.source);
    expect(step.status).toBe('unknown');
    if (artifact.kind === 'content') {
      expect(step.steps.some((s) => s.argv.includes('write-tree'))).toBe(true);
      expect(step.steps.some((s) => s.argv.some((a) => /(?:install|configure|build)\.sh/.test(a)))).toBe(false);
      expect(step.expectedTree).toBe(artifact.tree);
    }
  }
});

test('required toolchains are provisioned with version and published checksum', async () => {
  const inventory = await Bun.file(new URL('../../skills/axstack/sandbox/inventory.json', import.meta.url)).json();
  const ids = new Set(pins.artifacts.map((a) => a.id));
  for (const entry of inventory.requiredToolchains) {
    const mapped = { 'node-next': 'node-20', 'node-dashboard': 'node-20', 'python-312': 'python-3.12', 'python-313': 'python-3.13' }[entry.id] ?? entry.id;
    expect(ids.has(mapped), entry.id).toBe(true);
  }
  for (const a of pins.artifacts) {
    expect(a.version.length).toBeGreaterThan(0);
    expect(a.source).toMatch(/^https:\/\//);
    expect(a.checksum).toMatch(new RegExp(`^[a-f0-9]{${{ sha1: 40, sha256: 64, sha512: 128 }[a.algorithm]}}$`));
  }
});

test('Android platform uses its official package path so Gradle can discover the verified SDK', () => {
  const platform = pins.artifacts.find(a => a.id === 'android-sdk');
  expect(platform.destination).toBe('/opt/android/platforms/android-37.0');
  const step = provisionPlan(pins).find(p => p.id === 'android-sdk');
  expect(step.steps.at(-1).argv.at(-1)).toBe(platform.destination);
});


test('Linux Swift and SwiftLint builds compile and lint a real source before image completion', () => {
  const steps = Object.fromEntries(provisionPlan(pins).map(p => [p.id, p.steps.flatMap(s => s.argv).join(' ')]));
  expect(steps.swift).toContain('/opt/swift/usr/bin/swiftc');
  expect(steps.swift).toContain('smoke.swift');
  expect(steps.swiftlint).toContain('/opt/swiftlint/swiftlint');
  expect(steps.swiftlint).toContain('lint --strict');
  expect(steps.swiftlint).toContain('mv /opt/swiftlint/swiftlint-static /opt/swiftlint/swiftlint');
});
