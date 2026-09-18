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

test('relay discovery: lookup precedes target listing and delivery', () => {
  const relay = read(relayPath);
  const lookup = relay.indexOf('command -v hermes');
  const listing = relay.indexOf('hermes send --list telegram');
  const delivery = relay.indexOf('hermes send --to');
  expect(lookup).toBeGreaterThan(-1);
  expect(listing).toBeGreaterThan(lookup);
  expect(delivery).toBeGreaterThan(listing);
  expect(relay).not.toMatch(/hermes-relay/);
  expect(relay).not.toMatch(/\bpaseo (?:inspect|send)\b/);
});

test('relay discovery: readiness inspects the listed target and the JSON receipt', () => {
  const relay = read(relayPath);
  expect(relay).toMatch(/exit 0[^.]*not[^.]*readiness/i);
  expect(relay).toMatch(/--list telegram[^.]*intended (?:target|recipient)/i);
  expect(relay).toMatch(/--json[\s\S]*message_id/);
  expect(relay).toMatch(/--file/);
  expect(relay).toMatch(/one-way/i);
  expect(relay).toMatch(/repl(?:y|ies)[^.]*(?:never|not)[^.]*(?:receipt|authority|routed)/i);
});

test('relay discovery: policy reachability is conditional from review and watch', () => {
  for (const path of [
    'skills/axstack-review/SKILL.md',
    'skills/axstack-watch/SKILL.md',
  ]) {
    const text = read(path);
    expect(text, `${path}: relay edge`).toContain('axstack-relay');
    expect(text, `${path}: generic policy field`).toContain('Notification policy');
  }
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
  expect(scenario.input.target_missing).toBeTruthy();
  expect(scenario.input.delivery_failed).toBeTruthy();
  expect(scenario.input.delivery_uncertain).toBeTruthy();
  expect(scenario.input.reply_received).toBeTruthy();
  expect(scenario.expected).toBeTruthy();
});
