#!/usr/bin/env bun
import { evaluate } from './evaluate.js';

const HELP = `VOA saved-observation preview (Bun >=1.3.14)
Usage: bun voa.js [--mode status|recovery|cleanup] --input <saved.json>
  --mode   Defaults to read-only status. Recovery/cleanup require explicit scope evidence.
  --input  One saved schemaVersion:1 JSON file, at most 8 MiB.
  --help   Show flags and side effects.
Reads only the given file; writes JSON to stdout and errors to stderr.
No collection, network, sends, dispatch, scheduling, workflow selection, deletion or state.
Terms are pass/fail/unknown/n/a with evidence, never an aggregate authority verdict.
Exit: 0 complete report (including failed criteria), 1 invalid input, 2 incomplete/unknown.
See ../references/observations.md and ../references/recovery.md.
`;

export async function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(HELP); return 0; }
  let mode = 'status';
  let path;
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--mode', '--input'].includes(flag) || !value || value.startsWith('--') || seen.has(flag)) {
      throw Error('use --help; unknown, repeated or missing flag value');
    }
    seen.add(flag);
    if (flag === '--mode') mode = value;
    else path = value;
  }
  if (!path) throw Error('--input is required');
  const file = Bun.file(path);
  if (file.size > 8 * 1024 * 1024) throw Error('input exceeds 8 MiB');
  const result = evaluate(await file.json(), mode);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  const terms = [...result.coverage, ...result.owners.flatMap((owner) => owner.terms), ...(result.cleanup?.terms ?? [])];
  return terms.some((entry) => entry.state === 'unknown') ? 2 : 0;
}

if (import.meta.main) {
  try { process.exitCode = await main(Bun.argv.slice(2)); }
  catch (error) { process.stderr.write(`voa: ${error.message}\n`); process.exitCode = 1; }
}
