import * as fs from 'node:fs';

// Cooperating writers share this lock; non-cooperating T3 writes are compared immediately before rename.
export function commit(path, original, selection) {
  const lock = `${path}.axstack-default-sync.lock`;
  try { fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') return 'locked'; throw error; }
  let temp;
  let fd;
  try {
    const info = fs.lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink()) throw Error('settings must be a regular file; symlinks are refused');
    if (fs.readFileSync(path, 'utf8') !== original) return 'concurrent-edit';
    const settings = JSON.parse(original);
    settings.defaultModelSelection = selection;
    const next = `${JSON.stringify(settings, null, 2)}\n`;
    if (JSON.stringify(JSON.parse(original).defaultModelSelection) === JSON.stringify(selection)) return 'unchanged';
    temp = `${path}.axstack-default-sync-${crypto.randomUUID()}.tmp`;
    fd = fs.openSync(temp, 'wx', info.mode & 0o7777);
    fs.fchmodSync(fd, info.mode & 0o7777);
    fs.writeFileSync(fd, next);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    const latest = fs.lstatSync(path);
    if (latest.ino !== info.ino || latest.dev !== info.dev || latest.mode !== info.mode
      || fs.readFileSync(path, 'utf8') !== original) return 'concurrent-edit';
    // A non-cooperating writer still has a small compare-to-rename race; no file API provides CAS.
    fs.renameSync(temp, path); temp = undefined;
    if (fs.readFileSync(path, 'utf8') !== next) throw Error('settings read-back mismatch');
    return 'updated';
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (temp) fs.unlinkSync(temp);
    fs.rmdirSync(lock);
  }
}
