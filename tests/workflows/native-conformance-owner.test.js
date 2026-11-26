import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { runBoundCases } from '../../skills/axstack/workflows/conformance/bound.mjs';
import { git } from '../../skills/axstack/workflows/conformance/provision.mjs';
import { makeTempRoot } from '../installer/helpers.js';

test.each(['v2', 'legacy'])('bound cases read agent options and archive the disposable owner through %s state', async (schema) => {
  const root = makeTempRoot('axstack-bound-owner-');
  const base = root + '/base';
  const project = root + '/project';
  mkdirSync(base + '/userdata', { recursive: true });
  mkdirSync(project);
  writeFileSync(root + '/gitconfig', '');
  const state = new Database(base + '/userdata/statev2.sqlite');
  const table = 'orchestration_v2_projection_threads';
  const v2 = schema === 'v2';
  if (v2) {
    state.run(`CREATE TABLE ${table} (thread_id TEXT PRIMARY KEY, payload_json TEXT, archived_at TEXT)`);
  }
  state.run('CREATE TABLE projection_threads (thread_id TEXT PRIMARY KEY, model_selection_json TEXT, archived_at TEXT)');
  const save = (id, modelSelection) => {
    if (v2) state.run(`INSERT INTO ${table} VALUES (?, ?, NULL)`, [id, JSON.stringify({ modelSelection, archivedAt: null })]);
    else state.run('INSERT INTO projection_threads VALUES (?, ?, NULL)', [id, JSON.stringify(modelSelection)]);
  };
  const readArchive = (id) => {
    if (!v2) return state.query('SELECT archived_at FROM projection_threads WHERE thread_id = ?').get(id)?.archived_at;
    const row = state.query(`SELECT archived_at, payload_json FROM ${table} WHERE thread_id = ?`).get(id);
    return row?.archived_at && JSON.parse(row.payload_json).archivedAt === row.archived_at;
  };
  const claude = { instanceId: 'claudeAgent', model: 'fixture-claude' };
  const codex = { instanceId: 'codex', model: 'fixture-codex', options: [{ id: 'reasoningEffort', value: 'low' }] };
  const pending = new Map();
  const threads = new Map();
  const messages = [{ role: 'assistant', text: 'READY' }];
  let pid = 100;
  let commitMoveChecked = false;
  const server = {
    root, base, project, env: { HOME: root, PATH: '/usr/bin:/bin' },
    pid: () => pid,
    async stop() {},
    async restart() { pid++; },
    command(area, command, id) {
      if (area === 'project' && command === 'add') return {};
      if (area === 'thread' && command === 'start') {
        save('owner', claude);
        threads.set('owner', { status: 'completed' });
        return { threadId: 'owner' };
      }
      if (area === 'thread' && command === 'show') {
        return { thread: { ...threads.get(id), archived: Boolean(readArchive(id)) }, messages };
      }
      if (area === 'thread' && command === 'send') {
        threads.get(id).status = 'running';
        return {};
      }
      if (area === 'workflow' && command === 'show') {
        return { run: { runId: id, status: 'waiting' }, steps: [{ threadId: id }] };
      }
      throw new Error('Unexpected fixture command');
    },
    start(workflow, key, payload) {
      const runId = workflow + '-' + key;
      if (!pending.has(runId)) {
        pending.set(runId, { workflow, key, payload });
        if (workflow === 'ax-conf-typed') {
          const { model, worktree } = payload;
          save(runId, model);
          threads.set(runId, { status: 'running', providerInstanceId: model.instanceId,
            model: model.model, runtimeMode: 'full-access', worktreePath: worktree });
        }
      }
      return { runId };
    },
    async waitFor(runId) {
      const { workflow, key, payload } = pending.get(runId);
      switch (workflow) {
        case 'ax-conf-typed':
          return { result: { thread: { threadId: runId }, value: { marker: 'AXSTACK-CONFORMANCE' } } };
        case 'ax-conf-wake': {
          if (key === 'mismatch') return { result: { decision: 'hold' } };
          if (key.startsWith('missing') || readArchive(payload.thread)) {
            return { result: payload.route === 'agent' ? { outcome: 'failed' } : { exit: 1 } };
          }
          const marker = 'AXSTACK-WAKE ax-conf-wake@1 run ' + runId;
          const label = payload.route === 'cli' ? 'this message came through T3 Code' : 'no T3 sender label';
          const role = payload.route === 'cli' ? 'user' : 'system';
          messages.push({ role, text: marker }, { role: 'assistant', text: marker + ' ' + label });
          return { result: { delivery: key.startsWith('busy') ? 'queued' : 'started' } };
        }
        case 'ax-conf-processes':
          expect(readFileSync(root + '/owner-id', 'utf8')).toBe('owner');
          return { result: { coverage: true, exits: { threadShow: 0 }, projectSetCoverage: 'unknown', ms: [0] } };
        case 'ax-conf-pin':
          commitMoveChecked = true;
          return { result: { refused: true } };
        default:
          throw new Error('Probe outside fixture scope');
      }
    },
  };
  try {
    git(server, 'init', '--quiet');
    git(server, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture');
    const report = await runBoundCases(server, { seats: { claude, codex } });
    expect(report).toMatchObject({
      'POC-1': { status: 'pass' }, 'POC-3-agent': { status: 'pass' },
      'POC-6': { status: 'pass' }, 'POC-8': { status: 'pass' },
    });
    expect(readArchive('owner')).toBeTruthy();
    expect(commitMoveChecked).toBe(true);
  } finally {
    state.close();
  }
}, 15_000);
