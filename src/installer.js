// Safe install/uninstall bookkeeping for the Axstack skill bundle.
//
// Frozen bundle contract (from the workflow author):
//   <bundle>/skills/axstack-*/SKILL.md (+ supporting files, no symlinks)
//   <bundle>/profiles/paseo.json ({ version: 1, agentProfiles: [...] })
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
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  MANIFEST_VERSION,
  assertSafeRel,
  hashContent,
  hashObject,
  readManifest,
  writeFileExclusive,
  writeManifest,
} from './manifest.js';
import { mergeProfiles, planUninstallProfiles } from './profiles.js';

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
  for (const part of rel.split(sep)) {
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

// Canonicalize a profile file's parent and refuse a symlinked profile file
// itself, so merges never write through a link to elsewhere.
async function canonicalProfileFile(profilePath) {
  const abs = resolve(profilePath);
  const parent = await canonicalTargetDir(dirname(abs));
  const file = join(parent, basename(abs));
  let st = null;
  try {
    st = await lstat(file);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  if (st?.isSymbolicLink()) {
    throw new Error(`unsafe target: profile path is a symlink at ${file}; refusing`);
  }
  return file;
}

function homeDir() {
  try {
    return homedir();
  } catch {
    return null;
  }
}

export function assertOutsideHome(target, { yes = false, kind = 'target' } = {}) {
  const home = homeDir();
  if (home && (target === home || withinRoot(target, home)) && !yes) {
    throw new Error(
      `refusing to touch ${kind} inside your home (${target}) without explicit confirmation; re-run with --yes`,
    );
  }
}

// Validate the bundle directory and return its payload. Throws before any
// target mutation on any problem.
export async function validateBundle(bundleDir) {
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

  let bundleProfiles = null;
  const profilesPath = join(root, 'profiles', 'paseo.json');
  const profilesStat = await lstat(profilesPath).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (profilesStat === null) {
    bundleProfiles = null;
  } else if (profilesStat.isSymbolicLink()) {
    throw new Error('bundle profiles/paseo.json must be a real file, not a symlink');
  } else {
    const raw = await readFile(profilesPath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('bundle profiles/paseo.json is not valid JSON');
    }
    if (!parsed || !Array.isArray(parsed.agentProfiles) || parsed.agentProfiles.length === 0) {
      throw new Error('bundle profiles/paseo.json must define a non-empty agentProfiles array');
    }
    for (const p of parsed.agentProfiles) {
      if (!p || typeof p.id !== 'string' || !p.id.startsWith('axstack-')) {
        throw new Error('bundle profiles must use namespaced axstack-* ids');
      }
    }
    bundleProfiles = parsed.agentProfiles;
  }

  return { root, skillsRoot, files, bundleProfiles };
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
  profilePath = null,
  force = false,
  yes = false,
  log = () => {},
} = {}) {
  if (!bundleDir) throw new Error('install requires --bundle <dir>');
  if (!skillsDir) throw new Error('install requires --skills-dir <dir> (explicit target directories only)');

  // Phase 0: validate everything before mutating anything.
  const bundle = await validateBundle(bundleDir);
  const skillsRoot = await canonicalTargetDir(resolve(skillsDir));
  const profileFile = profilePath ? await canonicalProfileFile(profilePath) : null;
  assertOutsideHome(skillsRoot, { yes, kind: 'skills directory' });
  if (profileFile) assertOutsideHome(profileFile, { yes, kind: 'profile file' });

  let existingProfileRaw = null;
  if (profileFile && bundle.bundleProfiles) {
    try {
      existingProfileRaw = await readFile(profileFile, 'utf8');
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    let existingProfile = null;
    if (existingProfileRaw !== null) {
      try {
        existingProfile = JSON.parse(existingProfileRaw);
      } catch {
        throw new Error(`malformed Paseo config at ${profileFile}; refusing to mutate it`);
      }
    }
    // Dry run: catches malformed host shape before any skill file is written.
    mergeProfiles(existingProfile, bundle.bundleProfiles, {});
  }

  const prevManifest = (await readManifest(skillsRoot)) ?? {
    version: MANIFEST_VERSION,
    files: {},
    profiles: { path: null, entries: {} },
  };
  const ownedFiles = prevManifest.files ?? {};
  // Owned profile hashes are bound to the canonical config file they were
  // installed into. A different --profile is refused before any mutation so
  // identical bytes in an unrelated file can never authorize removal.
  const boundProfilePath = prevManifest.profiles?.path ?? null;
  let ownedProfiles = prevManifest.profiles?.entries ?? {};
  let profileNote = null;
  if (profileFile && bundle.bundleProfiles && Object.keys(ownedProfiles).length > 0) {
    if (boundProfilePath === null) {
      // Legacy unbound ownership: reset rather than honor for removal.
      ownedProfiles = {};
      profileNote = 'legacy unbound profile ownership reset; recording only profiles this run writes';
    } else if (boundProfilePath !== profileFile) {
      throw new Error(
        `refusing: owned profiles are bound to a different config (${boundProfilePath}); ` +
          `uninstall with --profile ${boundProfilePath} first, or install without --profile`,
      );
    }
  }

  // Phase 1: pre-scan unknown pre-existing files so conflicts fail pre-write.
  // Destination ancestry is checked for symlink escapes here, before mutation.
  const desired = [];
  for (const { rel, abs } of bundle.files) {
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
    const content = await readFile(abs);
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
  // and restored on any later failure (skill write, profile write, manifest
  // write), so a failed run leaves pre-run state behind and the untouched
  // manifest still describes it: a retry converges.
  const created = [];
  const backups = new Map();
  const backupExisting = (dest, current) => {
    if (current !== null && !backups.has(dest)) backups.set(dest, current);
  };
  const summary = { added: [], updated: [], unchanged: [], preserved: [], stale: [] };
  const installedHashes = {};
  let profileWritten = false;
  let profileExisted = existingProfileRaw !== null;
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

    // Profiles: pristine owned entries upgrade without --force; user edits
    // are preserved unless --force. Only actually created/updated entries
    // gain manifest records; preserved entries retain prior hashes and
    // pre-existing unrelated entries are never adopted.
    let profileReport = null;
    let nextProfileHashes = { ...ownedProfiles };
    if (profileFile && bundle.bundleProfiles) {
      const existingProfile =
        existingProfileRaw === null ? null : JSON.parse(existingProfileRaw);
      const { config, report } = mergeProfiles(existingProfile, bundle.bundleProfiles, {
        force,
        owned: ownedProfiles,
        hash: hashObject,
      });
      profileReport = report;
      const nextRaw = JSON.stringify(config, null, 2) + '\n';
      if (existingProfileRaw === null || nextRaw !== existingProfileRaw) {
        // New configs are restrictive; existing configs keep their mode.
        await writeAtomic(profileFile, nextRaw, existingProfileRaw === null ? { mode: 0o600 } : {});
        profileWritten = true;
      }
      for (const id of [...report.added, ...report.updated]) {
        const p = config.daemon.agentProfiles.find((entry) => entry?.id === id);
        if (p) nextProfileHashes[id] = hashObject(p);
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

    await writeManifest(skillsRoot, {
      version: MANIFEST_VERSION,
      files: installedHashes,
      profiles: {
        path: profileFile && bundle.bundleProfiles ? profileFile : boundProfilePath,
        entries: nextProfileHashes,
      },
    });
    if (profileNote) summary.notes = [...(summary.notes ?? []), profileNote];
    return { ...summary, profiles: profileReport };
  } catch (err) {
    // Restore updated files, remove creations, restore/remove the profile so
    // pre-run state (which the untouched manifest describes) holds again.
    // Restore failures are collected and reported: a swallowed restore would
    // leave ownership claims describing bytes that are not on disk.
    const rollbackErrors = [];
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
    if (profileWritten) {
      try {
        if (profileExisted) await writeAtomic(profileFile, existingProfileRaw);
        else await rm(profileFile);
      } catch (restoreErr) {
        rollbackErrors.push(`${profileFile}: ${restoreErr?.message ?? restoreErr}`);
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
  profilePath = null,
  force = false,
  yes = false,
  log = () => {},
} = {}) {
  if (!skillsDir) throw new Error('uninstall requires --skills-dir <dir>');
  const skillsRoot = await canonicalTargetDir(resolve(skillsDir));
  const profileFile = profilePath ? await canonicalProfileFile(profilePath) : null;
  assertOutsideHome(skillsRoot, { yes, kind: 'skills directory' });
  if (profileFile) assertOutsideHome(profileFile, { yes, kind: 'profile file' });

  const manifest = await readManifest(skillsRoot);
  const summary = { removed: [], preserved: [], missing: [], profiles: null };
  if (!manifest) {
    summary.note = 'no Axstack ownership manifest; nothing to remove';
    return summary;
  }
  const ownedFiles = manifest.files ?? {};
  const boundProfilePath = manifest.profiles?.path ?? null;
  const ownedProfiles = manifest.profiles?.entries ?? {};
  const remainingFiles = { ...ownedFiles };

  // Validate the profile input (identity, read, parse, plan) BEFORE deleting
  // anything: a wrong-path or malformed profile must fail with skills intact.
  let profilePlan = null;
  let existingProfileRaw = null;
  let remainingBoundPath = boundProfilePath;
  if (profileFile && Object.keys(ownedProfiles).length > 0) {
    if (boundProfilePath !== null && boundProfilePath !== profileFile) {
      throw new Error(
        `refusing: owned profiles are bound to a different config (${boundProfilePath}); ` +
          `re-run uninstall with --profile ${boundProfilePath}`,
      );
    }
    try {
      existingProfileRaw = await readFile(profileFile, 'utf8');
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
    if (existingProfileRaw === null) {
      // Bound config file is gone: nothing to protect, release ownership so
      // a later install can bind a new path.
      remainingBoundPath = null;
      summary.profiles = { removed: [], preserved: [], note: 'bound profile file missing; ownership released' };
    } else {
      let existing;
      try {
        existing = JSON.parse(existingProfileRaw);
      } catch {
        throw new Error(`malformed Paseo config at ${profileFile}; refusing to mutate it`);
      }
      profilePlan = planUninstallProfiles(existing, { profiles: ownedProfiles }, { hash: hashObject });
    }
  }

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

  let remainingProfiles = { ...ownedProfiles };
  if (profilePlan) {
    summary.profiles = profilePlan.report;
    if (profilePlan.report.removed.length > 0) {
      await writeAtomic(profileFile, JSON.stringify(profilePlan.config, null, 2) + '\n');
    }
    for (const id of profilePlan.report.removed) delete remainingProfiles[id];
  } else if (summary.profiles?.note) {
    remainingProfiles = {};
  }

  if (Object.keys(remainingFiles).length === 0 && Object.keys(remainingProfiles).length === 0) {
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
      profiles: { path: remainingBoundPath, entries: remainingProfiles },
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
