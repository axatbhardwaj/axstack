// Ownership-manifest helpers: sha256 hashes plus atomic manifest read/write.
// The manifest lives at <skillsDir>/.axstack-manifest.json and records the
// exact bytes Axstack installed, so updates and uninstalls only touch
// unchanged owned assets.
import { chmod, lstat, mkdir, open, rename, readFile, rm, stat } from 'node:fs/promises';
import { isAbsolute, join } from './posixpath.js';

export const MANIFEST_NAME = '.axstack-manifest.json';
export const MANIFEST_TMP_NAME = '.axstack-manifest.json.tmp';
export const MANIFEST_VERSION = 1;

export function hashContent(content) {
  // Byte-for-byte compatible with the pre-migration implementation:
  // strings hash as UTF-8; every other input (including Buffers read from
  // skill files) hashes as its JSON serialization. Do NOT "fix" Buffers to
  // hash as raw bytes without a manifest migration: every recorded
  // ownership hash would stop matching and unchanged owned files would lose
  // ownership. Proven by fixtures/old-impl under both runtimes.
  const input = typeof content === 'string' ? content : JSON.stringify(content);
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(input, 'utf8');
  return hasher.digest('hex');
}

// Deterministic object hash for profile entries (key order independent).
export function hashObject(value) {
  return hashContent(stableStringify(value));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

export function manifestPath(skillsDir) {
  return join(skillsDir, MANIFEST_NAME);
}

export function assertSafeRel(rel) {
  if (
    !rel ||
    typeof rel !== 'string' ||
    isAbsolute(rel) ||
    rel.split('/').includes('..') ||
    rel.includes('\0') ||
    /^[a-zA-Z]:/.test(rel) ||
    rel === MANIFEST_NAME
  ) {
    throw new Error(`unsafe manifest path rejected: ${rel || '(empty)'}`);
  }
}

function isHashMap(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === 'string')
  );
}

// Normalized shape:
// { version, files, profiles: { path, preset, entries },
//   claudeSettings: { path } }.
// `profiles.path` binds owned profile hashes to the canonical config file
// they were installed into; `path: null` marks legacy unbound entries, which
// callers must reset rather than honor for removal.
function normalizeManifest(parsed) {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('invalid ownership manifest: expected a JSON object');
  }
  if (parsed.version !== MANIFEST_VERSION) {
    throw new Error(
      `unsupported ownership manifest version: ${JSON.stringify(parsed.version)}`,
    );
  }
  if (!isHashMap(parsed.files)) {
    throw new Error('invalid ownership manifest: files must be an object of path hashes');
  }
  const rawClaudeSettings = parsed.claudeSettings ?? { path: null };
  if (
    typeof rawClaudeSettings !== 'object' || rawClaudeSettings === null ||
    Array.isArray(rawClaudeSettings) ||
    (rawClaudeSettings.path !== null && typeof rawClaudeSettings.path !== 'string')
  ) {
    throw new Error('invalid ownership manifest: claudeSettings must bind a config path');
  }
  for (const rel of Object.keys(parsed.files)) assertSafeRel(rel);
  const rawProfiles = parsed.profiles ?? { path: null, preset: null, entries: {} };
  if (isHashMap(rawProfiles)) {
    return {
      version: MANIFEST_VERSION,
      files: { ...parsed.files },
      profiles: { path: null, preset: null, entries: { ...rawProfiles } },
      claudeSettings: { path: rawClaudeSettings.path },
    };
  }
  if (
    typeof rawProfiles === 'object' &&
    rawProfiles !== null &&
    (rawProfiles.path === null || typeof rawProfiles.path === 'string') &&
    (rawProfiles.preset === undefined || rawProfiles.preset === null || typeof rawProfiles.preset === 'string') &&
    isHashMap(rawProfiles.entries ?? {})
  ) {
    return {
      version: MANIFEST_VERSION,
      files: { ...parsed.files },
      profiles: {
        path: rawProfiles.path,
        preset: rawProfiles.preset ?? null,
        entries: { ...(rawProfiles.entries ?? {}) },
      },
      claudeSettings: { path: rawClaudeSettings.path },
    };
  }
  throw new Error('invalid ownership manifest: profiles must bind a config path to id hashes');
}

export async function readManifest(skillsDir) {
  const dest = manifestPath(skillsDir);
  try {
    if ((await lstat(dest)).isSymbolicLink()) {
      throw new Error('unsafe ownership manifest: manifest path is a symlink; refusing');
    }
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err?.code ? new Error(`cannot read ownership manifest: ${err.message}`) : err;
  }
  let raw;
  try {
    raw = await readFile(dest, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw new Error(`cannot read ownership manifest: ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ownership manifest is corrupt; refusing to proceed');
  }
  return normalizeManifest(parsed);
}

export async function writeManifest(skillsDir, manifest) {
  await mkdir(skillsDir, { recursive: true });
  const dest = manifestPath(skillsDir);
  // Fixed temp name (single-writer assumption for a user-invoked installer;
  // a failed run leaves either the old manifest or no manifest, and retries
  // converge). A fixed name also keeps manifest-write failures testable.
  const tmp = join(skillsDir, MANIFEST_TMP_NAME);
  const normalized = normalizeManifest(manifest);
  let existingMode = null;
  try {
    existingMode = (await stat(dest)).mode & 0o777;
  } catch (err) {
    if (err?.code !== 'ENOENT') throw new Error(`cannot write ownership manifest: ${err.message}`);
  }
  try {
    await writeFileExclusive(tmp, JSON.stringify(normalized, null, 2) + '\n');
  } catch (err) {
    if (/temporary file already exists/.test(err?.message ?? '')) throw err;
    throw new Error(`cannot write ownership manifest: ${err?.message ?? err}`);
  }
  try {
    await rename(tmp, dest);
  } catch (err) {
    try {
      await rm(tmp);
    } catch {
      // best effort cleanup of a temp file this run created
    }
    throw new Error(`cannot write ownership manifest: ${err?.message ?? err}`);
  }
  try {
    await chmod(dest, existingMode ?? 0o600);
  } catch (err) {
    throw new Error(`wrote ownership manifest but could not set permissions: ${err.message}`);
  }
}

// Create a temp file exclusively with restrictive permissions. Pre-existing
// temp entries (files, directories, symlinks) are refused — never followed,
// truncated, or removed — so a planted temp path cannot redirect writes.
// This guards pre-existing entries, not an active concurrent attacker.
export async function writeFileExclusive(tmpPath, bytes) {
  let preexisting = null;
  try {
    preexisting = await lstat(tmpPath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  if (preexisting) {
    throw new Error(
      `temporary file already exists at ${tmpPath}; refusing to overwrite it (remove it if it is a stale leftover)`,
    );
  }
  let handle;
  try {
    handle = await open(tmpPath, 'wx', 0o600);
  } catch (err) {
    if (err?.code === 'EEXIST') {
      throw new Error(
        `temporary file already exists at ${tmpPath}; refusing to overwrite it (remove it if it is a stale leftover)`,
      );
    }
    throw err;
  }
  try {
    await handle.writeFile(bytes);
    await handle.close();
  } catch (err) {
    try {
      await handle.close();
    } catch {
      // ignore close failure; original error matters
    }
    try {
      await rm(tmpPath); // only unlink: this run created it via wx
    } catch {
      // best effort cleanup of a temp file this run created
    }
    throw err;
  }
}
