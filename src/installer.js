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
    const skillMark = join(skillsRoot, dir.name, 'SKILL.md');
    try {
      const s = await stat(skillMark);
      if (!s.isFile()) throw new Error();
    } catch {
      throw new Error(`skill ${dir.name} is missing SKILL.md`);
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

export async function installBundle({
  bundleDir,
  skillsDir,
  preset,
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
  assertOutsideHome(skillsRoot, { yes, kind: 'skills directory' });
  const claudePlan = await planInstallClaudeSettings({ claude, skillsRoot });
  if (claudePlan.report.path) {
    assertOutsideHome(claudePlan.report.path, { yes, kind: 'Claude settings file' });
  }

  const prevManifest = (await readManifest(skillsRoot)) ?? {
    version: MANIFEST_VERSION,
    files: {},
    profiles: { path: null, preset: null, entries: {} },
    claudeSettings: { path: null },
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

  // Phase 1: pre-scan unknown pre-existing files so conflicts fail pre-write.
  // Destination ancestry is checked for symlink escapes here, before mutation.
  const desired = [];
  for (const { rel, abs, content: inlineContent } of bundle.files) {
    const dest = join(skillsRoot, rel);
    if (!withinRoot(dest, skillsRoot)) throw new Error(`unsafe install target rejected: ${rel}`);
    await assertNoSymlinksBelow(skillsRoot, dirname(dest));
    let destStat = null;
    try {
      destStat = await lstat(dest);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    if (destStat?.isSymbolicLink()) {
      throw new Error(`unsafe target: destination is a symlink at ${dest}; refusing`);
    }
    const content = inlineContent ?? await readFile(abs);
    let current = null;
    try {
      current = await readFile(dest);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    desired.push({ rel, dest, content, current });
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

  // Phase 2: write files. Existing overwritten bytes are backed up in memory
  // and restored on any later failure (skill write, settings write, manifest
  // write), so a failed run leaves pre-run state behind and the untouched
  // manifest still describes it: a retry converges.
  const created = [];
  const backups = new Map();
  const backupExisting = (dest, current) => {
    if (current !== null && !backups.has(dest)) backups.set(dest, current);
  };
  const summary = { added: [], updated: [], unchanged: [], preserved: [], stale: [] };
  const installedHashes = {};
  const claudeWritten = [];
  try {
    await mkdir(skillsRoot, { recursive: true });
    for (const { rel, dest, content, current } of desired) {
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
        backupExisting(dest, current);
        await writeAtomic(dest, content); // pristine owned follows bundle upgrades
        summary.updated.push(rel);
        installedHashes[rel] = wanted;
      } else if (force) {
        backupExisting(dest, current);
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

    // Stale manifest entries (owned files the bundle no longer ships) are
    // left on disk and reported, never silently deleted.
    for (const rel of Object.keys(ownedFiles)) {
      if (!(rel in installedHashes)) {
        summary.stale.push(rel);
        installedHashes[rel] = ownedFiles[rel];
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
      )
      : null;

    await writeManifest(skillsRoot, {
      version: MANIFEST_VERSION,
      files: installedHashes,
      profiles: legacyProfiles,
      claudeSettings: {
        path: claudePlan.settingsPath ?? boundClaudeSettingsPath,
      },
    });
    if (legacyProfileNote) summary.notes = [...(summary.notes ?? []), legacyProfileNote];
    return {
      ...summary,
      preset: selectedPreset,
      roles: roleReadiness,
      claudeSettings: claudePlan.report,
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
    for (const [dest, bytes] of backups) {
      try {
        await writeAtomic(dest, bytes);
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
  force = false,
  yes = false,
  claude = null,
  log = () => {},
} = {}) {
  if (!skillsDir) throw new Error('uninstall requires --skills-dir <dir>');
  const skillsRoot = await canonicalTargetDir(resolve(skillsDir));
  assertOutsideHome(skillsRoot, { yes, kind: 'skills directory' });

  const manifest = (await readManifest(skillsRoot)) ?? {
    version: MANIFEST_VERSION,
    files: {},
    profiles: { path: null, preset: null, entries: {} },
    claudeSettings: { path: null },
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
  const summary = { removed: [], preserved: [], missing: [] };
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

  // Check every destination for symlink escapes BEFORE deleting anything:
  // one unsafe entry refuses the whole uninstall with skills still on disk.
  for (const rel of Object.keys(ownedFiles)) {
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
  }

  for (const [rel, ownedHash] of Object.entries(ownedFiles)) {
    const dest = join(skillsRoot, rel);
    let current = null;
    try {
      current = await readFile(dest);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        summary.missing.push(rel);
        delete remainingFiles[rel];
        continue;
      }
      throw err;
    }
    if (hashContent(current) === ownedHash || force) {
      await rm(dest);
      delete remainingFiles[rel];
      summary.removed.push(force && hashContent(current) !== ownedHash ? `${rel} (removed user edit with --force)` : rel);
      await pruneEmptyParents(dest, skillsRoot);
    } else {
      summary.preserved.push(rel); // user-edited owned asset survives
    }
  }

  for (const write of claudePlan.writes) {
    if (write.after === null) {
      await rm(write.path).catch((err) => {
        if (err?.code !== 'ENOENT') throw err;
      });
    } else {
      await writeAtomic(write.path, write.after, write.before === null ? { mode: 0o600 } : {});
    }
  }
  summary.claudeSettings = claudePlan.report;

  if (
    Object.keys(remainingFiles).length === 0 &&
    !hasLegacyProfiles &&
    remainingClaudeSettingsPath === null
  ) {
    try {
      await rm(join(skillsRoot, '.axstack-manifest.json'));
    } catch {
      // manifest already gone; nothing to do
    }
    summary.manifestRemoved = true;
  } else {
    await writeManifest(skillsRoot, {
      version: MANIFEST_VERSION,
      files: remainingFiles,
      profiles: legacyProfiles,
      claudeSettings: { path: remainingClaudeSettingsPath },
    });
  }
  return summary;
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
