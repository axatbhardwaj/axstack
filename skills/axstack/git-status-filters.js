// Git splits -c at the first '='. Only build overrides from validated driver names.
/** @param {string} keys NUL-delimited output from git config --null --name-only --list. */
export function gitStatusFilterOverrides(keys) {
  const drivers = new Set();
  for (const key of keys.split('\0')) {
    if (key.includes('=')) return null;
    if (!key.startsWith('filter.')) continue;
    const driver = /^filter\.([A-Za-z0-9_.-]+)\.(?:clean|process|smudge|required)$/.exec(key)?.[1];
    if (!driver) return null;
    drivers.add(driver);
  }
  return [...drivers].flatMap((driver) => [
    '-c', `filter.${driver}.clean=`, '-c', `filter.${driver}.process=`, '-c', `filter.${driver}.required=false`,
  ]);
}
