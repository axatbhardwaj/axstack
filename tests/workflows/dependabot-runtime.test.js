import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { makeTempRoot } from '../installer/helpers.js';

test('only gh receives the forge credential and neither helper inherits unrelated secrets', () => {
  const tmp = makeTempRoot('c10-env-');
  const module = `${import.meta.dir}/../../skills/axstack/workflows/dependabot-runtime.mjs`;
  writeFileSync(`${tmp}/gh`, '#!/bin/sh\nprintf \'HTTP/2 200 OK\\n\\n["%s","%s"]\\n\' "$GH_TOKEN" "$C10_SECRET"\n', {
    mode: 0o700,
  });
  const call = Bun.spawnSync(
    [
      process.execPath,
      '-e',
      `
    import {github, run} from ${JSON.stringify(module)};
    const helper = await run('sh', ['-c', 'printf "%s:%s" "$GH_TOKEN" "$C10_SECRET"']);
    console.log(JSON.stringify({helper, forge: (await github('fixture')).body}));
  `,
    ],
    {
      env: {
        ...process.env,
        PATH: `${tmp}:${process.env.PATH}`,
        GH_TOKEN: 'fixture-token',
        C10_SECRET: 'fixture-secret',
      },
    },
  );
  expect(call.exitCode).toBe(0);
  expect(JSON.parse(call.stdout.toString())).toEqual({ helper: ':', forge: ['fixture-token', ''] });
});

test('the shared T3 RPC bridge resolves the owner seat and checks its effective thread options', async () => {
  const { driverReadback, ownerBinding } = await import('../../skills/axstack/workflows/dependabot-runtime.mjs');
  const base = makeTempRoot('c10-owner-rpc-');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(`${base}/userdata`);
  const threadId = 'workflow:fixture';
  const worktreePath = `${base}/checkout`;
  const token = `${base}/token`;
  const roles = `${base}/roles.json`;
  const t3 = `${base}/t3`;
  const seat = { instanceId: 'codex', model: 'gpt-6.2-sol', options: [{ id: 'reasoningEffort', value: 'high' }] };
  let options = seat.options;
  const tags = [];
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request, listener) {
      if (request.headers.get('authorization') !== 'Bearer fixture-token' || !listener.upgrade(request)) {
        return new Response(null, { status: 403 });
      }
    },
    websocket: {
      message(socket, message) {
        const { id, tag, payload } = JSON.parse(message);
        tags.push(tag);
        const value =
          tag === 'server.getConfig'
            ? {
                providers: [
                  {
                    instanceId: 'codex',
                    driver: 'codex',
                    enabled: true,
                    installed: true,
                    status: 'ready',
                    models: [
                      {
                        slug: seat.model,
                        capabilities: {
                          optionDescriptors: [
                            {
                              id: 'reasoningEffort',
                              options: [{ id: 'high' }],
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              }
            : {
                thread: { id: payload.threadId, runtimeMode: 'full-access', modelSelection: { ...seat, options } },
              };
        socket.send(JSON.stringify({ _tag: 'Exit', requestId: id, exit: { _tag: 'Success', value } }));
      },
    },
  });
  try {
    writeFileSync(token, 'fixture-token', { mode: 0o600 });
    writeFileSync(
      roles,
      JSON.stringify({
        version: 1,
        roles: [
          {
            id: 'axstack-owner',
            provider: 'codex',
            modeId: 'full-access',
            modelClass: 'sol',
            thinkingOptionId: 'high',
          },
        ],
      }),
    );
    writeFileSync(
      `${base}/userdata/server-runtime.json`,
      JSON.stringify({
        origin: server.url.origin,
        startedAt: 'fixture',
        pid: process.pid,
      }),
    );
    const view = {
      thread: {
        threadId,
        status: 'completed',
        archived: false,
        pinned: false,
        createdBy: 'system',
        creationSource: 'server',
        worktreePath,
        providerInstanceId: seat.instanceId,
        model: seat.model,
        runtimeMode: 'full-access',
      },
    };
    writeFileSync(t3, '#!/bin/sh\nprintf "%s\\n" ' + "'" + JSON.stringify(view) + "'\n", { mode: 0o700 });

    const binding = { bun: process.execPath, roles, registryTokenFile: token, t3 };
    const expected = await ownerBinding(base, binding);
    expect(expected).toEqual({ model: seat, runtimeMode: 'full-access' });
    expect(await driverReadback(base, binding, expected, worktreePath, threadId)).toEqual(view);
    options = [{ id: 'reasoningEffort', value: 'low' }];
    expect(await driverReadback(base, binding, expected, worktreePath, threadId)).toBeNull();
    expect(tags).toEqual([
      'server.getConfig',
      'orchestration.getThreadProjection',
      'orchestration.getThreadProjection',
    ]);
  } finally {
    await server.stop(true);
  }
});
