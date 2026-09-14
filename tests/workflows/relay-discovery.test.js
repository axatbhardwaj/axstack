import { test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const relayPath = 'skills/axstack-relay/SKILL.md';

function markdownBelow(path) {
  return readdirSync(path, { recursive: true })
    .filter((name) => name.endsWith('.md'))
    .map((name) => `${path}/${name}`);
}

// Structural red: this fails until the optional bundled skill exists. These
// checks prove the shipped instruction surface, not future agent behavior.
test('relay discovery: bundled skill has an intent-first entrypoint', () => {
  expect(existsSync(`${root}/${relayPath}`), `missing ${relayPath}`).toBe(true);
  const relay = read(relayPath);
  expect(relay).toMatch(/^name: axstack-relay$/m);
  expect(relay).toMatch(/^description: When .+, use axstack-relay .+$/m);
  expect(relay.match(/^description:/gm)).toHaveLength(1);
});

test('relay discovery: guard-first order precedes manual and relay commands', () => {
  const relay = read(relayPath);
  const lookup = relay.indexOf('command -v hermes-relay');
  const guard = relay.indexOf('hermes-relay-host-enabled');
  const manual = relay.indexOf('README.md');
  const doctor = relay.indexOf('hermes-relay doctor');
  expect(lookup).toBeGreaterThan(-1);
  expect(guard).toBeGreaterThan(lookup);
  expect(manual).toBeGreaterThan(guard);
  expect(doctor).toBeGreaterThan(manual);
  expect(relay).toMatch(/readlink -f[\s\S]*python3[\s\S]*realpath/i);
  expect(relay).toMatch(/README[^.]*unavailable[\s\S]*capabilit[^.]*only/i);
  expect(relay).toMatch(/missing request schema[^.]*hold/i);
});

test('relay discovery: readiness inspects doctor payload and mode requirements', () => {
  const relay = read(relayPath);
  expect(relay).toMatch(/exit 0[^.]*not[^.]*readiness/i);
  expect(relay).toMatch(/commands[^.]*hermes[^.]*paseo/i);
  expect(relay).toMatch(/gh[^.]*`?pr`? mode/i);
  expect(relay).toMatch(/database[^.]*["`]ok["`]/i);
});

test('relay discovery: policy reachability is conditional from entry, review, and watch', () => {
  for (const path of [
    'skills/axstack/SKILL.md',
    'skills/axstack-review/SKILL.md',
    'skills/axstack-watch/SKILL.md',
  ]) {
    const text = read(path);
    expect(text, `${path}: relay edge`).toContain('axstack-relay');
    expect(text, `${path}: generic policy field`).toContain('Notification policy');
  }
  expect(read('skills/axstack/references/paseo-launch.md')).toContain('Notification policy');
  expect(read('skills/axstack/references/run-record.md')).toContain('Notification policy:');
});

test('relay discovery: public Markdown contains no private transport values or SSH instruction', () => {
  const files = [
    ...markdownBelow(`${root}/skills`),
    ...markdownBelow(`${root}/docs`),
    `${root}/README.md`,
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    expect(text, `${file}: absolute host path`).not.toMatch(/\/(?:root|home)\//);
    expect(text, `${file}: SSH instruction`).not.toMatch(/\bssh\s+/i);
    expect(text, `${file}: recipient-like value`).not.toMatch(/(?:recipient|chat[_ -]?id|server[_ -]?id|token)\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}/i);
  }
});

test('relay scenarios: one case covers every discovery fallback', () => {
  const data = JSON.parse(read('tests/workflows/relay-scenarios.json'));
  expect(data.version).toBe(1);
  expect(data.cases.map(({ id }) => id)).toEqual(['relay-discovery-fallbacks']);
  const scenario = data.cases[0];
  expect(scenario.skill_ref).toBe('axstack-relay');
  expect(scenario.input.policy_absent).toBeTruthy();
  expect(scenario.input.cli_missing).toBeTruthy();
  expect(scenario.input.guard_fails).toBeTruthy();
  expect(scenario.input.database_not_ok).toBeTruthy();
  expect(scenario.input.readme_missing).toBeTruthy();
  expect(scenario.expected).toBeTruthy();
});
