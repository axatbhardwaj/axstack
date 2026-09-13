// Ownership-manifest helpers: sha256 hashes plus atomic manifest read/write.
// The manifest lives at <skillsDir>/.axstack-manifest.json and records the
// exact bytes Axstack installed, so updates and uninstalls only touch
// unchanged owned assets.
import { createHash } from 'node:crypto';
import { rename, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const MANIFEST_NAME = '.axstack-manifest.json';
export const MANIFEST_VERSION = 1;

export function hashContent(content) {
  const bytes = typeof content === 'string' ? content : JSON.stringify(content);
  return createHash('sha256').update(bytes, 'utf8').digest('hex');
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

export async function readManifest(skillsDir) {
  let raw;
  try {
    raw = await readFile(manifestPath(skillsDir), 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw new Error(`cannot read ownership manifest: ${err.message}`);
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    throw new Error('ownership manifest is corrupt; refusing to proceed');
  }
}

export async function writeManifest(skillsDir, manifest) {
  await mkdir(skillsDir, { recursive: true });
  const dest = manifestPath(skillsDir);
  const tmp = `${dest}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await rename(tmp, dest);
}
