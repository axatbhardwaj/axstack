import { lstat, mkdir, realpath, rmdir } from 'node:fs/promises';
import { numberId, repository } from './dependabot-facts.mjs';
import { isSha } from './dependabot-pins.mjs';
import { run, validId } from './dependabot-runtime.mjs';

const git = (project, ...args) => run('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: project });
const under = (path, parent) => path === parent || path.startsWith(parent + '/');
const origin = new Set([
  `https://github.com/${repository}`, `https://github.com/${repository}.git`,
  `git@github.com:${repository}.git`, `ssh://git@github.com/${repository}.git`,
]);

async function ownedFolder(binding, runId, number) {
  if (!validId(runId) || !numberId(number)) return null;
  const { project, worktreeRoot } = binding;
  const info = await lstat(worktreeRoot);
  if (!info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o077) ||
      worktreeRoot !== await realpath(worktreeRoot) || project !== await realpath(project) ||
      under(worktreeRoot, project) || under(project, worktreeRoot) ||
      !origin.has((await git(project, 'remote', 'get-url', '--all', 'origin'))?.trim())) return null;
  return `${worktreeRoot}/axstack-dependabot-${runId}-${number}`;
}

async function detached(project, worktree, sha) {
  if (await realpath(worktree) !== worktree) return false;
  const state = await git(project, 'worktree', 'list', '--porcelain', '-z');
  if (!state) return false;
  return state.split('\0\0').some((block) => {
    const entries = block.split('\0');
    return entries[0] === 'worktree ' + worktree && entries.includes('detached') && entries.includes('HEAD ' + sha);
  });
}

export async function prepareWorktree(binding, runId, number, sha) {
  try {
    const folder = await ownedFolder(binding, runId, number);
    if (!folder || !isSha(sha)) return null;
    const { project } = binding;
    const worktree = folder + '/checkout';
    const pin = async () => (await git(project, 'rev-parse', '--verify', sha + '^{commit}'))?.trim() === sha;
    if (!await pin()) {
      const acquired = await git(project, 'fetch', '--no-tags', '--no-write-fetch-head',
        `https://github.com/${repository}.git`, sha);
      if (acquired === null || !await pin()) return null;
    }
    try {
      await mkdir(folder, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') return null;
      const info = await lstat(folder);
      // A durable step can be replayed after Git finished. Reuse only the
      // matching recorded detached checkout under this run's private folder.
      return info.isDirectory() && info.uid === process.getuid() && !(info.mode & 0o077) &&
        await realpath(folder) === folder && await detached(project, worktree, sha) ? worktree : null;
    }
    if (await git(project, 'worktree', 'add', '--detach', '--', worktree, sha) === null) {
      await rmdir(folder).catch(() => {});
      return null;
    }
    return await detached(project, worktree, sha) ? worktree : null;
  } catch {
    return null;
  }
}

export async function cleanupWorktree(binding, { runId, number, base, worktree }) {
  try {
    const folder = await ownedFolder(binding, runId, number);
    if (!folder || worktree !== folder + '/checkout' || !isSha(base) ||
        !await detached(binding.project, worktree, base) ||
        await git(worktree, 'status', '--porcelain', '--untracked-files=all', '--ignored') !== '') return false;
    // Git's own protection refuses dirty, locked, or externally changed worktrees.
    if (await git(binding.project, 'worktree', 'remove', '--', worktree) === null) return false;
    await rmdir(folder);
    return true;
  } catch {
    return false;
  }
}
