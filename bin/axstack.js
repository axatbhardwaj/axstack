#!/usr/bin/env bun
// axstack — installation/setup CLI. Installs owned skill bundles, merges
// Paseo profiles, and checks host capabilities. Chat drives execution; this
// CLI performs installation bookkeeping only (no runtime, scheduler, or
// model calls).
import { readFileSync } from 'node:fs';
import { join, resolve } from '../src/posixpath.js';
import { installBundle, uninstallBundle, validateBundle } from '../src/installer.js';
import { BUN_FLOOR, checkCapabilities, meetsFloor, runRealCheck } from '../src/capabilities.js';
import { harnessLocations } from '../src/locations.js';

// import.meta.dir is already a filesystem path (no URL conversion, so
// spaces/percent/hash characters survive verbatim).
const HERE = import.meta.dir;
const PACKAGE_ROOT = resolve(HERE, '..');

function homeDir() {
  // Tilde expansion needs a known absolute home; with HOME missing, empty,
  // or relative the destination is unknown, so refuse even with --yes.
  const home = Bun.env.HOME;
  if (!home || !home.startsWith('/')) {
    throw new Error('HOME is missing, empty, or not absolute; pass explicit paths instead of ~');
  }
  return home;
}

function packageVersion() {
  try {
    return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

const HELP = `axstack — Axstack setup CLI (installation bookkeeping only)

Usage:
  axstack install --preset <mixed|codex-only|claude-only> --bundle <dir> --skills-dir <dir> [--profile <file>] [--harness <name>] [--force] [--yes]
  axstack check [--bundle <dir>]
  axstack uninstall --skills-dir <dir> [--profile <file>] [--force] [--yes]
  axstack --help | --version

Commands:
  install    Validate a skill bundle, then copy owned skills, merge Paseo
             profiles (config.daemon.agentProfiles) and record ownership hashes.
  check      Probe host tools (bun, git, gh, gh stack extension, paseo) and
             report gaps. A binary probe cannot prove Linear MCP access or
             model quotas; skill prompts perform a session preflight.
  uninstall  Remove only unchanged Axstack-owned assets. User edits survive.

Flags:
  --bundle <dir>      Bundle root holding skills/axstack-*/SKILL.md and
                      profiles/presets/*.json. Defaults to the package root.
  --preset <name>     Required routing preset: mixed, codex-only, or claude-only.
                      Aliases: codex = codex-only; claude = claude-only.
  --skills-dir <dir>  Explicit install target (required). Overrides --harness.
  --profile <file>    Paseo host config file to merge profiles into.
  --harness <name>    Known harness (${harnessLocations().map((h) => h.harness).join(', ')}).
                      Grok has no verified auto-discovery: --skills-dir is required.
  --force             Overwrite/remove user-edited owned assets and take
                      ownership of unknown files. Off by default.
  --yes               Confirm writes inside your home directory. Temp dirs
                      outside home never need this.

Safety:
  Bundles with symlinks, absolute paths or '..' escapes are rejected before
  any write. Unknown pre-existing files are never silently overwritten.
  Partial failures roll back files created in that run.
`;

function parseArgs(argv) {
  const out = { command: null, flags: {} };
  const rest = [...argv];
  if (rest.length === 0 || rest[0] === '--help' || rest[0] === '-h') {
    out.command = 'help';
    return out;
  }
  if (rest[0] === '--version' || rest[0] === '-V') {
    out.command = 'version';
    return out;
  }
  out.command = rest.shift();
  const wantsValue = new Set(['--bundle', '--skills-dir', '--profile', '--harness', '--preset']);
  while (rest.length > 0) {
    const tok = rest.shift();
    if (wantsValue.has(tok)) {
      const val = rest.shift();
      if (val === undefined || val.startsWith('--')) {
        throw new Error(`${tok} requires a value (got ${val ?? 'nothing'}); refusing`);
      }
      out.flags[tok.slice(2)] = val;
    } else if (tok === '--force') out.flags.force = true;
    else if (tok === '--yes') out.flags.yes = true;
    else if (tok === '--help' || tok === '-h') out.command = 'help';
    else throw new Error(`unknown argument: ${tok}`);
  }
  return out;
}

function expandHome(p) {
  if (p === '~') return homeDir();
  if (p.startsWith('~/')) return join(homeDir(), p.slice(2));
  return p;
}

function resolveHarnessTarget(harness) {
  const table = harnessLocations();
  const entry = table.find((h) => h.harness === harness);
  if (!entry) throw new Error(`unknown harness: ${harness} (known: ${table.map((h) => h.harness).join(', ')})`);
  if (entry.discovery === 'unverified') {
    throw new Error(
      `harness '${harness}' has no verified auto-discovery; pass an explicit --skills-dir override`,
    );
  }
  if (entry.harness === 'codex') {
    // User skills live under $CODEX_HOME/skills; CODEX_HOME defaults to ~/.codex.
    const home = Bun.env.CODEX_HOME ? expandHome(Bun.env.CODEX_HOME) : join(homeDir(), '.codex');
    return join(home, 'skills');
  }
  return expandHome(entry.skillsDir);
}

function printCheckReport(report) {
  console.log('Capability check:');
  for (const c of report.checks) {
    console.log(`  [${c.ok ? 'ok' : 'MISSING'}] ${c.label}: ${c.detail}`);
  }
  if (report.gaps.length > 0) {
    console.log('Gaps detected:');
    for (const g of report.gaps) console.log(`  - ${g}`);
  } else {
    console.log('No gaps detected.');
  }
  console.log('Probe limits:');
  for (const line of report.limitations) console.log(`  - ${line}`);
}

function checkRuntimeFloor() {
  if (!meetsFloor(Bun.version, BUN_FLOOR)) {
    console.error(`axstack: requires Bun >= ${BUN_FLOOR} (running ${Bun.version})`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

async function main() {
  if (!checkRuntimeFloor()) return;
  let parsed;
  try {
    parsed = parseArgs(Bun.argv.slice(2));
  } catch (err) {
    console.error(`axstack: ${err.message}`);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }
  const { command, flags } = parsed;

  if (command === 'help') {
    console.log(HELP);
    return;
  }
  if (command === 'version') {
    console.log(`axstack ${packageVersion()}`);
    return;
  }

  try {
    if (command === 'install') {
      let skillsDir = flags['skills-dir'] ? expandHome(flags['skills-dir']) : null;
      if (!skillsDir && flags.harness) skillsDir = resolveHarnessTarget(flags.harness);
      const summary = await installBundle({
        bundleDir: flags.bundle ? resolve(flags.bundle) : PACKAGE_ROOT,
        skillsDir,
        preset: flags.preset,
        profilePath: flags.profile ? expandHome(flags.profile) : null,
        force: !!flags.force,
        yes: !!flags.yes,
        log: (m) => console.log(m),
      });
      const changed =
        summary.added.length + summary.updated.length + (summary.profiles?.added?.length ?? 0) +
        (summary.profiles?.updated?.length ?? 0) + (summary.profiles?.removed?.length ?? 0) +
        (summary.profiles?.released?.length ?? 0) + (summary.profiles?.migrated?.length ?? 0);
      if (changed === 0) {
        console.log('Install complete: no changes (idempotent, everything unchanged).');
      } else {
        if (summary.added.length) console.log(`added: ${summary.added.join(', ')}`);
        if (summary.updated.length) console.log(`updated: ${summary.updated.join(', ')}`);
        if (summary.unchanged.length) console.log(`unchanged: ${summary.unchanged.join(', ')}`);
      }
      if (summary.preserved.length) {
        console.log(`preserved user edits (use --force to overwrite): ${summary.preserved.join(', ')}`);
      }
      if (summary.stale.length) console.log(`stale owned files left on disk: ${summary.stale.join(', ')}`);
      if (summary.notes?.length) {
        for (const note of summary.notes) console.log(`note: ${note}`);
      }
      if (summary.profiles) {
        const p = summary.profiles;
        if (p.created) console.log('profile config created.');
        if (p.added?.length) console.log(`profiles added: ${p.added.join(', ')}`);
        if (p.updated?.length) console.log(`profiles updated: ${p.updated.join(', ')}`);
        if (p.preserved?.length) {
          console.log(`profiles preserved (user edits kept): ${p.preserved.join(', ')}`);
        }
        if (p.deferred?.length) {
          console.log(
            `profiles deferred until setup selects a model: ${p.deferred.join(', ')}`,
          );
        }
        if (p.removed?.length) {
          console.log(`obsolete owned profile placeholders removed: ${p.removed.join(', ')}`);
        }
        if (p.released?.length) {
          console.log(`missing deferred profile ownership released: ${p.released.join(', ')}`);
        }
        if (p.migrated?.length) {
          console.log(`legacy reviewer profiles migrated: ${p.migrated.join(', ')}`);
        }
        if (p.legacyGaps?.length) {
          console.log(`legacy gap (preserved): ${p.legacyGaps.join(', ')}`);
        }
        console.log(
          p.ready
            ? `preset ${summary.preset}: ready`
            : `preset ${summary.preset}: NOT ready — ${p.gaps.join('; ')}`,
        );
        if (p.deviations?.length) {
          console.log(`profile deviations: ${p.deviations.join('; ')}`);
        }
        if (!p.ready) process.exitCode = 1;
      } else {
        console.log('profiles were not installed; readiness is unverified.');
      }
      return;
    }
    if (command === 'check') {
      const report = await checkCapabilities(runRealCheck);
      printCheckReport(report);
      if (flags.bundle) {
        const bundle = await validateBundle(resolve(flags.bundle));
        const presetNames = Object.keys(bundle.presets);
        console.log(
          `bundle ok: ${bundle.files.length} skill files, ` +
            (presetNames.length > 0 ? `presets ${presetNames.join(', ')}` : 'no presets'),
        );
      }
      if (report.gaps.length > 0) process.exitCode = 1;
      return;
    }
    if (command === 'uninstall') {
      const summary = await uninstallBundle({
        skillsDir: flags['skills-dir'] ? expandHome(flags['skills-dir']) : null,
        profilePath: flags.profile ? expandHome(flags.profile) : null,
        force: !!flags.force,
        yes: !!flags.yes,
        log: (m) => console.log(m),
      });
      if (summary.note) console.log(summary.note);
      if (summary.removed.length) console.log(`removed: ${summary.removed.join(', ')}`);
      if (summary.preserved.length) {
        console.log(`preserved user edits (use --force to remove): ${summary.preserved.join(', ')}`);
      }
      if (summary.profiles) {
        if (summary.profiles.removed.length) {
          console.log(`profiles removed: ${summary.profiles.removed.join(', ')}`);
        }
        if (summary.profiles.preserved.length) {
          console.log(`profiles preserved: ${summary.profiles.preserved.join(', ')}`);
        }
      }
      return;
    }
    console.error(`axstack: unknown command: ${command}`);
    console.error(HELP);
    process.exitCode = 1;
  } catch (err) {
    console.error(`axstack: ${err.message}`);
    process.exitCode = 1;
  }
}

await main();
