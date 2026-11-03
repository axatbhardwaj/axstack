// Execute the workflow credential preflight with a synthetic token and a curl
// fixture. Publishing stays in CI; this probe never invokes npm or a registry.
import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const ROOT = join(import.meta.dir, '../..');
const workflow = Bun.YAML.parse(readFileSync(join(ROOT, '.github/workflows/publish.yml'), 'utf8'));
const preflight = workflow.jobs.publish.steps.find((step) => step.name === 'Registry credential must work').run;
const TOKEN = 'synthetic-release-fixture';

test('the repository ships no .npmrc that could shadow the workflow credential', () => {
  expect(existsSync(join(ROOT, '.npmrc'))).toBe(false);
});

for (const [scenario, status, supplied] of [
  ['authenticated', 0, TOKEN], ['invalid', 22, TOKEN], ['missing', 0, ''],
]) {
  test(`publish credential preflight: ${scenario}`, () => {
    const sandbox = mkdtempSync(`${Bun.env.TMPDIR ?? '/tmp'}/axstack-publish-credential-`);
    const home = join(sandbox, 'home');
    const bin = join(sandbox, 'bin');
    mkdirSync(home);
    mkdirSync(bin);
    try {
      // Accept exactly the read-only whoami request and its synthetic header.
      writeFileSync(join(bin, 'curl'), `#!/bin/sh
[ "$#" -eq 4 ] && [ "$1" = -sfS ] && [ "$2" = -H ] &&
[ "$3" = "Authorization: Bearer ${TOKEN}" ] &&
[ "$4" = https://registry.npmjs.org/-/whoami ] || exit 99
exit ${status}
`, { mode: 0o700 });
      const child = Bun.spawnSync(['/bin/sh', '-c', preflight], {
        cwd: sandbox,
        env: { HOME: home, PATH: bin, REGISTRY_TOKEN: supplied },
      });
      const npmrc = join(home, '.npmrc');
      if (scenario === 'authenticated') {
        expect(child.exitCode).toBe(0);
        expect(readFileSync(npmrc, 'utf8')).toBe(`//registry.npmjs.org/:_authToken=${TOKEN}\n`);
        expect(statSync(npmrc).mode & 0o777).toBe(0o600);
      } else {
        expect(child.exitCode).not.toBe(0);
        expect(existsSync(npmrc)).toBe(false);
      }
      expect(child.stdout.toString() + child.stderr.toString()).not.toContain(TOKEN);
    } finally {
      rmSync(sandbox, { recursive: true });
    }
  });
}
