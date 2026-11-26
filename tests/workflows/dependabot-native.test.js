import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { usingIsolatedT3 } from '../../skills/axstack/workflows/conformance/isolated.mjs';
import { makeTempRoot } from '../installer/helpers.js';

const t3 = Bun.which('t3');
const root = `${import.meta.dir}/../..`;
const name = 'axstack-dependabot-merge';

test.skipIf(!t3)(
  'real T3 loads the packed bundle and replays three distinct report-only heads',
  async () => {
    const scratch = makeTempRoot('axstack-dependabot-pack-');
    const pack = Bun.spawnSync([process.execPath, 'pm', 'pack', '--destination', scratch], { cwd: root });
    expect(pack.exitCode).toBe(0);
    const archive = readdirSync(scratch).find((file) => file.endsWith('.tgz'));
    const unpack = Bun.spawnSync(['tar', '-xzf', archive], { cwd: scratch });
    expect(unpack.exitCode).toBe(0);
    const file = name + '-v1.mjs';
    const bundle = readFileSync(`${scratch}/package/skills/axstack/workflows/bundles/${file}`);
    let headIndex = 0;
    const runId = (index) => ({ scheduledAt: new Date(Date.UTC(2026, 10, 26, 0, 30 * index)).toISOString() });
    await usingIsolatedT3(
      {
        t3,
        defaultLocation: true,
        beforeStart(server) {
          writeFileSync(server.workflows + '/' + file, bundle);
          const path = server.root + '/binding.json';
          const binding = JSON.stringify({
            project: server.project,
            worktreeRoot: server.root + '/worktrees',
            roles: server.root + '/roles.json',
            registryTokenFile: server.root + '/catalog-token',
            bun: process.execPath,
            t3,
          });
          writeFileSync(path, binding, { mode: 0o600 });
          writeFileSync(
            server.base + '/.axstack-workflows.json',
            JSON.stringify({
              workflows: {
                [name + '@1']: {
                  binding: path,
                  bindingDigest: new Bun.CryptoHasher('sha256').update(binding).digest('hex'),
                },
              },
            }),
            { mode: 0o600 },
          );
          writeFileSync(
            server.root + '/gh',
            `#!${process.execPath}
import {fixture} from ${JSON.stringify(import.meta.dir + '/dependabot-forge-fixture.js')};
const endpoint = Bun.argv.at(-1);
if (Bun.argv[2] !== 'api' || !Bun.argv.includes('GET')) process.exit(19);
const id = Number(await Bun.file(${JSON.stringify(server.root + '/head-index')}).text());
const data = await fixture({headIndex:id})(endpoint);
console.log('HTTP/2 ' + data.status + ' ' + (data.status === 200 ? 'OK' : 'Error'));
if (data.link) console.log('Link: ' + data.link);
console.log('\\n' + JSON.stringify(data.body));
`,
            { mode: 0o700 },
          );
          server.env.PATH = server.root + ':' + server.env.PATH;
        },
      },
      async (server) => {
        expect(readdirSync(server.workflows)).toEqual([file]);
        const replay = async (index, expected) => {
          writeFileSync(server.root + '/head-index', String(headIndex));
          const started = server.start(name, 'replay-' + index, runId(index));
          const completed = await server.waitFor(started.runId, 'completed');
          expect(completed.result).toMatchObject({ discovery: 'pass', pulls: [{ disposition: expected, number: 1 }] });
          const { steps } = server.command('workflow', 'show', started.runId, '--json');
          expect(steps.some((step) => step.kind === 'agent')).toBe(false);
        };
        await replay(1, 'report-only');
        await replay(2, 'duplicate');
        headIndex = 1;
        await replay(3, 'report-only');
        headIndex = 2;
        await replay(4, 'report-only');
        headIndex = 3;
        await replay(5, 'binding-hold');
      },
    );
  },
  50_000,
);
