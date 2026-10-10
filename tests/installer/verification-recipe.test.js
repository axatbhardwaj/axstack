import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// The runnable recipe is the interface; this does not prove harness discovery.
const recipe = readFileSync(`${import.meta.dir}/../../.agents/skills/verify-axstack/SKILL.md`, 'utf8');
test('verification launch uses rootless user/network namespaces and retains offline ownership guards', () => {
  const launch = recipe.split('## Launch')[1].split('## Doctor')[0];
  const flags = launch.match(/unshare ([^\n]+?) -- env -i/)?.[1]?.split(/\s+/) ?? [];
  expect(flags).toEqual(['--user', '--map-root-user', '--net']);
  expect(launch).toContain('HOME="$TMPDIR/home"');
  expect(recipe).toContain('test "$(stat -c \'%a:%u\' "$TMPDIR")" = "700:$(id -u)"');
  expect(recipe).toContain('test "$(readlink /proc/self/ns/net)" != "$HOST_NET"');
  expect(recipe).toContain('setpriv --bounding-set=-dac_override,-dac_read_search bun test');
});
