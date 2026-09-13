// Pinned compatibility evidence for the installed protocol boundary. Set
// AXSTACK_PASEO_PROTOCOL_ROOT to an installed @getpaseo/protocol package to
// execute its real parser read-only; production has no protocol dependency.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';

const FIXTURE_PATH = join(
  import.meta.dir,
  'fixtures',
  'paseo-protocol-0.7.2-agent-profiles.json',
);
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
const protocolRoot = Bun.env.AXSTACK_PASEO_PROTOCOL_ROOT;

test.skipIf(!protocolRoot)(
  'installed @getpaseo/protocol parser matches the pinned 0.7.2 cases',
  async () => {
    const installed = JSON.parse(readFileSync(join(protocolRoot, 'package.json'), 'utf8'));
    expect(`${installed.name}@${installed.version}`).toBe(
      `${fixture.package}@${fixture.version}`,
    );
    const { AgentProfileSchema } = await import(join(protocolRoot, 'dist', 'messages.js'));
    for (const entry of fixture.cases) {
      expect(AgentProfileSchema.safeParse(entry.profile).success, entry.name).toBe(
        entry.accepted,
      );
    }
  },
);
