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
    skillName = 'axstack-demo',
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
  const bundle = join(root, 'bundle');
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

export function writeMaliciousBundle(root, { kind = 'traversal' } = {}) {
  // Bundle whose skills payload tries to escape the install target.
  const bundle = join(root, 'evil-bundle');
  const skillDir = join(bundle, 'skills', 'axstack-evil');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), '# Evil\n');
  if (kind === 'traversal') {
    // A real on-disk `..` path cannot be created portably as an entry name,
    // so represent the attack as a symlink pointing outside the skills tree.
    // (Symlink-escape coverage is in the symlink test below.)
  }
  return bundle;
}
