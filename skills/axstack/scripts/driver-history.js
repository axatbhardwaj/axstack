import { Database } from 'bun:sqlite';
import * as fs from 'node:fs';
const week = 7 * 86400000;

// Read existing projections across all projects; never create a DB, migrate, or use auth sessions.
export function readHistory(settingsPath, now, explicitPath) {
  const path = explicitPath ?? `${settingsPath.slice(0, settingsPath.lastIndexOf('/'))}/statev2.sqlite`;
  let db;
  try {
    const info = fs.lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid?.() || (info.mode & 0o022)) throw Error();
    for (const suffix of ['-wal', '-shm']) {
      try {
        const s = fs.lstatSync(`${path}${suffix}`);
        if (!s.isFile() || s.isSymbolicLink() || s.uid !== info.uid || (s.mode & 0o022)) throw Error();
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    if (fs.existsSync(`${path}-wal`) && !fs.existsSync(`${path}-shm`)) {
      return { unavailable: 'T3 history WAL has no existing shared memory; refusing sidecar creation' };
    }
    db = new Database(path, { readonly: true });
    const threads = db.query(`SELECT thread_id AS threadId, created_at AS createdAt,
      provider_instance_id AS providerInstanceId,
      json_extract(payload_json, '$.createdBy') AS createdBy,
      json_extract(payload_json, '$.creationSource') AS creationSource,
      json_extract(payload_json, '$.modelSelection.model') AS model,
      json_extract(payload_json, '$.lineage.parentThreadId') AS parentThreadId,
      json_type(payload_json, '$.lineage.parentThreadId') AS parentType
      FROM orchestration_v2_projection_threads WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at, thread_id LIMIT 50001`).all(new Date(now - week).toISOString(), new Date(now).toISOString());
    if (threads.length > 50000) return { unavailable: 'T3 history exceeds bounded inventory limit' };
    if (threads.some((t) => t.createdBy === 'user' && ['web', 'mobile'].includes(t.creationSource)
      && !['null', 'text'].includes(t.parentType))) return { unavailable: 'T3 history lacks parent identity' };
    return { threads, complete: true, total: threads.length,
      source: 'T3 projection database: all projects, current saved models of threads created in seven days' };
  } catch {
    return { unavailable: 'T3 history database unavailable, unsafe or incompatible' };
  } finally { db?.close(); }
}

export function historyCounts(history, choices, now) {
  const unknown = (reason) => ({ status: 'unavailable', reason });
  if (history?.unavailable) {
    const reasons = ['T3 history database unavailable, unsafe or incompatible', 'T3 history exceeds bounded inventory limit',
      'T3 history lacks parent identity', 'T3 history WAL has no existing shared memory; refusing sidecar creation',
      'history file unavailable or malformed'];
    return unknown(reasons.includes(history.unavailable) ? history.unavailable : 'T3 history unavailable; check database or supplied snapshot');
  }
  const threads = Array.isArray(history) ? history : history?.threads;
  if (!Array.isArray(threads)) return unknown('no complete T3 history inventory');
  if (history.hasMore === true || history.nextCursor != null
    || (history.total !== undefined && history.total !== threads.length)) return unknown('incomplete or paginated T3 history');
  const counts = Object.fromEntries(choices.map((c) => [c.selection.model, 0]));
  const seen = new Set();
  for (const t of threads) {
    const id = t.threadId ?? t.id;
    const at = Date.parse(t.createdAt);
    if (typeof id !== 'string' || !id || seen.has(id) || !Number.isFinite(at)
      || typeof t.createdBy !== 'string' || typeof t.creationSource !== 'string') return unknown('malformed T3 history record');
    seen.add(id);
    if (t.createdBy !== 'user' || !['web', 'mobile'].includes(t.creationSource) || at > now || now - at > week) continue;
    if (!Object.hasOwn(t, 'parentThreadId')) return unknown('manual history lacks parent identity');
    if (t.parentThreadId !== null) continue;
    const instance = t.providerInstanceId ?? t.modelSelection?.instanceId;
    const model = t.model ?? t.modelSelection?.model;
    if (typeof instance !== 'string' || typeof model !== 'string') return unknown('manual history lacks provider/model identity');
    if (choices.some((c) => c.selection.instanceId === instance && c.selection.model === model)) counts[model]++;
  }
  return { status: 'available', counts, source: history.source ?? 'saved thread list; caller-supplied scope' };
}
