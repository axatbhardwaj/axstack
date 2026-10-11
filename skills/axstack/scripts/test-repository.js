#!/usr/bin/env bun
// Repository test entry point: keep DAC permission fixtures meaningful as root.
const args = process.argv.slice(2);
if (args[0] === '--help') {
  console.log(`Usage: bun skills/axstack/scripts/test-repository.js [bun test arguments]
Runs bun test in the current directory, forwarding arguments, environment and exit status.
Linux root requires setpriv and drops DAC override/read-search capabilities for tests.
Other users run Bun directly. Unsupported root hosts or missing setpriv exit 2.
Side effects: runs the selected tests and their fixtures; creates no runner-owned files.
Set TMPDIR to a fresh owned 0700 directory outside HOME before repository tests.`);
  process.exit(0);
}

let command = [process.execPath, 'test', ...args];
if (process.getuid?.() === 0) {
  const setpriv = process.platform === 'linux' ? Bun.which('setpriv') : null;
  if (!setpriv) {
    console.error('Repository permission tests as root require Linux and setpriv; use a non-root user otherwise.');
    process.exit(2);
  }
  command = [setpriv, '--bounding-set=-dac_override,-dac_read_search', '--', ...command];
}

try {
  const child = Bun.spawn(command, { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
  process.exit(await child.exited);
} catch (error) {
  console.error(`Repository test launch failed: ${error.message}`);
  process.exit(1);
}
