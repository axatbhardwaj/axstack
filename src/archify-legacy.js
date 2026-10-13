import { lstat, readFile, rm } from 'node:fs/promises';

export const ARCHIFY_RECORD = 'axstack-diagram/archify.json';

function archifyGit(path, ...args) {
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
  // JSON.parse coerces its argument to a string; preserve the existing Buffer coercion.
  const owners = bytes ? /** @type {(text: {toString(): string}) => unknown} */ (JSON.parse)(bytes) : [];
  if (!Array.isArray(owners) || owners.some((owner) => typeof owner !== 'string' || !owner.startsWith('/'))) {
    throw new Error(`invalid archify owners file: ${path}`);
  }
  return { bytes, owners, mode: st ? st.mode & 0o777 : null };
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
  try {
    await writeAtomic(ownersFile, JSON.stringify(remaining) + '\n', { mode: 0o600 });
  } catch (err) {
    const current = await readFile(ownersFile);
    if (!current.equals(before.bytes)) {
      try { await writeAtomic(ownersFile, before.bytes, { mode: before.mode }); }
      catch (restoreErr) { err.message += ` (archify owner restore failed: ${restoreErr.message})`; }
    }
    throw err;
  }
  return {
    rollback: () => writeAtomic(ownersFile, before.bytes, { mode: before.mode }),
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

