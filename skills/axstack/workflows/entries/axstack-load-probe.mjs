import { lstat, readFile } from 'node:fs/promises';
import { bindingMatches } from '../binding.mjs';

const name = 'axstack-load-probe';
const version = 1;
const workflow = name + '@' + version;

async function verifyBinding() {
  try {
    const manifest = JSON.parse(await readFile(new URL('../.axstack-workflows.json', import.meta.url), 'utf8'));
    const record = manifest.workflows[workflow];
    const info = await lstat(record.binding);
    if (!info.isFile() || (info.mode & 0o077) || info.uid !== process.getuid()) throw new Error();
    const bytes = await readFile(record.binding);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (bindingMatches(record.bindingDigest, digest)) return { workflow, binding: 'pass' };
  } catch {
    // A private file may be unavailable. Report the check without its contents or path.
  }
  throw new Error('Axstack workflow binding is missing, non-private, or its digest changed');
}

const result = Schema.Struct({ workflow: Schema.Literal(workflow), binding: Schema.Literal('pass') });

export default T3.workflow(name, {
  version, payload: Schema.Null, returns: result, resumeAfter: [],
}, () => T3.step('verify-binding', { returns: result }, Effect.tryPromise({
  try: verifyBinding,
  catch: () => new Error('Axstack workflow binding verification failed'),
})));
