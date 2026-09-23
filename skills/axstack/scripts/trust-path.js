#!/usr/bin/env bun
import { chmod, lstat, readFile, rename, unlink, writeFile } from 'node:fs/promises';

function fail(message) { throw new Error(message); }

function args(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!['--path', '--repo-list-file', '--worktree-list-file'].includes(key) || !argv[i + 1] || values[key]) {
      fail(`invalid argument: ${key ?? '(end)'}`);
    }
    values[key] = argv[i + 1];
  }
  const path = values['--path'];
  if (!path || !path.startsWith('/') || path.includes('\0') || path.split('/').some((part) => part === '.' || part === '..') ||
      (path !== '/' && (path.endsWith('/') || path.includes('//')))) fail('path must be an exact absolute path');
  if (Boolean(values['--repo-list-file']) !== Boolean(values['--worktree-list-file'])) {
    fail('both Orca inventory files are required together');
  }
  return values;
}

async function inventory(file, command, key) {
  let raw;
  if (file) raw = await readFile(file, 'utf8');
  else {
    const result = Bun.spawnSync(['orca', ...command, '--json'], { stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode !== 0) fail(`Orca ${command.join(' ')} failed: ${result.stderr.toString().trim()}`);
    raw = result.stdout.toString();
  }
  const response = JSON.parse(raw);
  if (response.ok !== true || !Array.isArray(response.result?.[key])) fail(`invalid Orca ${key} inventory`);
  if (response.result.truncated === true) fail(`truncated Orca ${key} inventory`);
  return response.result[key];
}

async function configStat(path) {
  const stat = await lstat(path).catch((err) => err?.code === 'ENOENT' ? null : Promise.reject(err));
  if (stat?.isSymbolicLink()) fail(`refusing symlinked Claude config: ${path}`);
  if (stat && !stat.isFile()) fail(`Claude config is not a regular file: ${path}`);
  return stat;
}

async function snapshot(path) {
  const stat = await configStat(path);
  return { stat, raw: stat ? await readFile(path, 'utf8') : null };
}

async function withLock(path, action) {
  // The lock serializes this helper's writers; byte checks also catch other writers.
  const lock = `${path}.axstack-lock`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await writeFile(lock, `${process.pid}\n`, { flag: 'wx', mode: 0o600 });
      try { return await action(); }
      finally { await unlink(lock); }
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
      await Bun.sleep(5 + Math.floor(Math.random() * 10));
    }
  }
  fail('Claude config is busy; trust preflight held');
}

async function trust(configPath, path) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { stat, raw } = await snapshot(configPath);
    const current = raw === null ? {} : JSON.parse(raw);
    if (!current || typeof current !== 'object' || Array.isArray(current) ||
        (current.projects !== undefined && (!current.projects || typeof current.projects !== 'object' || Array.isArray(current.projects)))) {
      fail('invalid Claude config shape');
    }
    if (current.projects?.[path]?.hasTrustDialogAccepted === true) {
      console.log(JSON.stringify({ status: 'already-trusted', path }));
      return;
    }
    current.projects ??= {};
    if (current.projects[path] !== undefined && (!current.projects[path] || typeof current.projects[path] !== 'object' || Array.isArray(current.projects[path]))) {
      fail('invalid Claude project entry');
    }
    current.projects[path] ??= {};
    current.projects[path].hasTrustDialogAccepted = true;

    const temp = `${configPath}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify(current, null, 2)}\n`, { flag: 'wx', mode: stat ? stat.mode & 0o777 : 0o600 });
      if (stat) await chmod(temp, stat.mode & 0o777);
      if ((await snapshot(configPath)).raw !== raw) {
        await Bun.sleep(5 + Math.floor(Math.random() * 10));
        continue;
      }
      await rename(temp, configPath);
      const after = await snapshot(configPath);
      if (JSON.parse(after.raw).projects?.[path]?.hasTrustDialogAccepted === true) {
        console.log(JSON.stringify({ status: 'trusted', path }));
        return;
      }
    } finally {
      await unlink(temp).catch((err) => { if (err?.code !== 'ENOENT') throw err; });
    }
    await Bun.sleep(5 + Math.floor(Math.random() * 10));
  }
  fail('Claude config changed during trust preflight');
}

async function main() {
  const options = args(process.argv.slice(2));
  const path = options['--path'];
  const repos = await inventory(options['--repo-list-file'], ['repo', 'list'], 'repos');
  const worktrees = await inventory(options['--worktree-list-file'], ['worktree', 'list'], 'worktrees');
  const repoIds = new Set(repos.filter((repo) => repo.kind === 'git').map((repo) => repo.id));
  const registered = repos.some((repo) => repo.kind === 'git' && repo.path === path) ||
    worktrees.some((worktree) => repoIds.has(worktree.repoId) && worktree.hostId === 'local' && worktree.path === path);
  if (!registered) fail(`path is not an Orca-registered repository or worktree: ${path}`);

  const home = process.env.HOME;
  if (!home?.startsWith('/')) fail('HOME must be absolute');
  const configPath = `${home.replace(/\/$/, '')}/.claude.json`;
  await withLock(configPath, () => trust(configPath, path));
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
