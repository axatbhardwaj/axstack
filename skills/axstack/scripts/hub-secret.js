import * as fs from 'node:fs';

// Resolve only T3's masked usage-source field; never hydrate or persist the settings object.
export function managementKey(value, sourceId, settingsPath) {
  try {
    if (value === '••••••') {
      if (typeof settingsPath !== 'string' || !settingsPath.includes('/') || typeof sourceId !== 'string'
        || !sourceId || sourceId.length > 512 || Buffer.from(sourceId, 'utf8').toString('utf8') !== sourceId) throw Error();
      const directory = `${settingsPath.slice(0, settingsPath.lastIndexOf('/'))}/secrets`;
      const parent = fs.lstatSync(directory);
      if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid?.() || (parent.mode & 0o022)) throw Error();
      const path = `${directory}/usage-limit-source-${Buffer.from(sourceId, 'utf8').toString('base64url')}.bin`;
      const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        const info = fs.fstatSync(fd);
        if (!info.isFile() || info.uid !== process.getuid?.() || (info.mode & 0o077) || info.nlink !== 1
          || info.size < 1 || info.size > 4096) throw Error();
        value = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(fd));
      } finally { fs.closeSync(fd); }
    }
    // HTTP bearer keys must be bounded, unmasked printable ASCII without whitespace/control bytes.
    if (typeof value !== 'string' || !/^[!-~]{1,4096}$/.test(value)) throw Error();
    return value;
  } catch {
    throw Error('hub management key missing or unsafe');
  }
}
