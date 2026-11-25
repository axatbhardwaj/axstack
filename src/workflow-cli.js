import { manageWorkflow } from './workflow-opt-in.js';

const HELP = `Usage:
  axstack workflow opt-in --name <workflow> --binding <private.json> --conformance <receipt.json> --yes
  axstack workflow remove --name <workflow> --version <version> --yes
  axstack workflow conformance --binding <private.json> --out <receipt.json>

Opt-in copies the one bundled definition to ~/.t3/workflows and records its
binding and bundle digests in ~/.t3/.axstack-workflows.json. It starts a load
probe on the running T3 server. Remove checks for active runs and deletes only
the selected unchanged definition and its ownership record. Drain or cancel
active runs in T3 first. These commands leave T3 settings untouched.

Conformance starts, restarts and stops a loopback T3 in a private scratch
directory. Its binding supplies separately approved disposable test resources.
It writes the verdict to --out, and removes its own scratch directory.`;

const options = {
  'opt-in': ['name', 'binding', 'conformance', 'yes'],
  remove: ['name', 'version', 'yes'],
  conformance: ['binding', 'out'],
};

export async function workflowCli(args, packageRoot) {
  const [action, ...rest] = args;
  if (!action || action === '--help' || rest.includes('--help')) {
    console.log(HELP);
    return;
  }
  if (!Object.hasOwn(options, action)) throw new Error('unknown workflow operation; see axstack workflow --help');
  const flags = {};
  while (rest.length) {
    const raw = rest.shift();
    const key = raw.slice(2);
    if (!raw.startsWith('--') || !options[action].includes(key) || Object.hasOwn(flags, key)) {
      throw new Error('invalid workflow option; see axstack workflow --help');
    }
    const value = key === 'yes' ? true : rest.shift();
    if (!value || (typeof value === 'string' && value.startsWith('--'))) throw new Error(`missing value for --${key}`);
    flags[key] = value;
  }
  const home = Bun.env.HOME;
  if (!home?.startsWith('/')) throw new Error('workflow command requires an absolute HOME');
  if (action === 'conformance') {
    const { runConformance } = await import('./workflow-conformance.js');
    await runConformance({ home, packageRoot, flags });
  } else {
    const result = await manageWorkflow({ action, flags, home, packageRoot });
    console.log(`${result.identity} ${result.action}`);
  }
}
