import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from '../../src/posixpath.js';
import { assessRoleReadiness, deriveModelClass } from '../../src/roles.js';
import { makeTempRoot, runCli } from './helpers.js';

const root = import.meta.dir.slice(0, -'/tests/installer'.length);

test('installed presets bind the five Muse seats and mixed debug seat without adding a model class', () => {
  const musePins = {
    'axstack-advisor-muse': 'muse-wonder-full-1.0',
    'axstack-reviewer-muse': 'muse-wonder-full-1.0',
    'axstack-arena-judge-muse': 'muse-wonder-full-1.0',
    'axstack-explore-codebase-spark': 'muse-spark-1.3',
    'axstack-research-code-spark': 'muse-spark-1.3',
  };
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const home = makeTempRoot(`axstack-muse-${preset}-`);
    const skillsDir = join(home, 'installed');
    runCli(`${root}/bin/axstack.js`, [
      'install', '--bundle', root, '--preset', preset, '--skills-dir', skillsDir,
      '--no-claude-settings', '--yes',
    ], { env: { HOME: home } });
    const bytes = readFileSync(join(skillsDir, 'axstack', 'roles.json'));
    const { roles } = JSON.parse(bytes);
    for (const [id, pin] of Object.entries(musePins)) {
      const seat = roles.find((row) => row.id === id);
      expect(seat, `${preset}: ${id}`).toBeDefined();
      expect(seat).not.toHaveProperty('modelClass');
      if (preset === 'mixed') {
        expect(seat).toMatchObject({ provider: 'muse', model: pin,
          modeId: 'full-access', thinkingOptionId: 'medium' });
      } else {
        expect(seat).toMatchObject({ provider: preset === 'codex-only' ? 'codex' : 'claude',
          model: null });
      }
    }
    expect(assessRoleReadiness(roles, preset)).toEqual({ ready: true, gaps: [] });
    if (preset === 'mixed') {
      expect(roles.find(({ id }) => id === 'axstack-debug-investigator-4')).toMatchObject({
        provider: 'muse', model: 'muse-wonder-full-1.0', thinkingOptionId: 'medium',
      });
      expect(deriveModelClass('muse-wonder-full-1.0')).toBeNull();
    }
  }
});
