const HELP = `Usage:
  axstack workflow opt-in --name <workflow> --binding <private.json> --conformance <receipt.json> --yes
  axstack workflow remove --name <workflow> --version <version> --yes
  axstack workflow conformance --binding <private.json> --out <receipt.json>
  axstack workflow health --input <observations.json|->
  axstack workflow observe --base-dir <base> --conformance <receipt.json> [--registry-token-file <file>]

Opt-in copies the one bundled definition to ~/.t3/workflows and records its
binding and bundle digests in ~/.t3/.axstack-workflows.json. It starts a load
probe on the running T3 server. Remove checks for active runs and deletes only
the selected unchanged definition and its ownership record. Drain or cancel
active runs in T3 first. These commands leave T3 settings untouched.

Conformance starts, restarts and stops a loopback T3 in a private scratch
directory. Its binding supplies separately approved disposable test resources.
It writes the verdict to --out, and removes its own scratch directory.

Health reads explicitly supplied fleet observations (use - for stdin).
It reports evidence to stdout without writing state or contacting T3.
Exit 0 for complete facts, 1 for input error, 2 for a hold or incomplete facts.

Observe reads the specified T3 base and conformance receipt, runs T3 list/show,
and exports selected SQLite rows in read-only mode. An optional existing
read-scoped token file enables loopback loader diagnostics. It returns a JSON
observation on stdout and represents unavailable evidence with missing fields.`;

const options = {
  'opt-in': ['name', 'binding', 'conformance', 'yes'],
  remove: ['name', 'version', 'yes'],
  conformance: ['binding', 'out'],
  health: ['input'],
  observe: ['base-dir', 'conformance', 'registry-token-file'],
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
  if (action === 'health') {
    const { runWorkflowHealth } = await import('../skills/axstack/workflows/health.mjs');
    await runWorkflowHealth(flags.input);
    return;
  }
  if (action === 'observe') {
    const { runWorkflowObservation } = await import('../skills/axstack/workflows/health-observe.mjs');
    await runWorkflowObservation(flags);
    return;
  }
  const home = Bun.env.HOME;
  if (!home?.startsWith('/')) throw new Error('workflow command requires an absolute HOME');
  if (action === 'conformance') {
    const { runConformance } = await import('./workflow-conformance.js');
    await runConformance({ home, packageRoot, flags });
  } else {
    const { manageWorkflow } = await import('./workflow-opt-in.js');
    const result = await manageWorkflow({ action, flags, home, packageRoot });
    console.log(`${result.identity} ${result.action}`);
  }
}
