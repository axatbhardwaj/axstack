// Safe install/uninstall bookkeeping for the Axstack skill bundle.
//
// Frozen bundle contract (from the workflow author):
//   <bundle>/skills/axstack-*/SKILL.md (+ supporting files, no symlinks)
//   <bundle>/profiles/presets/<preset>.json ({ version: 1, roles: [...] })
//
// Safety rules:
// - Validate the whole bundle BEFORE any target mutation.
// - Reject symlinks, absolute paths and `..` escapes in bundle entries.
// - Never overwrite unknown pre-existing files or blindly remove
//   directories without explicit --force.
// - Track every installed byte in an ownership manifest (sha256); updates
//   and uninstalls only touch unchanged owned assets. User edits are
//   preserved and reported; pristine owned assets follow bundle upgrades
//   without --force.
// - Partial failures roll back files created in that run and never write
//   the manifest, so a retry starts from a known state.
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
} from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from './posixpath.js';
import {
  MANIFEST_VERSION,
  assertSafeRel,
  hashContent,
  readManifest,
  writeFileExclusive,
  writeManifest,
} from './manifest.js';
import { planInstallClaudeSettings, planUninstallClaudeSettings } from './claude-settings.js';
import {
  applyInstructionPlan,
  findLegacyRoutingLines,
  locateInstructionBlock,
  planInstruction,
  renderInstructionBlock,
  stripInstructionBlock,
} from './instructions.js';
import {
  assertBundleRoles,
  assessInstalledRoleSnapshot,
  assessRoleReadiness,
  installedRoleBytes,
} from './roles.js';

export const PRESET_ALIASES = Object.freeze({
  mixed: 'mixed',
  codex: 'codex-only',
  'codex-only': 'codex-only',
  claude: 'claude-only',
  'claude-only': 'claude-only',
});
export const PRESET_CHOICES = Object.freeze(['mixed', 'codex-only', 'claude-only']);

export function normalizePreset(preset) {
  const normalized = PRESET_ALIASES[preset];
  if (!normalized) {
    throw new Error(
      `install requires --preset <${PRESET_CHOICES.join('|')}> ` +
        `(aliases: codex, claude); got ${preset ?? 'nothing'}`,
    );
  }
  return normalized;
}

function withinRoot(target, root) {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// Canonicalize a target directory through the nearest existing ancestor.
// A symlinked target root itself is resolved (not refused); symlinks BELOW
// the root are refused separately so bundle payloads can never escape.
async function canonicalTargetDir(dir) {
  let cur = resolve(dir);
  const tail = [];
  for (;;) {
    try {
      return join(await realpath(cur), ...tail);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
      const parent = dirname(cur);
      if (parent === cur) throw new Error(`cannot resolve target directory: ${dir}`);
      tail.unshift(basename(cur));
      cur = parent;
    }
  }
}

// Refuse symlinks in every existing component from root (exclusive) down to
// destDir (inclusive). Called before any mutation so install and uninstall
// never write, read-for-delete, or remove through an escape link.
async function assertNoSymlinksBelow(root, destDir) {
  const rel = relative(root, destDir);
  if (rel === '') return;
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`unsafe target: ${destDir} escapes ${root}; refusing`);
  }
  let cur = root;
  for (const part of rel.split('/')) {
    cur = join(cur, part);
    let st = null;
    try {
      st = await lstat(cur);
    } catch (err) {
      if (err?.code === 'ENOENT') return; // nothing below can exist either
      throw err;
    }
    if (st.isSymbolicLink()) {
      throw new Error(`unsafe target: symlink in install path at ${cur}; refusing`);
    }
  }
}

// Shared ownership guard: resolve a manifest-owned rel to its destination,
// refuse escapes and symlinks, and read current bytes (null when missing)
// plus the existing mode. Read-only, so callers run it for every entry
// before mutating anything.
async function readOwnedTarget(skillsRoot, rel) {
  const dest = join(skillsRoot, rel);
  if (!withinRoot(dest, skillsRoot)) {
    throw new Error(`unsafe target: ${rel} escapes ${skillsRoot}; refusing`);
  }
  await assertNoSymlinksBelow(skillsRoot, dirname(dest));
  const destStat = await lstat(dest).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (destStat?.isSymbolicLink()) {
    throw new Error(`unsafe target: destination is a symlink at ${dest}; refusing`);
  }
  let current = null;
  try {
    current = await readFile(dest);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  let mode = null;
  if (current !== null) {
    try {
      mode = (await stat(dest)).mode & 0o777;
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }
  return { dest, current, mode };
}

async function canonicalInstructionFile(instructionsPath) {
  const abs = resolve(instructionsPath);
  const parent = await canonicalTargetDir(dirname(abs));
  const file = join(parent, basename(abs));
  const st = await lstat(file).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (st?.isSymbolicLink()) {
    throw new Error(`unsafe target: instruction path is a symlink at ${file}; refusing`);
  }
  return file;
}

function homeDir() {
  // Bun has no homedir() API; $HOME is the POSIX source of truth. A missing,
  // empty, or non-absolute HOME yields null so callers fail closed instead
  // of guessing (no passwd/FFI layer). A resolvable HOME is canonicalized
  // (realpath) so symlink aliases (/var -> /private/var on macOS, or any
  // aliased HOME) compare equal to canonicalized targets; an unresolvable
  // HOME also yields null and fails closed rather than bypassing the guard.
  const home = Bun.env.HOME;
  if (!home || !home.startsWith('/')) return null;
  try {
    return realpathSync(home);
  } catch {
    return null;
  }
}

export function assertOutsideHome(target, { yes = false, kind = 'target' } = {}) {
  const home = homeDir();
  if (home === null) {
    // Home boundary cannot be checked: treat every target as potentially
    // inside home and require explicit confirmation.
    if (!yes) {
      throw new Error(
        `refusing to touch ${kind} (${target}) without explicit confirmation: HOME is missing, empty, or not absolute, so the home boundary cannot be checked; re-run with --yes`,
      );
    }
    return;
  }
  if (home && (target === home || withinRoot(target, home)) && !yes) {
    throw new Error(
      `refusing to touch ${kind} inside your home (${target}) without explicit confirmation; re-run with --yes`,
    );
  }
}

// Validate the bundle directory and return its payload. Throws before any
// target mutation on any problem.
export async function validateBundle(bundleDir, selectedPreset = null) {
  const root = resolve(bundleDir);
  let rootStat;
  try {
    rootStat = await lstat(root);
  } catch {
    throw new Error(`bundle not found: ${root}`);
  }
  if (rootStat.isSymbolicLink()) {
    throw new Error('bundle path is a symlink; pass the real bundle directory');
  }
  if (!rootStat.isDirectory()) throw new Error(`bundle is not a directory: ${root}`);

  const skillsRoot = join(root, 'skills');
  const skillsStat = await lstat(skillsRoot).catch((err) => {
    if (err?.code === 'ENOENT') throw new Error(`bundle has no skills/ directory: ${skillsRoot}`);
    throw err;
  });
  if (skillsStat.isSymbolicLink() || !skillsStat.isDirectory()) {
    throw new Error('bundle skills/ must be a real directory, not a symlink');
  }
  let entries = await readdir(skillsRoot, { withFileTypes: true });
  // Symlinked (or non-directory) top-level skill entries must be rejected,
  // not silently skipped: Dirent.isDirectory() is false for symlinks.
  for (const entry of entries) {
    if (!entry.name.startsWith('axstack')) continue;
    const entryStat = await lstat(join(skillsRoot, entry.name));
    if (entryStat.isSymbolicLink() || !entryStat.isDirectory()) {
      throw new Error(
        `unsafe bundle: skill entry ${entry.name} must be a real directory, not a symlink`,
      );
    }
  }
  const skillDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('axstack'));
  if (skillDirs.length === 0) {
    throw new Error('bundle contains no axstack-* skill directories under skills/');
  }

  const files = [];
  for (const dir of skillDirs) {
    if (dir.name !== 'axstack') {
      const skillMark = join(skillsRoot, dir.name, 'SKILL.md');
      try {
        const s = await stat(skillMark);
        if (!s.isFile()) throw new Error();
      } catch {
        throw new Error(`skill ${dir.name} is missing SKILL.md`);
      }
    }
    await walkSkills(join(skillsRoot, dir.name), skillsRoot, files);
  }
  if (files.length === 0) throw new Error('bundle contains no installable skill files');

  const presets = {};
  const profilesRoot = join(root, 'profiles');
  const profilesStat = await lstat(profilesRoot).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (profilesStat !== null && (profilesStat.isSymbolicLink() || !profilesStat.isDirectory())) {
    throw new Error('bundle profiles must be a real directory, not a symlink');
  }
  const presetsRoot = join(profilesRoot, 'presets');
  const presetsStat = profilesStat === null ? null : await lstat(presetsRoot).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (presetsStat !== null) {
    if (presetsStat.isSymbolicLink() || !presetsStat.isDirectory()) {
      throw new Error('bundle profiles/presets must be a real directory, not a symlink');
    }
    const entries = (await readdir(presetsRoot, { withFileTypes: true }))
      .filter((entry) => entry.name.endsWith('.json'))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const presetPath = join(presetsRoot, entry.name);
      const presetStat = await lstat(presetPath);
      if (presetStat.isSymbolicLink() || !presetStat.isFile()) {
        throw new Error(`bundle preset ${entry.name} must be a real file, not a symlink`);
      }
      let parsed;
      try {
        parsed = JSON.parse(await readFile(presetPath, 'utf8'));
      } catch {
        throw new Error(`bundle preset ${entry.name} is not valid JSON`);
      }
      const stem = entry.name.slice(0, -'.json'.length);
      if (parsed?.version !== 1) {
        throw new Error(`bundle preset ${entry.name} must declare version 1`);
      }
      if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
        throw new Error(`bundle preset ${entry.name} must define a non-empty roles array`);
      }
      const keys = Object.keys(parsed).sort();
      if (JSON.stringify(keys) !== JSON.stringify(['roles', 'version'])) {
        throw new Error(`bundle preset ${entry.name} must contain exactly version and roles`);
      }
      assertBundleRoles(parsed.roles);
      presets[stem] = parsed.roles;
    }

    const idSets = Object.entries(presets).map(([name, roles]) => [
      name,
      roles.map((role) => role.id).sort(),
    ]);
    const [reference] = idSets;
    for (const [name, ids] of idSets.slice(1)) {
      if (JSON.stringify(ids) !== JSON.stringify(reference[1])) {
        throw new Error(
          `bundle presets must expose an identical role ID set; ${reference[0]} and ${name} differ`,
        );
      }
    }
    if (selectedPreset && !(selectedPreset in presets)) {
      throw new Error(`selected preset ${selectedPreset} not found in bundle profiles/presets`);
    }
  }

  const bundleRoles = selectedPreset ? (presets[selectedPreset] ?? null) : null;
  if (bundleRoles) {
    if (files.some((file) => file.rel === 'axstack/roles.json')) {
      throw new Error('bundle skills must not provide axstack/roles.json; it is generated from the selected preset');
    }
    files.push({ rel: 'axstack/roles.json', content: installedRoleBytes(selectedPreset, bundleRoles) });
    files.sort((a, b) => a.rel.localeCompare(b.rel));
  }

  return {
    root,
    skillsRoot,
    files,
    presets,
    selectedPreset,
    bundleRoles,
    readiness: bundleRoles ? assessRoleReadiness(bundleRoles, selectedPreset) : null,
  };
}

async function walkSkills(dir, skillsRoot, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  // Deterministic order for stable reports.
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const lst = await lstat(abs);
    if (lst.isSymbolicLink()) {
      throw new Error(`unsafe bundle: symlink rejected at ${relative(skillsRoot, abs)}`);
    }
    if (lst.isDirectory()) {
      await walkSkills(abs, skillsRoot, out);
    } else if (lst.isFile()) {
      const rel = relative(skillsRoot, abs);
      assertSafeRel(rel);
      out.push({ rel, abs });
    }
  }
}

// Atomic file replace with a pid-namespaced temp file. Temp creation is
// exclusive and restrictive (0600): pre-existing temp entries are refused,
// never followed or truncated. After the rename, existing permissions are
// preserved; new files take an explicit `mode` (e.g. 0600 for configs) or
// the umask default. Guards pre-existing entries, not active races.
export async function writeAtomic(dest, bytes, { mode } = {}) {
  await mkdir(dirname(dest), { recursive: true });
  let existingMode = null;
  try {
    existingMode = (await stat(dest)).mode & 0o777;
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  const tmp = `${dest}.tmp-${process.pid}`;
  await writeFileExclusive(tmp, bytes);
  try {
    await rename(tmp, dest);
  } catch (err) {
    try {
      await rm(tmp); // only unlink: this run created it exclusively
    } catch {
      // best effort cleanup of a temp file this run created
    }
    throw err;
  }
  const finalMode = mode ?? existingMode ?? (0o666 & ~process.umask());
  try {
    await chmod(dest, finalMode);
  } catch (err) {
    throw new Error(`wrote ${dest} but could not set permissions: ${err.message}`);
  }
}

export async function checkInstructionBinding({ skillsDir, instructionsPath } = {}) {
  if (!skillsDir) throw new Error('instruction check requires --skills-dir <dir> or --harness <name>');
  if (!instructionsPath) throw new Error('instruction check requires --instructions <file> or a supported harness');
  const skillsRoot = await canonicalTargetDir(resolve(skillsDir));
  const instructionsFile = await canonicalInstructionFile(instructionsPath);
  const manifest = await readManifest(skillsRoot);
  const binding = manifest?.instructions ?? { path: null, hash: null };
  if (binding.path !== null && binding.path !== instructionsFile) {
    return {
      status: 'conflict',
      path: instructionsFile,
      reason: `manifest is bound to ${binding.path}`,
    };
  }
  const text = await readFile(instructionsFile, 'utf8').catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (text === null) return { status: 'missing', path: instructionsFile };
  const located = locateInstructionBlock(text);
  if (!located) {
    return { status: 'missing', path: instructionsFile, reason: 'Axstack marker block is absent' };
  }
  if (binding.path === null) {
    return { status: 'unowned', path: instructionsFile, reason: 'marker block is not manifest-owned' };
  }
  if (hashContent(located.block) !== binding.hash) {
    return { status: 'conflict', path: instructionsFile, reason: 'owned marker block was edited' };
  }
  return { status: 'owned', path: instructionsFile };
}

async function assertFileSnapshot(dest, expected) {
  let current = null;
  try {
    current = await readFile(dest, 'utf8');
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  if (current !== expected) {
    throw new Error(`refusing: ${dest} changed since planning`);
  }
}

export async function installBundle({
  bundleDir,
  skillsDir,
  preset,
  instructionsPath = null,
  force = false,
  yes = false,
  claude = null,
  log = () => {},
} = {}) {
  const selectedPreset = normalizePreset(preset);
  if (!bundleDir) throw new Error('install requires --bundle <dir>');
  if (!skillsDir) throw new Error('install requires --skills-dir <dir> (explicit target directories only)');

  // Phase 0: validate everything before mutating anything.
  const bundle = await validateBundle(bundleDir, selectedPreset);
  const skillsRoot = await canonicalTargetDir(resolve(skillsDir));
  const instructionsFile = instructionsPath
    ? await canonicalInstructionFile(instructionsPath)
    : null;
  assertOutsideHome(skillsRoot, { yes, kind: 'skills directory' });
  if (instructionsFile) assertOutsideHome(instructionsFile, { yes, kind: 'instruction file' });
  const claudePlan = await planInstallClaudeSettings({ claude, skillsRoot });
  if (claudePlan.report.path) {
    assertOutsideHome(claudePlan.report.path, { yes, kind: 'Claude settings file' });
  }

  const prevManifest = (await readManifest(skillsRoot)) ?? {
    version: MANIFEST_VERSION,
    files: {},
    profiles: { path: null, preset: null, entries: {} },
    claudeSettings: { path: null },
    instructions: { path: null, hash: null },
  };
  const boundClaudeSettingsPath = prevManifest.claudeSettings?.path ?? null;
  if (
    claudePlan.settingsPath && boundClaudeSettingsPath &&
    claudePlan.settingsPath !== boundClaudeSettingsPath
  ) {
    throw new Error(
      `Claude settings ownership is bound to ${boundClaudeSettingsPath}; ` +
        `refusing target ${claudePlan.settingsPath}`,
    );
  }
  const ownedFiles = prevManifest.files ?? {};
  const legacyProfiles = prevManifest.profiles;
  const legacyProfileNote = Object.keys(legacyProfiles?.entries ?? {}).length > 0
    ? 'legacy Paseo profile provenance retained inert; see legacy cleanup guidance in docs/installation.md'
    : null;

  const boundInstructions = prevManifest.instructions ?? { path: null, hash: null };
  let existingInstructionsRaw = null;
  let instructionPlan = null;
  let legacyInstructionNote = null;
  if (instructionsFile) {
    if (boundInstructions.path !== null && boundInstructions.path !== instructionsFile) {
      throw new Error(
        `refusing: owned instruction block is bound to a different file (${boundInstructions.path}); ` +
          `uninstall with --instructions ${boundInstructions.path} first`,
      );
    }
    try {
      existingInstructionsRaw = await readFile(instructionsFile, 'utf8');
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    instructionPlan = planInstruction({
      text: existingInstructionsRaw,
      block: renderInstructionBlock(),
      ownership: boundInstructions.path === instructionsFile ? boundInstructions : null,
      force,
    });
    if (findLegacyRoutingLines(existingInstructionsRaw ?? '').length > 0) {
      legacyInstructionNote =
        'legacy Haoshoku routing text remains outside the Axstack block; preserved for manual migration';
    }
  }

  // Phase 1: pre-scan unknown pre-existing files so conflicts fail pre-write.
  // Destination ancestry is checked for symlink escapes here, before mutation.
  // The stale plan below is computed in the same read-only pass: every stale
  // manifest entry resolves its destination, current bytes, and pristine
  // flag through the same guard before Phase 2 mutates anything.
  const desired = [];
  for (const { rel, abs, content: inlineContent } of bundle.files) {
    const { dest, current, mode } = await readOwnedTarget(skillsRoot, rel);
    const content = inlineContent ?? await readFile(abs);
    desired.push({ rel, dest, content, current, mode });
    if (
      current !== null &&
      hashContent(current) !== hashContent(content) &&
      !(rel in ownedFiles) &&
      !force
    ) {
      throw new Error(
        `unknown pre-existing file would be overwritten: ${rel}; re-run with --force to take ownership`,
      );
    }
  }

  const bundleRels = new Set(bundle.files.map((file) => file.rel));
  const stalePlan = [];
  for (const rel of Object.keys(ownedFiles)) {
    if (bundleRels.has(rel)) continue;
    const { dest, current, mode } = await readOwnedTarget(skillsRoot, rel);
    stalePlan.push({
      rel,
      dest,
      current,
      mode,
      pristine: current !== null && hashContent(current) === ownedFiles[rel],
    });
  }

  // Phase 2: write files. Existing overwritten bytes are backed up in memory
  // and restored on any later failure (skill write, settings write, manifest
  // write), so a failed run leaves pre-run state behind and the untouched
  // manifest still describes it: a retry converges.
  const created = [];
  const backups = new Map();
  const backupExisting = (dest, current, mode) => {
    // Capture bytes and mode together: rollback restores through writeAtomic,
    // which falls back to the umask default when the destination no longer
    // exists (as after a stale deletion), so the mode must be explicit.
    if (current !== null && !backups.has(dest)) backups.set(dest, { bytes: current, mode });
  };
  const summary = { added: [], updated: [], unchanged: [], preserved: [], stale: [], removed: [] };
  const installedHashes = {};
  const claudeWritten = [];
  let instructionWritten = false;
  log('plan complete');
  try {
    if (instructionsFile) {
      await assertFileSnapshot(instructionsFile, existingInstructionsRaw);
    }
    await mkdir(skillsRoot, { recursive: true });
    for (const { rel, dest, content, current, mode } of desired) {
      const wanted = hashContent(content);
      if (current === null) {
        await writeAtomic(dest, content);
        created.push(dest);
        summary.added.push(rel);
        installedHashes[rel] = wanted;
      } else if (hashContent(current) === wanted) {
        summary.unchanged.push(rel);
        // Never adopt unrelated pre-existing files: only previously owned
        // entries keep a manifest record.
        if (rel in ownedFiles) installedHashes[rel] = wanted;
      } else if (rel in ownedFiles && hashContent(current) === ownedFiles[rel]) {
        backupExisting(dest, current, mode);
        await writeAtomic(dest, content); // pristine owned follows bundle upgrades
        summary.updated.push(rel);
        installedHashes[rel] = wanted;
      } else if (force) {
        backupExisting(dest, current, mode);
        await writeAtomic(dest, content);
        summary.updated.push(`${rel} (overwrote user edit with --force)`);
        installedHashes[rel] = wanted;
      } else {
        summary.preserved.push(rel); // user-edited owned asset: hands off
        // Retain the prior install hash so uninstall still recognizes the
        // edit; never record the edited bytes as owned.
        if (rel in ownedFiles) installedHashes[rel] = ownedFiles[rel];
      }
    }

    // Stale manifest entries (owned files the bundle no longer ships):
    // the phase-1 plan validated every stale destination read-only
    // (escapes and symlinks fail closed before any write), but each delete
    // decision below re-reads its target through the same ownership guard
    // immediately before its rm: a copy edited or removed after planning is
    // preserved/reported, never deleted from a stale snapshot. Only
    // manifest-owned pristine paths are ever deleted, guarded by the same
    // ownership/hash check uninstall uses.
    for (const { rel } of stalePlan) {
      const { dest, current, mode } = await readOwnedTarget(skillsRoot, rel);
      if (current === null || hashContent(current) !== ownedFiles[rel]) {
        summary.stale.push(rel);
        installedHashes[rel] = ownedFiles[rel];
        continue;
      }
      backupExisting(dest, current, mode);
      await rm(dest);
      await pruneEmptyParents(dest, skillsRoot);
      summary.removed.push(rel);
    }

    let instructionReport = null;
    let nextInstructions = boundInstructions;
    if (instructionPlan) {
      instructionReport = {
        status: instructionPlan.action,
        path: instructionsFile,
        ...(instructionPlan.reason ? { reason: instructionPlan.reason } : {}),
      };
      if (instructionPlan.action === 'created' || instructionPlan.action === 'updated') {
        const nextRaw = applyInstructionPlan(existingInstructionsRaw, instructionPlan);
        await writeAtomic(instructionsFile, nextRaw);
        instructionWritten = true;
        nextInstructions = {
          path: instructionsFile,
          hash: hashContent(instructionPlan.block),
          separation: instructionPlan.separation,
        };
      } else if (instructionPlan.action === 'unchanged') {
        nextInstructions = {
          path: instructionsFile,
          hash: hashContent(instructionPlan.block),
          separation: instructionPlan.separation,
        };
      }
    }

    for (const write of claudePlan.writes) {
      await writeAtomic(write.path, write.after, write.before === null ? { mode: 0o600 } : {});
      claudeWritten.push(write);
    }

    const roleReadiness = bundle.bundleRoles
      ? assessInstalledRoleSnapshot(
        await readFile(join(skillsRoot, 'axstack', 'roles.json')),
        selectedPreset,
        bundle.bundleRoles,
      )
      : null;

    await writeManifest(skillsRoot, {
      version: MANIFEST_VERSION,
      files: installedHashes,
      profiles: legacyProfiles,
      claudeSettings: {
        path: claudePlan.settingsPath ?? boundClaudeSettingsPath,
      },
      instructions: nextInstructions,
    });
    if (legacyProfileNote || legacyInstructionNote) {
      summary.notes = [
        ...(summary.notes ?? []),
        ...[legacyProfileNote, legacyInstructionNote].filter(Boolean),
      ];
    }
    return {
      ...summary,
      preset: selectedPreset,
      roles: roleReadiness,
      claudeSettings: claudePlan.report,
      instructions: instructionReport,
    };
  } catch (err) {
    // Restore updated files, remove creations, and restore Claude settings so
    // pre-run state (which the untouched manifest describes) holds again.
    // Restore failures are collected and reported: a swallowed restore would
    // leave ownership claims describing bytes that are not on disk.
    const rollbackErrors = [];
    for (const write of claudeWritten.reverse()) {
      try {
        if (write.before === null) await rm(write.path);
        else await writeAtomic(write.path, write.before);
      } catch (restoreErr) {
        rollbackErrors.push(`${write.path}: ${restoreErr?.message ?? restoreErr}`);
      }
    }
    if (instructionWritten) {
      try {
        if (existingInstructionsRaw === null) await rm(instructionsFile);
        else await writeAtomic(instructionsFile, existingInstructionsRaw);
      } catch (restoreErr) {
        rollbackErrors.push(`${instructionsFile}: ${restoreErr?.message ?? restoreErr}`);
      }
    }
    for (const [dest, { bytes, mode }] of backups) {
      try {
        await writeAtomic(dest, bytes, mode === null ? {} : { mode });
      } catch (restoreErr) {
        rollbackErrors.push(`${dest}: ${restoreErr?.message ?? restoreErr}`);
      }
    }
    for (const createdFile of created) {
      try {
        await rm(createdFile);
      } catch (restoreErr) {
        rollbackErrors.push(`${createdFile}: ${restoreErr?.message ?? restoreErr}`);
      }
    }
    if (rollbackErrors.length > 0) {
      err.message += ` (incomplete rollback; manual repair needed: ${rollbackErrors.join('; ')})`;
    }
    throw err;
  }
}

export async function uninstallBundle({
  skillsDir,
  instructionsPath = null,
  force = false,
  yes = false,
  claude = null,
  log = () => {},
} = {}) {
  if (!skillsDir) throw new Error('uninstall requires --skills-dir <dir>');
  const skillsRoot = await canonicalTargetDir(resolve(skillsDir));
  const instructionsFile = instructionsPath
    ? await canonicalInstructionFile(instructionsPath)
    : null;
  assertOutsideHome(skillsRoot, { yes, kind: 'skills directory' });
  if (instructionsFile) assertOutsideHome(instructionsFile, { yes, kind: 'instruction file' });

  const manifest = (await readManifest(skillsRoot)) ?? {
    version: MANIFEST_VERSION,
    files: {},
    profiles: { path: null, preset: null, entries: {} },
    claudeSettings: { path: null },
    instructions: { path: null, hash: null },
  };
  const boundClaudeSettingsPath = manifest.claudeSettings?.path ?? null;
  const claudePlan = await planUninstallClaudeSettings({
    claude,
    skillsRoot,
    boundPath: boundClaudeSettingsPath,
  });
  if (claudePlan.report.path) {
    assertOutsideHome(claudePlan.report.path, { yes, kind: 'Claude settings file' });
  }
  const remainingClaudeSettingsPath = claudePlan.unbind ? null : boundClaudeSettingsPath;
  const summary = { removed: [], preserved: [], missing: [], instructions: null };
  if (Object.keys(manifest.files).length === 0 && Object.keys(manifest.profiles.entries).length === 0) {
    summary.note = 'no Axstack ownership manifest; nothing to remove';
  }
  const ownedFiles = manifest.files ?? {};
  const legacyProfiles = manifest.profiles;
  const hasLegacyProfiles = Object.keys(legacyProfiles?.entries ?? {}).length > 0;
  if (hasLegacyProfiles) {
    summary.note = 'legacy Paseo profile provenance retained inert; see legacy cleanup guidance in docs/installation.md';
  }
  const remainingFiles = { ...ownedFiles };
  const boundInstructions = manifest.instructions ?? { path: null, hash: null };
  let remainingInstructions = boundInstructions;

  if (!instructionsFile && boundInstructions.path !== null) {
    summary.instructions = {
      status: 'preserved',
      path: boundInstructions.path,
      reason: `re-run uninstall with --instructions ${boundInstructions.path}`,
    };
  }

  let existingInstructionsRaw = null;
  let strippedInstructionsRaw = null;
  if (instructionsFile) {
    if (boundInstructions.path === null) {
      summary.instructions = {
        status: 'preserved',
        path: instructionsFile,
        reason: 'instruction file is not owned by this manifest',
      };
    } else if (boundInstructions.path !== instructionsFile) {
      throw new Error(
        `refusing: owned instruction block is bound to a different file (${boundInstructions.path}); ` +
          `re-run uninstall with --instructions ${boundInstructions.path}`,
      );
    } else {
      try {
        existingInstructionsRaw = await readFile(instructionsFile, 'utf8');
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
      }
      if (existingInstructionsRaw === null) {
        summary.instructions = { status: 'missing', path: instructionsFile };
        remainingInstructions = { path: null, hash: null };
      } else {
        const stripped = stripInstructionBlock(existingInstructionsRaw, boundInstructions, { force });
        if (stripped.removed) {
          strippedInstructionsRaw = stripped.text;
          summary.instructions = {
            status: 'removed',
            path: instructionsFile,
            ...(force && hashContent(stripped.block) !== boundInstructions.hash ? { forced: true } : {}),
          };
          remainingInstructions = { path: null, hash: null };
        } else {
          summary.instructions = {
            status: 'conflict',
            path: instructionsFile,
            reason: 'owned instruction block was edited or is missing',
          };
        }
      }
    }
  }

  // Check every destination for symlink escapes BEFORE deleting anything:
  // one unsafe entry refuses the whole uninstall with skills still on disk.
  // Each delete decision below then re-reads its target through the same
  // guard immediately before its own rm, so a file edited after validation
  // is preserved rather than deleted from a stale snapshot.
  const uninstallPlan = [];
  for (const rel of Object.keys(ownedFiles)) {
    await readOwnedTarget(skillsRoot, rel);
    uninstallPlan.push(rel);
  }

  log('plan complete');
  const manifestFile = join(skillsRoot, '.axstack-manifest.json');
  const manifestBefore = await readFile(manifestFile).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  const manifestMode = manifestBefore === null ? null : (await stat(manifestFile)).mode & 0o777;
  const instructionMode = existingInstructionsRaw === null
    ? null
    : (await stat(instructionsFile)).mode & 0o777;
  const claudeModes = new Map();
  for (const write of claudePlan.writes) {
    const mode = await stat(write.path).then((value) => value.mode & 0o777).catch((err) => {
      if (err?.code === 'ENOENT') return null;
      throw err;
    });
    claudeModes.set(write.path, mode);
  }

  const deletedFiles = [];
  const claudeWritten = [];
  let instructionWritten = false;
  try {
    for (const rel of uninstallPlan) {
      const { dest, current, mode } = await readOwnedTarget(skillsRoot, rel);
      const ownedHash = ownedFiles[rel];
      if (current === null) {
        summary.missing.push(rel);
        delete remainingFiles[rel];
        continue;
      }
      if (hashContent(current) === ownedHash || force) {
        deletedFiles.push({ dest, bytes: current, mode });
        await rm(dest);
        delete remainingFiles[rel];
        summary.removed.push(force && hashContent(current) !== ownedHash ? `${rel} (removed user edit with --force)` : rel);
        await pruneEmptyParents(dest, skillsRoot);
      } else {
        summary.preserved.push(rel); // user-edited owned asset survives
      }
    }

    if (strippedInstructionsRaw !== null) {
      await assertFileSnapshot(instructionsFile, existingInstructionsRaw);
      await writeAtomic(instructionsFile, strippedInstructionsRaw);
      instructionWritten = true;
    }

    for (const write of claudePlan.writes) {
      if (write.after === null) {
        await rm(write.path).catch((err) => {
          if (err?.code !== 'ENOENT') throw err;
        });
      } else {
        await writeAtomic(write.path, write.after, write.before === null ? { mode: 0o600 } : {});
      }
      claudeWritten.push(write);
    }
    summary.claudeSettings = claudePlan.report;

    if (
      Object.keys(remainingFiles).length === 0 &&
      !hasLegacyProfiles &&
      remainingClaudeSettingsPath === null &&
      remainingInstructions.path === null
    ) {
      await rm(manifestFile).catch((err) => {
        if (err?.code !== 'ENOENT') throw err;
      });
      summary.manifestRemoved = true;
    } else {
      await writeManifest(skillsRoot, {
        version: MANIFEST_VERSION,
        files: remainingFiles,
        profiles: legacyProfiles,
        claudeSettings: { path: remainingClaudeSettingsPath },
        instructions: remainingInstructions,
      });
    }
    return summary;
  } catch (err) {
    const rollbackErrors = [];
    for (const write of claudeWritten.reverse()) {
      try {
        if (write.before === null) await rm(write.path);
        else await writeAtomic(write.path, write.before, claudeModes.get(write.path) === null
          ? {}
          : { mode: claudeModes.get(write.path) });
      } catch (restoreErr) {
        rollbackErrors.push(`${write.path}: ${restoreErr?.message ?? restoreErr}`);
      }
    }
    if (instructionWritten) {
      try {
        await writeAtomic(instructionsFile, existingInstructionsRaw, instructionMode === null
          ? {}
          : { mode: instructionMode });
      } catch (restoreErr) {
        rollbackErrors.push(`${instructionsFile}: ${restoreErr?.message ?? restoreErr}`);
      }
    }
    for (const { dest, bytes, mode } of deletedFiles.reverse()) {
      try {
        await writeAtomic(dest, bytes, mode === null ? {} : { mode });
      } catch (restoreErr) {
        rollbackErrors.push(`${dest}: ${restoreErr?.message ?? restoreErr}`);
      }
    }
    try {
      const currentManifest = await readFile(manifestFile).catch((readErr) => {
        if (readErr?.code === 'ENOENT') return null;
        throw readErr;
      });
      if (manifestBefore !== null && currentManifest?.equals(manifestBefore) !== true) {
        await writeAtomic(manifestFile, manifestBefore, manifestMode === null ? {} : { mode: manifestMode });
      }
    } catch (restoreErr) {
      rollbackErrors.push(`${manifestFile}: ${restoreErr?.message ?? restoreErr}`);
    }
    if (rollbackErrors.length > 0) {
      err.message += ` (incomplete rollback; manual repair needed: ${rollbackErrors.join('; ')})`;
    }
    throw err;
  }
}

async function pruneEmptyParents(file, stopDir) {
  let dir = dirname(file);
  while (dir !== stopDir && withinRoot(dir, stopDir)) {
    try {
      await rmdir(dir);
    } catch {
      break; // non-empty or missing: stop pruning
    }
    dir = dirname(dir);
  }
}
