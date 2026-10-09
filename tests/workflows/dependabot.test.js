import { expect, test } from 'bun:test';

test('Dependabot schedules grouped weekly GitHub Actions updates with bounded PRs', async () => {
  const file = Bun.file(`${import.meta.dir}/../../.github/dependabot.yml`);
  expect(await file.exists()).toBe(true);
  const config = Bun.YAML.parse(await file.text());
  expect(config.version).toBe(2);
  expect(config.updates).toHaveLength(1);
  const [actions] = config.updates;
  expect(actions['package-ecosystem']).toBe('github-actions');
  expect(actions.directory).toBe('/');
  expect(actions.schedule.interval).toBe('weekly');
  expect(Number.isInteger(actions['open-pull-requests-limit'])).toBe(true);
  expect(actions['open-pull-requests-limit']).toBeGreaterThan(0);
  expect(actions['open-pull-requests-limit']).toBeLessThanOrEqual(2);
  const groups = Object.values(actions.groups);
  expect(groups).toHaveLength(1);
  expect(groups[0].patterns).toEqual(['*']);
  expect(groups[0]['exclude-patterns'] ?? []).toEqual([]);
  expect(groups[0]['update-types'] ?? ['major', 'minor', 'patch']).toEqual(['major', 'minor', 'patch']);
  expect(groups[0]['applies-to'] ?? 'version-updates').toBe('version-updates');
});
