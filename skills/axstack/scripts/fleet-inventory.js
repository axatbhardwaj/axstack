// Normalize saved native observations only. No discovery, reservations or dispatch.
import { canonical, text, time } from './fleet-config.js';

const active = new Set(['queued', 'running', 'waiting']);
const terminal = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
// JSON tuple encoding avoids collisions between IDs containing punctuation.
const identity = (environmentId, taskId) => JSON.stringify([environmentId, taskId]);

export function nativeAssignments(snapshot, hosts, now) {
  const reasons = new Set();
  const unknown = (code) => reasons.add(code);
  const environments = new Set(hosts.map((h) => h.environmentId));
  const tasks = new Map();
  const assignments = new Map();
  const pending = new Map();
  if (snapshot?.complete !== true || !time(snapshot?.observedAt) || !time(now) || snapshot.observedAt > now || !text(snapshot?.evidence)
    || !Array.isArray(snapshot?.tasks) || !Array.isArray(snapshot?.pending)) unknown('inventory-incomplete');
  for (const item of Array.isArray(snapshot?.tasks) ? snapshot.tasks : []) {
    if (!text(item?.origin?.environmentId) || !text(item?.origin?.threadId) || !text(item?.task?.taskId)) {
      unknown('origin-unknown'); continue;
    }
    const key = identity(item.origin.environmentId, item.task.taskId);
    const previous = tasks.get(key);
    if (previous && canonical(previous) !== canonical(item)) unknown('assignment-conflict');
    tasks.set(key, item);
  }
  for (const [key, item] of tasks) {
    const task = item.task;
    const environmentId = task.remoteChild?.environmentId
      ?? (text(task.childThreadId) ? item.origin.environmentId : null);
    if (!text(environmentId)) { unknown('destination-unknown'); continue; }
    if (!environments.has(environmentId)) { unknown('host-unmapped'); continue; }
    if (task.remoteChild && !text(task.remoteChild.threadId)) { unknown('destination-unknown'); continue; }
    if (!active.has(task.status) && !terminal.has(task.status)) { unknown('task-state-unknown'); continue; }
    let rootKey = key;
    if (item.assignmentRoot) {
      rootKey = identity(item.assignmentRoot.environmentId, item.assignmentRoot.taskId);
      const root = tasks.get(rootKey);
      if (!root || root.assignmentRoot) { unknown('assignment-root-unknown'); continue; }
      const rootEnvironment = root.task.remoteChild?.environmentId
        ?? (text(root.task.childThreadId) ? root.origin.environmentId : null);
      if (rootEnvironment !== environmentId) { unknown('assignment-conflict'); continue; }
    }
    const previous = assignments.get(rootKey);
    const state = active.has(task.status) || task.hasPendingChildRuns === true
      || task.workState === 'waiting_for_children' ? 'running' : 'completed';
    // A terminal coordinator with live descendants remains active.
    assignments.set(rootKey, { assignmentId: `task:${rootKey}`, environmentId,
      state: previous?.state === 'running' ? 'running' : state });
  }
  for (const item of Array.isArray(snapshot?.pending) ? snapshot.pending : []) {
    if (!text(item?.origin?.environmentId) || !text(item?.origin?.threadId) || !text(item?.clientRequestId)) {
      unknown('origin-unknown'); continue;
    }
    if (!environments.has(item.environmentId)) { unknown('host-unmapped'); continue; }
    const key = JSON.stringify([item.origin.environmentId, item.origin.threadId, item.clientRequestId]);
    const value = { clientRequestId: key, environmentId: item.environmentId };
    if (item.taskId !== undefined) {
      if (!text(item.taskId)) { unknown('origin-unknown'); continue; }
      const taskKey = identity(item.origin.environmentId, item.taskId);
      const known = tasks.get(taskKey);
      const rootKey = known?.assignmentRoot
        ? identity(known.assignmentRoot.environmentId, known.assignmentRoot.taskId) : taskKey;
      value.taskId = `task:${rootKey}`;
      const reflected = assignments.get(rootKey);
      if (reflected && reflected.environmentId !== item.environmentId) unknown('assignment-conflict');
    }
    const previous = pending.get(key);
    if (previous && canonical(previous) !== canonical(value)) unknown('assignment-conflict');
    pending.set(key, value);
  }
  return { inventoryStatus: reasons.size ? 'unknown' : 'known',
    inventoryObservedAt: snapshot?.observedAt ?? null, inventoryReasons: [...reasons],
    inventoryEvidence: snapshot?.evidence ?? null,
    assignments: [...assignments.values()], pendingAssignments: [...pending.values()] };
}
