#!/usr/bin/env bun
// axstack — installation/setup CLI. Installs owned skill bundles and selected
// role data, configures Claude settings, and checks host capabilities. Chat
// CLI performs installation bookkeeping only (no runtime, scheduler, or
// model calls).
import { readFileSync } from 'node:fs';
import { join, resolve } from '../src/posixpath.js';
import {
  checkInstructionBinding,
  installBundle,
  uninstallBundle,
  validateBundle,
} from '../src/installer.js';
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
  axstack install --preset <mixed|codex-only|claude-only> --bundle <dir> --skills-dir <dir> [--instructions <file>] [--claude-settings <file>|--no-claude-settings] [--harness <name>] [--force] [--yes]
  axstack check [--bundle <dir>] [--instructions <file>] [--skills-dir <dir>|--harness <name>]
  axstack uninstall --skills-dir <dir> [--instructions <file>] [--claude-settings <file>|--no-claude-settings] [--harness <name>] [--force] [--yes]
  axstack --help | --version

Commands:
  install    Validate a skill bundle, then copy owned skills and selected role
             data and record ownership hashes.
  check      Probe Bun, Git, gh stack, and resolved Orca runtime/guide
             capabilities. Probes do not prove model or execution compatibility.
  uninstall  Remove only unchanged Axstack-owned assets. User edits survive.

Flags:
  --bundle <dir>      Bundle root holding skills/axstack-*/SKILL.md and
                      profiles/presets/*.json role data. Defaults to the package root.
  --preset <name>     Required routing preset: mixed, codex-only, or claude-only.
                      Aliases: codex = codex-only; claude = claude-only.
  --skills-dir <dir>  Explicit install target (required). Overrides --harness.
  --instructions <file>
                      Instruction file to receive the owned routing block.
                      Harness defaults: ~/.claude/CLAUDE.md for Claude and
                      $CODEX_HOME/AGENTS.md for Codex (default ~/.codex).
  --claude-settings <file>
                      Manage the Claude Code user settings file at this path.
                      This forces testable availability without installing Claude.
  --no-claude-settings
                      Skip Claude Code user-settings management.
  --harness <name>    Known harness (${harnessLocations().map((h) => h.harness).join(', ')}).
                      Grok has no verified auto-discovery: --skills-dir is required.
  --force             Overwrite/remove user-edited owned assets and take
                      ownership of unknown files. Off by default.
  --yes               Confirm writes inside your home directory. Temp dirs
                      outside home never need this.

Migration:
  --profile is obsolete. Axstack installs the selected preset as
  <skills-dir>/axstack/roles.json and never reads or writes Paseo config.

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
  const wantsValue = new Set([
    '--bundle', '--skills-dir', '--instructions', '--harness', '--preset', '--claude-settings',
  ]);
  while (rest.length > 0) {
    const tok = rest.shift();
    if (tok === '--profile') {
      throw new Error(
        '--profile is obsolete in the Orca-only installer; role data is installed as axstack/roles.json and legacy Paseo cleanup is separate',
      );
    }
    if (wantsValue.has(tok)) {
      const val = rest.shift();
      if (val === undefined || val.startsWith('--')) {
        throw new Error(`${tok} requires a value (got ${val ?? 'nothing'}); refusing`);
      }
      out.flags[tok.slice(2)] = val;
    } else if (tok === '--force') out.flags.force = true;
    else if (tok === '--yes') out.flags.yes = true;
    else if (tok === '--no-claude-settings') out.flags['no-claude-settings'] = true;
    else if (tok === '--help' || tok === '-h') out.command = 'help';
    else throw new Error(`unknown argument: ${tok}`);
  }
  return out;
}

function defaultClaudeSettingsPath() {
  if (Bun.env.CLAUDE_CONFIG_DIR) {
    return join(resolve(Bun.env.CLAUDE_CONFIG_DIR), 'settings.json');
  }
  const home = Bun.env.HOME;
  return home?.startsWith('/') ? join(home, '.claude', 'settings.json') : null;
}

function isInsideRawHome(path) {
  const home = Bun.env.HOME;
  if (!home?.startsWith('/') || !path) return false;
  const absoluteHome = resolve(home);
  const absolutePath = resolve(path);
  return absolutePath === absoluteHome || absolutePath.startsWith(`${absoluteHome}/`);
}

function resolveClaudeOption(flags, command) {
  if (flags['claude-settings'] && flags['no-claude-settings']) {
    throw new Error('--claude-settings and --no-claude-settings cannot be used together');
  }
  if (flags['no-claude-settings']) {
    return { available: false, settingsPath: null, skip: true, reason: 'disabled by --no-claude-settings' };
  }
  if (flags['claude-settings']) {
    return { available: true, settingsPath: expandHome(flags['claude-settings']), explicit: true };
  }

  const settingsPath = defaultClaudeSettingsPath();
  const available = Bun.which('claude') !== null;
  if (command === 'install' && available && !flags.yes && isInsideRawHome(settingsPath)) {
    return {
      available: false,
      settingsPath: null,
      reason: 'default settings path is inside HOME; re-run with --yes',
    };
  }
  return {
    available,
    settingsPath: available ? settingsPath : null,
    reason: available ? undefined : 'Claude Code is not available',
  };
}

function printClaudeSettings(report, { uninstall = false } = {}) {
  if (!report) return;
  if (report.status === 'skipped') {
    console.log(`claude settings: skipped — ${report.reason}`);
  } else if (!uninstall && report.status === 'set') {
    console.log(`claude settings: set env.CLAUDE_CODE_SUBAGENT_MODEL=opus in ${report.path}`);
  } else if (!uninstall && report.status === 'unchanged') {
    console.log('claude settings: unchanged (owned)');
  } else if (!uninstall && report.status === 'preserved') {
    console.log(`claude settings: preserved existing value ${JSON.stringify(report.value)} (not owned)`);
  } else if (uninstall && report.status === 'removed') {
    console.log(`claude settings: removed env.CLAUDE_CODE_SUBAGENT_MODEL from ${report.path}`);
  } else if (uninstall && report.status === 'retained') {
    console.log('claude settings: unchanged (owned by another skills install)');
  } else if (uninstall && report.status === 'preserved') {
    console.log(`claude settings: preserved edited value ${JSON.stringify(report.value)} (ownership released)`);
  } else if (uninstall && report.status === 'released') {
    console.log('claude settings: ownership released (bound settings file missing)');
  }
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

function resolveHarnessInstructions(harness) {
  if (harness === 'claude') return join(homeDir(), '.claude', 'CLAUDE.md');
  if (harness === 'codex') {
    const codexHome = Bun.env.CODEX_HOME
      ? expandHome(Bun.env.CODEX_HOME)
      : join(homeDir(), '.codex');
    return join(codexHome, 'AGENTS.md');
  }
  return null;
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
      const instructionsPath = flags.instructions
        ? expandHome(flags.instructions)
        : flags.harness
          ? resolveHarnessInstructions(flags.harness)
          : null;
      const summary = await installBundle({
        bundleDir: flags.bundle ? resolve(flags.bundle) : PACKAGE_ROOT,
        skillsDir,
        preset: flags.preset,
        instructionsPath,
        force: !!flags.force,
        yes: !!flags.yes,
        claude: resolveClaudeOption(flags, 'install'),
        log: (m) => { if (m !== 'plan complete') console.log(m); },
      });
      const changed =
        summary.added.length + summary.updated.length + summary.removed.length +
        (['created', 'updated'].includes(summary.instructions?.status) ? 1 : 0);
      if (changed === 0) {
        console.log('Install complete: no changes (idempotent, everything unchanged).');
      } else {
        if (summary.added.length) console.log(`added: ${summary.added.join(', ')}`);
        if (summary.updated.length) console.log(`updated: ${summary.updated.join(', ')}`);
        if (summary.removed.length) console.log(`removed: ${summary.removed.join(', ')}`);
        if (summary.unchanged.length) console.log(`unchanged: ${summary.unchanged.join(', ')}`);
      }
      if (summary.preserved.length) {
        console.log(`preserved user edits (use --force to overwrite): ${summary.preserved.join(', ')}`);
      }
      if (summary.stale.length) console.log(`stale owned files left on disk: ${summary.stale.join(', ')}`);
      if (summary.instructions) {
        const i = summary.instructions;
        if (i.status === 'conflict') {
          console.log(`instruction conflict: ${i.path} preserved (${i.reason})`);
        } else {
          console.log(`instruction ${i.status}: ${i.path}`);
        }
      }
      if (summary.notes?.length) {
        for (const note of summary.notes) console.log(`note: ${note}`);
      }
      if (summary.roles) {
        const p = summary.roles;
        console.log(
          p.ready
            ? `preset ${summary.preset}: ready`
            : `preset ${summary.preset}: NOT ready — ${p.gaps.join('; ')}`,
        );
        if (!p.ready) process.exitCode = 1;
      } else {
        console.log('role data was not installed; readiness is unverified.');
      }
      printClaudeSettings(summary.claudeSettings);
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
            (presetNames.length > 0 ? `role presets ${presetNames.join(', ')}` : 'no role presets'),
        );
      }
      if (flags.instructions || flags.harness) {
        let skillsDir = flags['skills-dir'] ? expandHome(flags['skills-dir']) : null;
        if (!skillsDir && flags.harness) skillsDir = resolveHarnessTarget(flags.harness);
        const instructionsPath = flags.instructions
          ? expandHome(flags.instructions)
          : resolveHarnessInstructions(flags.harness);
        const instruction = await checkInstructionBinding({ skillsDir, instructionsPath });
        console.log(
          `instruction ${instruction.status}: ${instruction.path}` +
            (instruction.reason ? ` (${instruction.reason})` : ''),
        );
        if (instruction.status !== 'owned') process.exitCode = 1;
      }
      if (report.gaps.length > 0) process.exitCode = 1;
      return;
    }
    if (command === 'uninstall') {
      let skillsDir = flags['skills-dir'] ? expandHome(flags['skills-dir']) : null;
      if (!skillsDir && flags.harness) skillsDir = resolveHarnessTarget(flags.harness);
      const instructionsPath = flags.instructions
        ? expandHome(flags.instructions)
        : flags.harness
          ? resolveHarnessInstructions(flags.harness)
          : null;
      const summary = await uninstallBundle({
        skillsDir,
        instructionsPath,
        force: !!flags.force,
        yes: !!flags.yes,
        claude: resolveClaudeOption(flags, 'uninstall'),
        log: (m) => console.log(m),
      });
      if (summary.note) console.log(summary.note);
      if (summary.removed.length) console.log(`removed: ${summary.removed.join(', ')}`);
      if (summary.preserved.length) {
        console.log(`preserved user edits (use --force to remove): ${summary.preserved.join(', ')}`);
      }
      if (summary.instructions) {
        const i = summary.instructions;
        if (i.status === 'conflict' || i.status === 'preserved') {
          console.log(`instruction ${i.status}: ${i.path} preserved (${i.reason})`);
        } else {
          console.log(`instruction ${i.status}: ${i.path}`);
        }
      }
      printClaudeSettings(summary.claudeSettings, { uninstall: true });
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
