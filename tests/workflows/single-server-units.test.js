import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const dir = `${import.meta.dir}/../../skills/axstack/systemd`;
test('single-server units invoke the installed Bun script every minute as an opt-in user timer', () => {
  for (const suffix of ['service', 'timer']) expect(existsSync(`${dir}/axstack-single-server.${suffix}`)).toBe(true);
  const service = readFileSync(`${dir}/axstack-single-server.service`, 'utf8');
  expect(service).toMatch(/^Type=oneshot$/m);
  expect(service).toMatch(/^Environment=PATH=%h\/\.bun\/bin:\/usr\/local\/bin:\/usr\/bin:\/bin$/m);
  expect(service).toMatch(/^UMask=0077$/m);
  expect(service).toMatch(/^ExecStart=\/usr\/bin\/env bun %h\/\.agents\/skills\/axstack\/scripts\/single-server\.js$/m);
  const timer = readFileSync(`${dir}/axstack-single-server.timer`, 'utf8');
  for (const setting of ['OnStartupSec=1min', 'OnUnitActiveSec=1min', 'Unit=axstack-single-server.service', 'WantedBy=timers.target']) {
    expect(timer.split('\n')).toContain(setting);
  }
});
