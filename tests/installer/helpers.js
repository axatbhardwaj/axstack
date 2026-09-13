// Shared fixture helpers for installer behavioral tests.
// Builds temporary bundles matching the frozen contract:
//   <bundle>/skills/axstack-*/SKILL.md (+ supporting files)
//   <bundle>/profiles/paseo.json ({ version: 1, agentProfiles: [...] axstack-* ids })
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeTempRoot(prefix = 'axstack-test-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeFixtureBundle(
  root,
  {
    name = 'bundle',    skillName = 'axstack-demo',
    skillBody = '# Axstack Demo\n\nFixture skill for installer tests.\n',
    supportFiles = { 'helper.md': '# Helper\n\nSupporting fixture.\n' },
    profiles = [
      {
        id: 'axstack-driver',
        provider: 'example',
        model: 'example-model',
        modeId: 'default',
        thinkingOptionId: 'medium',
        notes: 'Fixture profile.',
      },
    ],
  } = {},
) {
  const bundle = join(root, name);
  const skillDir = join(bundle, 'skills', skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), skillBody);
  for (const [name, body] of Object.entries(supportFiles)) {
    writeFileSync(join(skillDir, name), body);
  }
  const profilesDir = join(bundle, 'profiles');
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(
    join(profilesDir, 'paseo.json'),
    JSON.stringify({ version: 1, agentProfiles: profiles }, null, 2) + '\n',
  );
  return bundle;
}
