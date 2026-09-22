#!/usr/bin/env bun
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';

function isAbsolute(path) {
  return path.startsWith('/');
}

function normalize(path) {
  const absolute = isAbsolute(path);
  const parts = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0) parts.pop();
    } else parts.push(part);
  }
  const normalized = `${absolute ? '/' : ''}${parts.join('/')}`;
  return normalized || (absolute ? '/' : '.');
}

function join(...parts) {
  return normalize(parts.filter(Boolean).join('/'));
}

function resolve(...parts) {
  let path = '';
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    path = `${parts[i]}${path ? `/${path}` : ''}`;
    if (isAbsolute(parts[i])) return normalize(path);
  }
  return normalize(`${process.cwd()}/${path}`);
}

function dirname(path) {
  const normalized = normalize(path);
  if (normalized === '/') return '/';
  const index = normalized.lastIndexOf('/');
  if (index < 0) return '.';
  return index === 0 ? '/' : normalized.slice(0, index);
}

function relative(from, to) {
  const fromParts = resolve(from).split('/').filter(Boolean);
  const toParts = resolve(to).split('/').filter(Boolean);
  let common = 0;
  while (fromParts[common] === toParts[common] && common < fromParts.length) common += 1;
  return [...Array(fromParts.length - common).fill('..'), ...toParts.slice(common)].join('/');
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const values = { files: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--') || value === undefined) fail(`invalid argument near ${flag ?? '(end)'}`);
    const key = flag.slice(2);
    if (key === 'file') values.files.push(value);
    else if (['source-root', 'archive-root', 'repo', 'pr', 'run', 'task', 'head', 'dispatch'].includes(key)) {
      if (values[key] !== undefined) fail(`duplicate --${key}`);
      values[key] = value;
    } else fail(`unknown argument: ${flag}`);
  }
  for (const key of ['source-root', 'archive-root', 'repo', 'head', 'dispatch']) {
    if (!values[key]) fail(`missing --${key}`);
  }
  if (values.files.length === 0) fail('at least one --file is required');
  if (!isAbsolute(values['source-root']) || !isAbsolute(values['archive-root'])) {
    fail('source and archive roots must be absolute');
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(values.repo)) fail('repo must be owner/name');
  const hasPr = values.pr !== undefined;
  const hasRun = values.run !== undefined;
  const hasTask = values.task !== undefined;
  if (hasPr === hasRun || hasRun !== hasTask) {
    fail('identity requires either --pr or both --run and --task, mutually exclusive');
  }
  if (hasPr && !/^[1-9][0-9]*$/.test(values.pr)) fail('pr must be a positive integer');
  for (const key of ['run', 'task']) {
    if (values[key] !== undefined && !/^[A-Za-z0-9_-]+$/.test(values[key])) {
      fail(`${key} contains unsafe characters`);
    }
  }
  if (!/^[0-9a-f]{40}$/.test(values.head)) fail('head must be an exact 40-character lowercase SHA');
  if (!/^[A-Za-z0-9_-]+$/.test(values.dispatch)) fail('dispatch contains unsafe characters');
  values.files = [...new Set(values.files)].sort();
  for (const file of values.files) {
    const parts = file.split('/');
    if (!file || isAbsolute(file) || parts.some((part) => !part || part === '.' || part === '..') || file.includes('\0')) {
      fail(`unsafe evidence path: ${file || '(empty)'}`);
    }
  }
  return values;
}

async function assertRealPath(path, expectedType) {
  const st = await lstat(path).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (!st) fail(`missing ${expectedType}: ${path}`);
  if (st.isSymbolicLink()) fail(`refusing symlink: ${path}`);
  if (expectedType === 'directory' && !st.isDirectory()) fail(`not a directory: ${path}`);
  if (expectedType === 'file' && !st.isFile()) fail(`not a regular file: ${path}`);
  return st;
}

async function assertNoSymlinkComponents(root, rel) {
  let current = root;
  for (const part of rel.split('/')) {
    current = join(current, part);
    const st = await assertRealPath(current, current === join(root, rel) ? 'file' : 'directory');
    if (st.isSymbolicLink()) fail(`refusing symlink: ${current}`);
  }
}

async function assertSafeAncestors(path) {
  const absolute = resolve(path);
  let current = '/';
  for (const part of absolute.split('/').filter(Boolean)) {
    current = join(current, part);
    const st = await lstat(current).catch((err) => {
      if (err?.code === 'ENOENT') return null;
      throw err;
    });
    if (!st) break;
    if (st.isSymbolicLink()) fail(`refusing symlink path component: ${current}`);
  }
}

async function ensurePrivateDir(path) {
  const st = await lstat(path).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (st) {
    if (st.isSymbolicLink() || !st.isDirectory()) fail(`unsafe archive directory: ${path}`);
    if ((st.mode & 0o077) !== 0) fail(`archive directory must have private 0700 permissions: ${path}`);
    return;
  }
  await mkdir(path, { mode: 0o700 });
  await chmod(path, 0o700);
}

function sha256(bytes) {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}

async function collectSource(sourceRoot, files) {
  await assertRealPath(sourceRoot, 'directory');
  const collected = {};
  for (const rel of files) {
    await assertNoSymlinkComponents(sourceRoot, rel);
    const bytes = await readFile(join(sourceRoot, rel));
    collected[rel] = { bytes, sha256: sha256(bytes), size: bytes.length };
  }
  return collected;
}

function manifestBytes(identity, collected) {
  const files = {};
  for (const rel of Object.keys(collected).sort()) {
    files[rel] = { sha256: collected[rel].sha256, size: collected[rel].size };
  }
  return Buffer.from(JSON.stringify({ version: 1, identity, files }, null, 2) + '\n');
}

async function verifyArchive(archiveDir, identity, collected) {
  const archiveStat = await assertRealPath(archiveDir, 'directory');
  if ((archiveStat.mode & 0o077) !== 0) fail(`archive permissions are not private: ${archiveDir}`);
  const filesRoot = join(archiveDir, 'files');
  const filesStat = await assertRealPath(filesRoot, 'directory');
  if ((filesStat.mode & 0o077) !== 0) fail(`archive permissions are not private: ${filesRoot}`);
  const manifestPath = join(archiveDir, 'manifest.json');
  const expectedManifest = manifestBytes(identity, collected);
  const actualManifest = await readFile(manifestPath);
  if (!actualManifest.equals(expectedManifest)) fail(`archive manifest mismatch: ${manifestPath}`);
  if (((await assertRealPath(manifestPath, 'file')).mode & 0o077) !== 0) {
    fail(`archive manifest permissions are not private: ${manifestPath}`);
  }
  for (const [rel, expected] of Object.entries(collected)) {
    const archived = join(archiveDir, 'files', rel);
    await assertNoSymlinkComponents(filesRoot, rel);
    const st = await assertRealPath(archived, 'file');
    if ((st.mode & 0o077) !== 0) fail(`archived evidence permissions are not private: ${archived}`);
    if (sha256(await readFile(archived)) !== expected.sha256) fail(`archived evidence hash mismatch: ${rel}`);
  }
  const actualFiles = await listArchiveFiles(archiveDir);
  const expectedFiles = ['manifest.json', ...Object.keys(collected).map((rel) => `files/${rel}`)].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail(`archive contains unexpected or missing files: ${archiveDir}`);
  }
  return {
    archiveDir,
    manifestPath,
    manifestHash: sha256(actualManifest),
    files: Object.keys(collected).length,
  };
}

async function listArchiveFiles(root, prefix = '') {
  const files = [];
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const st = await lstat(join(root, rel));
    if (st.isSymbolicLink()) fail(`refusing symlink in archive: ${rel}`);
    if (st.isDirectory()) files.push(...await listArchiveFiles(root, rel));
    else if (st.isFile()) files.push(rel);
    else fail(`unexpected archive entry: ${rel}`);
  }
  return files.sort();
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2));
  const sourceRoot = resolve(args['source-root']);
  const archiveRoot = resolve(args['archive-root']);
  const sourceToArchive = relative(sourceRoot, archiveRoot);
  const archiveToSource = relative(archiveRoot, sourceRoot);
  if (
    sourceToArchive === '' || (!sourceToArchive.startsWith('..') && !isAbsolute(sourceToArchive)) ||
    archiveToSource === '' || (!archiveToSource.startsWith('..') && !isAbsolute(archiveToSource))
  ) fail('source and archive roots must not contain each other');

  const collected = await collectSource(sourceRoot, args.files);
  const identity = args.pr
    ? { repo: args.repo, pr: Number(args.pr), head: args.head, dispatch: args.dispatch }
    : { repo: args.repo, run: args.run, task: args.task, head: args.head, dispatch: args.dispatch };
  const repoSlug = args.repo.replace('/', '--');
  const identityParts = args.pr
    ? [`pr-${args.pr}`]
    : [`run-${args.run}`, `task-${args.task}`];
  const archiveDir = join(archiveRoot, repoSlug, ...identityParts, args.head, args.dispatch);

  await assertSafeAncestors(archiveRoot);
  let current = archiveRoot;
  const generated = [repoSlug, ...identityParts, args.head];
  await ensurePrivateDir(current);
  for (const part of generated) {
    current = join(current, part);
    await ensurePrivateDir(current);
  }
  const existing = await lstat(archiveDir).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory()) fail(`unsafe existing archive: ${archiveDir}`);
    const receipt = await verifyArchive(archiveDir, identity, collected);
    console.log(JSON.stringify({ status: 'verified', ...receipt }));
    return;
  }

  const tempDir = `${archiveDir}.tmp-${process.pid}`;
  if (await lstat(tempDir).catch((err) => err?.code === 'ENOENT' ? null : Promise.reject(err))) {
    fail(`temporary archive already exists: ${tempDir}`);
  }
  await mkdir(join(tempDir, 'files'), { recursive: true, mode: 0o700 });
  await chmod(tempDir, 0o700);
  await chmod(join(tempDir, 'files'), 0o700);
  try {
    for (const [rel, entry] of Object.entries(collected)) {
      const dest = join(tempDir, 'files', rel);
      const parent = dirname(dest);
      await mkdir(parent, { recursive: true, mode: 0o700 });
      let cursor = join(tempDir, 'files');
      const parentRel = relative(cursor, parent);
      for (const part of parentRel === '' ? [] : parentRel.split('/')) {
        cursor = join(cursor, part);
        await chmod(cursor, 0o700);
      }
      await writeFile(dest, entry.bytes, { flag: 'wx', mode: 0o600 });
      await chmod(dest, 0o600);
    }
    const manifestPath = join(tempDir, 'manifest.json');
    await writeFile(manifestPath, manifestBytes(identity, collected), { flag: 'wx', mode: 0o600 });
    await chmod(manifestPath, 0o600);
    await rename(tempDir, archiveDir);
  } catch (err) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }

  const receipt = await verifyArchive(archiveDir, identity, collected);
  console.log(JSON.stringify({ status: 'archived', ...receipt }));
}

try {
  await main();
} catch (err) {
  console.error(`archive-evidence: ${err.message}`);
  process.exitCode = 1;
}
