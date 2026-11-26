import { lstat, readFile, realpath } from 'node:fs/promises';
import { gitArgv } from '../scripts/git-argv.js';
import { bindingMatches } from './binding.mjs';
import { json, run } from './dependabot-runtime.mjs';
import {
  completeProjects, head, hosts, id, identity, itemId, localHost,
  receiptDecisions, threadDecision, threadInventory, worktreeInventory,
} from './fleet-cleanup.mjs';

const path = (value) => typeof value === 'string' && /^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(value) &&
  !value.split('/').some((part) => part === '..' || part === '.');

async function privateBytes(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) ||
      info.size > 8 * 1024 * 1024 || await realpath(file) !== file) throw new Error();
  return readFile(file);
}

export async function cleanupBinding(base) {
  try {
    const manifest = json(await privateBytes(base + '/.axstack-workflows.json'));
    const record = manifest?.workflows?.[identity];
    if (!path(record?.binding)) return null;
    const bytes = await privateBytes(record.binding);
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (!bindingMatches(record.bindingDigest, digest)) return null;
    const config = json(bytes);
    if (!config || !['shadow', 'active'].includes(config.mode) || !id(config.projectId) ||
        !['project', 'roles', 'registryTokenFile', 'bun', 't3', 'ssh', 'git', 'receipt'].every((key) => path(config[key])) ||
        Object.keys(config.hosts ?? {}).length !== hosts.length || config.hosts?.[localHost]?.base !== base) return null;
    for (const host of hosts) {
      const binding = config.hosts[host];
      if (!path(binding?.base) || !path(binding.t3) || !Array.isArray(binding.projects) ||
          new Set(binding.projects.map((project) => project?.id)).size !== binding.projects.length ||
          !binding.projects.every((project) => id(project?.id) && path(project.path) && path(project.repository))) return null;
    }
    if (!config.hosts[localHost].projects.some((project) => project.id === config.projectId && project.path === config.project)) return null;
    return config;
  } catch {
    return null;
  }
}

const sshFlags = ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', '-o', 'ClearAllForwardings=yes',
  '-o', 'PermitLocalCommand=no', '-o', 'RemoteCommand=none', '-o', 'SendEnv=-*', '--'];

function readHost(config, host, program, args) {
  if (host === localHost) return run(config[program], args, { cwd: '/' });
  const binary = program === 'git' ? '/usr/bin/git' : config.hosts[host].t3;
  // OpenSSH passes a command string to the remote shell. Quote every word
  // even though bound paths and candidate IDs have their own validation.
  const quote = (word) => "'" + word.replaceAll("'", "'\\''") + "'";
  const command = [binary, ...args].map(quote).join(' ');
  return run(config.ssh, [...sshFlags, 'xzat@' + host, '/usr/bin/env -i HOME="$HOME" PATH=/usr/bin:/bin ' + command],
    { cwd: '/' });
}

const git = (config, host, dir, args) => readHost(config, host, 'git',
  gitArgv('-C', dir, ...args).slice(1));

async function latestReceipt(file) {
  try {
    const bytes = await privateBytes(file);
    if (!file.endsWith('/latest.md')) return json(bytes);
    const name = /^Detailed receipt: (receipt-\d{8}T\d{6}Z\.json)$/m.exec(bytes.toString())?.[1];
    return name ? json(await privateBytes(file.slice(0, -'latest.md'.length) + name)) : null;
  } catch {
    return null;
  }
}

async function checkoutFact(config, host, project, thread, worktrees, receipt) {
  const dir = thread.worktreePath;
  if (dir === null) return 'pass';
  if (!path(dir) || dir === project.repository || dir === project.path) return 'retain';
  const worktree = worktrees.get(dir);
  if (!worktree) return 'worktree-identity';
  if (worktree.blocked) return 'retain';
  const currentHead = await git(config, host, dir, ['rev-parse', '--verify', 'HEAD']);
  if (currentHead?.trim() !== worktree.head) return 'worktree-identity';
  const [keys, index] = await Promise.all([
    git(config, host, dir, ['config', '--null', '--name-only', '--list']),
    git(config, host, dir, ['ls-files', '--stage', '-z']),
  ]);
  if (keys === null || index === null || index.split('\0').some((entry) => entry.startsWith('160000 '))) {
    return 'worktree-status';
  }
  // Git splits -c at the first '=', so build overrides only from validated driver names.
  const drivers = new Set();
  for (const key of keys.split('\0')) {
    if (key.includes('=')) return 'worktree-status';
    if (!key.startsWith('filter.')) continue;
    const driver = /^filter\.([A-Za-z0-9_.-]+)\.(?:clean|process|smudge|required)$/.exec(key)?.[1];
    if (!driver) return 'worktree-status';
    drivers.add(driver);
  }
  const overrides = [...drivers].flatMap((driver) => [
    '-c', `filter.${driver}.clean=`, '-c', `filter.${driver}.process=`, '-c', `filter.${driver}.required=false`,
  ]);
  const dirt = await git(config, host, dir, [...overrides, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignored']);
  if (dirt === null) return 'worktree-status';
  if (dirt !== '') return 'retain';
  const ahead = await git(config, host, dir, ['rev-list', '--count', worktree.head, '--not', '--remotes']);
  if (!/^\d+\n?$/.test(ahead ?? '')) return 'publication';
  if (Number(ahead) > 0) return 'retain';
  if (!head(receipt.publishedHead) || receipt.publishedHead !== worktree.head) return 'publication';
  return 'pass';
}

async function inspectHost(config, host, receipt, decisions) {
  const { base, projects } = config.hosts[host];
  const gaps = new Set();
  const items = [];
  const seen = new Set();
  const note = (fact) => gaps.add(host + '/' + fact);
  if (!completeProjects(projects, receipt?.coverage?.[host])) note('project-coverage');
  for (const project of projects) {
    const [rawThreads, rawWorktrees] = await Promise.all([
      readHost(config, host, 't3', ['thread', 'list', '--base-dir', base, '--project', project.id, '--json']),
      git(config, host, project.repository, ['worktree', 'list', '--porcelain', '-z']),
    ]);
    if (rawThreads === null && rawWorktrees === null && host !== localHost) note('host-unreachable');
    const threads = threadInventory(json(rawThreads), project.id);
    const worktrees = worktreeInventory(rawWorktrees);
    if (!threads) note('thread-coverage');
    if (!worktrees) note('worktrees');
    if (!threads || !worktrees || !decisions) continue;
    for (const thread of threads) {
      const key = itemId(host, thread);
      seen.add(key);
      const decision = decisions.get(key);
      const action = threadDecision(thread, decision);
      if (action === 'retain') continue;
      if (action === 'unknown') {
        note('decision');
        continue;
      }
      const checkout = await checkoutFact(config, host, project, thread, worktrees, decision);
      if (checkout === 'pass') items.push(key + '/' + action);
      else if (checkout !== 'retain') note(checkout);
    }
  }
  return { items, gaps: [...gaps], seen };
}

export async function cleanupObservation(config, scheduledAt) {
  const receipt = await latestReceipt(config.receipt);
  const decisions = receiptDecisions(receipt, scheduledAt);
  const reports = await Promise.all(hosts.map((host) => inspectHost(config, host, receipt, decisions)));
  const gaps = reports.flatMap((report) => report.gaps);
  if (!decisions) gaps.push('fleet/receipt');
  if (receipt?.outstandingCleanupOwnedSnoozes?.length || receipt?.continuation?.length) gaps.push('fleet/continuity');
  if (decisions && [...decisions.keys()].some((key) => !reports.some((report) => report.seen.has(key)))) {
    gaps.push('fleet/decision-coverage');
  }
  const items = gaps.length ? [] : reports.flatMap((report) => report.items).sort();
  return { decision: gaps.length ? 'unknown' : items.length ? 'eligible' : 'quiet', items, gaps: gaps.sort() };
}

export async function cleanupReadback(config, items) {
  const inventory = new Map();
  for (const item of items) {
    const [host, project, threadId, runId, action] = item.split('/');
    const key = host + '/' + project;
    if (!inventory.has(key)) {
      const { base } = config.hosts[host];
      const raw = await readHost(config, host, 't3', ['thread', 'list', '--base-dir', base, '--project', project, '--json']);
      inventory.set(key, threadInventory(json(raw), project));
    }
    const thread = inventory.get(key)?.find((row) => row.threadId === threadId);
    if (!thread || thread.latestRunId !== runId ||
        (action === 'settle' ? !thread.settled : !thread.archived)) return false;
  }
  return true;
}
