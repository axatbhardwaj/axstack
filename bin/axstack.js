#!/usr/bin/env node
// axstack — installation/setup CLI. Installs owned skill bundles, merges
// Paseo profiles, and checks host capabilities. Chat drives execution; this
// CLI performs installation bookkeeping only (no runtime, scheduler, or
// model calls).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { installBundle, uninstallBundle, validateBundle } from '../src/installer.js';
import { checkCapabilities } from '../src/capabilities.js';
import { harnessLocations } from '../src/locations.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, '..');

function packageVersion() {
  try {
    return JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

const HELP = `axstack — Axstack setup CLI (installation bookkeeping only)

Usage:
  axstack install --bundle <dir> --skills-dir <dir> [--profile <file>] [--harness <name>] [--force] [--yes]
  axstack check [--bundle <dir>]
  axstack uninstall --skills-dir <dir> [--profile <file>] [--force] [--yes]
  axstack --help | --version

Commands:
  install    Validate a skill bundle, then copy owned skills, merge Paseo
             profiles (config.daemon.agentProfiles) and record ownership hashes.
  check      Probe host tools (node, git, gh, gh stack extension, paseo) and
             report gaps. A binary probe cannot prove Linear MCP access or
             model quotas; skill prompts perform a session preflight.
  uninstall  Remove only unchanged Axstack-owned assets. User edits survive.

Flags:
  --bundle <dir>      Bundle root holding skills/axstack-*/SKILL.md and
                      profiles/paseo.json. Defaults to the package root.
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
  const wantsValue = new Set(['--bundle', '--skills-dir', '--profile', '--harness']);
  while (rest.length > 0) {
    const tok = rest.shift();
    if (wantsValue.has(tok)) {
      const val = rest.shift();
      if (val === undefined) throw new Error(`${tok} requires a value`);
      out.flags[tok.slice(2)] = val;
    } else if (tok === '--force') out.flags.force = true;
    else if (tok === '--yes') out.flags.yes = true;
    else if (tok === '--help' || tok === '-h') out.command = 'help';
    else throw new Error(`unknown argument: ${tok}`);
  }
  return out;
}

function expandHome(p) {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
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
  return expandHome(entry.skillsDir);
}

function realCheck(name) {
  if (name === 'node') {
    const major = Number(String(process.versions.node).split('.')[0]);
    return Promise.resolve({
      ok: Number.isInteger(major) && major >= 22,
      stdout: `v${process.versions.node}`,
    });
  }
  const cmds = {
    git: ['git', ['--version']],
    gh: ['gh', ['--version']],
    'gh-stack': ['gh', ['extension', 'list']],
    paseo: ['paseo', ['--version']],
  };
  const [cmd, args] = cmds[name];
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (name === 'gh-stack') {
      const ok = /stack/i.test(stdout);
      return Promise.resolve({ ok, stdout: ok ? stdout : 'gh extensions listed (stack not found)' });
    }
    return Promise.resolve({ ok: true, stdout });
  } catch {
    return Promise.resolve({ ok: false, stdout: 'not found' });
  }
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

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
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
        profilePath: flags.profile ? expandHome(flags.profile) : null,
        force: !!flags.force,
        yes: !!flags.yes,
        log: (m) => console.log(m),
      });
      const changed =
        summary.added.length + summary.updated.length + (summary.profiles?.added?.length ?? 0) +
        (summary.profiles?.updated?.length ?? 0);
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
      if (summary.profiles) {
        const p = summary.profiles;
        if (p.created) console.log('profile config created.');
        if (p.added?.length) console.log(`profiles added: ${p.added.join(', ')}`);
        if (p.updated?.length) console.log(`profiles updated: ${p.updated.join(', ')}`);
        if (p.preserved?.length) {
          console.log(`profiles preserved (user edits kept): ${p.preserved.join(', ')}`);
        }
      }
      return;
    }
    if (command === 'check') {
      const report = await checkCapabilities(realCheck);
      printCheckReport(report);
      if (flags.bundle) {
        const bundle = await validateBundle(resolve(flags.bundle));
        console.log(
          `bundle ok: ${bundle.files.length} skill files, ` +
            (bundle.bundleProfiles ? `${bundle.bundleProfiles.length} profiles` : 'no profiles'),
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
