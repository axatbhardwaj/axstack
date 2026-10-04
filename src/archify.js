import { lstat, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { join } from './posixpath.js';
import { ARCHIFY_PIN } from './archify-pin.js';

export const ARCHIFY_RECORD = 'axstack-diagram/archify.json';

export function archifyGit(path, ...args) {
  try {
    const result = Bun.spawnSync(['git', ...(path ? ['-C', path] : []), ...args], {
      stdout: 'pipe', stderr: 'pipe', timeout: 60000,
      env: { ...Bun.env, GIT_TERMINAL_PROMPT: '0' },
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || `git exit ${result.exitCode}`);
    return result.stdout.toString().trim();
  } catch (err) {
    throw new Error(`git: ${err.message}`);
  }
}

async function ownersSnapshot(path) {
  const st = await lstat(path).catch((err) => {
    if (err.code === 'ENOENT') return null;
    throw err;
  });
  if (st && (!st.isFile() || st.isSymbolicLink())) throw new Error(`unsafe archify owners file: ${path}`);
  const bytes = st ? await readFile(path) : null;
  const owners = bytes ? JSON.parse(bytes) : [];
  if (!Array.isArray(owners) || owners.some((owner) => typeof owner !== 'string' || !owner.startsWith('/'))) {
    throw new Error(`invalid archify owners file: ${path}`);
  }
  return { bytes, owners };
}

// Drop ownership transactionally; defer destructive cleanup until the skills
// manifest commits. A failed manifest write can then restore the owner list.
export async function planArchifyRelease({ record, skillsRoot, writeAtomic, log }) {
  const ownersFile = `${record.path}.owners.json`;
  const before = await ownersSnapshot(ownersFile);
  const remaining = before.owners.filter((owner) => owner !== skillsRoot);
  if (!before.owners.includes(skillsRoot)) {
    return { rollback: async () => {}, finish: async () => log(`archify: kept ${record.path} (owner is absent)`) };
  }
  await writeAtomic(ownersFile, JSON.stringify(remaining) + '\n', { mode: 0o600 });
  return {
    rollback: () => writeAtomic(ownersFile, before.bytes),
    finish: async () => {
      try {
        if (remaining.length) throw new Error('other skills roots still own this copy');
        const st = await lstat(record.path);
        if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('copy is not a real directory');
        if (archifyGit(record.path, 'rev-parse', 'HEAD') !== record.sha) throw new Error('HEAD differs from the recorded SHA');
        if (archifyGit(record.path, 'status', '--porcelain', '--ignored')) throw new Error('copy has tracked, untracked, or ignored changes');
        await rm(record.path, { recursive: true });
        await rm(ownersFile);
        log(`archify: removed ${record.path}`);
      } catch (err) {
        log(`archify: kept ${record.path} (${err.message})`);
      }
    },
  };
}

// The caller includes this transaction in the skills/manifest rollback.
export async function provisionArchify({ toolsRoot, skillsRoot, writeAtomic, log }) {
  const record = { path: join(toolsRoot, `archify-${ARCHIFY_PIN.sha}`), sha: ARCHIFY_PIN.sha };
  const ownersFile = `${record.path}.owners.json`;
  const before = await ownersSnapshot(ownersFile);
  let created = false;
  let ownersWritten = false;
  const rollback = async () => {
    if (ownersWritten) {
      if (before.bytes === null) await rm(ownersFile);
      else await writeAtomic(ownersFile, before.bytes);
    }
    if (created) await rm(record.path, { recursive: true });
  };
  const existing = await lstat(record.path).catch((err) => {
    if (err.code === 'ENOENT') return null;
    throw err;
  });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
    throw new Error(`unsafe archify copy: ${record.path}`);
  }
  if (existing) {
    const actual = archifyGit(record.path, 'rev-parse', 'HEAD');
    if (actual !== record.sha) throw new Error(`archify SHA mismatch: expected ${record.sha}, got ${actual}`);
  } else {
    let temp = null;
    try {
      await mkdir(toolsRoot, { recursive: true });
      temp = await mkdtemp(join(toolsRoot, '.archify-'));
      archifyGit(null, 'clone', '--filter=blob:none', '--no-checkout', '--', Bun.env.AXSTACK_ARCHIFY_REPO || ARCHIFY_PIN.repo, temp);
      archifyGit(temp, 'sparse-checkout', 'set', 'archify');
      archifyGit(temp, 'checkout', '--detach', record.sha);
      const actual = archifyGit(temp, 'rev-parse', 'HEAD');
      if (actual !== record.sha) throw new Error(`archify SHA mismatch: expected ${record.sha}, got ${actual}`);
      await rename(temp, record.path);
      temp = null;
      created = true;
    } catch (err) {
      log(`archify: unavailable (${err.message.replace(/\s+/g, ' ').slice(0, 180)})`);
      return { record: null, rollback: async () => {} };
    } finally {
      if (temp) await rm(temp, { recursive: true });
    }
  }
  try {
    if (!before.owners.includes(skillsRoot)) {
      ownersWritten = true;
      await writeAtomic(ownersFile, JSON.stringify([...before.owners, skillsRoot].sort()) + '\n', { mode: 0o600 });
    }
  } catch (err) {
    const current = await readFile(ownersFile).catch(() => null);
    ownersWritten = current?.equals(before.bytes) !== true && !(current === null && before.bytes === null);
    await rollback();
    throw err;
  }
  log(`archify: ${record.path} (${record.sha})`);
  return { record, rollback };
}
