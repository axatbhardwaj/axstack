import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { writeAtomic } from './installer.js';
import { dirname, join } from './posixpath.js';
import { CONFORMANCE_SUITE, t3Environment, workflowT3Version } from './workflow-t3.js';
import { missingResources, provision } from '../skills/axstack/workflows/conformance/provision.mjs';
import { usingIsolatedT3 } from '../skills/axstack/workflows/conformance/isolated.mjs';
import { runLocalCases } from '../skills/axstack/workflows/conformance/local.mjs';
import { runBoundCases } from '../skills/axstack/workflows/conformance/bound.mjs';

function privateConfig(path) {
  const info = lstatSync(path);
  if (path !== realpathSync(path) || !info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) ||
      info.size > 65_536) throw new Error('conformance binding must be a bounded private regular file');
  const binding = JSON.parse(readFileSync(path, 'utf8'));
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) throw new Error('conformance binding requires a JSON object');
  return binding;
}

export async function runConformance({ home, packageRoot, flags }) {
  const { binding: path, out } = flags;
  if (!path?.startsWith('/') || !out?.startsWith('/') || out === path) {
    throw new Error('conformance requires distinct absolute --binding and --out files');
  }
  const base = join(realpathSync(home), '.t3');
  if ([base, packageRoot].some((directory) => out.startsWith(directory + '/') || path.startsWith(directory + '/')) ||
      realpathSync(dirname(out)) !== dirname(out)) throw new Error('conformance binding and receipt must be outside the package and T3 base');
  const old = lstatSync(out, { throwIfNoEntry: false });
  if (old && (!old.isFile() || old.uid !== process.getuid() || (old.mode & 0o077))) {
    throw new Error('conformance output is not an owned private regular file');
  }
  const t3 = Bun.which('t3');
  if (!t3) throw new Error('t3 is required on PATH');
  const version = workflowT3Version(t3);
  const environment = t3Environment(base);
  const receipt = { version, environment, suite: CONFORMANCE_SUITE, status: 'unknown', details: {} };
  // Invalidate a previous pass before starting a rerun.
  await writeAtomic(out, JSON.stringify(receipt) + '\n', { mode: 0o600 });
  const binding = privateConfig(path);
  const missing = missingResources(binding);
  if (missing.length) {
    receipt.details = { missing };
  } else {
    try {
      receipt.details = await usingIsolatedT3({
        t3, beforeStart: (server, settings) => provision(server, settings, binding),
      }, async (server) => ({
        ...await runLocalCases(server),
        ...await runBoundCases(server, binding),
      }));
      const status = Object.values(receipt.details).map((term) => term.status);
      receipt.status = status.includes('fail') ? 'fail' : status.every((term) => term === 'pass') ? 'pass' : 'unknown';
    } catch {
      receipt.status = 'fail';
      receipt.details = { setup: 'conformance could not prepare or operate its isolated fixtures' };
    }
  }
  await writeAtomic(out, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  console.log(`conformance ${receipt.status} (T3 ${version})`);
  if (receipt.status !== 'pass') process.exitCode = 2;
}
