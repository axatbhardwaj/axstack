import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const contract = read('skills/axstack/references/automations.md');
const prompts = [
  read('skills/axstack/references/review-manager-prompt.md'),
  read('skills/axstack/references/watch-manager-prompt.md'),
];

test('manager admission follows observed resources and fairness without a numeric PR cap', () => {
  expect(contract).toMatch(/no fixed numeric (?:concurrent )?PR[- ]job cap/i);
  expect(contract).toMatch(/observed host resources[\s\S]*provider[\s\S]*spending limits/i);
  expect(contract).toMatch(/dependencies[\s\S]*fairness/i);
  expect(contract).toMatch(/every discovery page/i);
  expect(contract).not.toMatch(/at most (?:five|5) (?:concurrently executing|executing|bounded actionable)/i);
  for (const prompt of prompts) {
    expect(prompt).toMatch(/observed host resources/i);
    expect(prompt).not.toMatch(/five-job|execution cap/i);
  }
});

test('a positively bound orphan is handled within its PR while independent work proceeds', () => {
  expect(contract).toMatch(/orphan process[\s\S]*positively bound[\s\S]*one settled PR job/i);
  expect(contract).toMatch(/host health[\s\S]*sound[\s\S]*unrelated eligible PRs continue/i);
  expect(contract).toMatch(/recheck[\s\S]*exact process[\s\S]*ownership[\s\S]*TERM[\s\S]*verify exit/i);
  expect(contract).toMatch(/unknown or user-owned work[\s\S]*never (?:a kill target|terminat)/i);
  expect(contract).toMatch(/shared-host[\s\S]*ownership\s+uncertainty[\s\S]*pauses? the lane/i);
});

test('packaged prompts defer to a recorded attention-only notification policy', () => {
  expect(contract).toMatch(/recorded Notification policy[\s\S]*deduplicated[\s\S]*escalations requiring attention/i);
  expect(contract).toMatch(/under 40 words/i);
  expect(contract).toMatch(/no routing[\s\S]*progress[\s\S]*merge-ready notices/i);
  for (const prompt of prompts) {
    expect(prompt).toMatch(/recorded Notification policy/i);
    expect(prompt).not.toMatch(/home channel|recipient|chat id/i);
  }
});

test('scenario fixtures exercise uncapped, orphan and notification decisions', () => {
  const cases = JSON.parse(read('tests/workflows/pr-manager-scenarios.json')).cases;
  for (const id of [
    'resource-admission-beyond-five',
    'pr-local-bound-orphan',
    'orphan-identity-change',
    'shared-host-or-ownership-uncertainty',
    'attention-only-notification',
  ]) {
    const scenario = cases.find((entry) => entry.id === id);
    expect(scenario, id).toBeDefined();
    expect(scenario.expected.length).toBeGreaterThan(1);
    expect(scenario.forbidden.length).toBeGreaterThan(1);
  }
});
