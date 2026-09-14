import { lstat, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, join, resolve } from './posixpath.js';
import { hashContent } from './manifest.js';

export const CLAUDE_SETTING_KEY = 'CLAUDE_CODE_SUBAGENT_MODEL';
export const CLAUDE_SETTING_PATH = `env.${CLAUDE_SETTING_KEY}`;
export const CLAUDE_SETTING_VALUE = 'opus';
export const CLAUDE_SIDECAR_NAME = '.axstack-settings.json';

async function canonicalParent(dir) {
  let cur = resolve(dir);
  const tail = [];
  for (;;) {
    try {
      return join(await realpath(cur), ...tail);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
      const parent = dirname(cur);
      if (parent === cur) throw new Error(`cannot resolve settings directory: ${dir}`);
      tail.unshift(basename(cur));
      cur = parent;
    }
  }
}

async function safeFile(path, label) {
  const file = join(await canonicalParent(dirname(resolve(path))), basename(path));
  const fileStat = await lstat(file).catch((err) => {
    if (err?.code === 'ENOENT') return null;
    throw err;
  });
  if (fileStat?.isSymbolicLink()) {
    throw new Error(`unsafe Claude ${label}: path is a symlink at ${file}; refusing`);
  }
  return file;
}

async function readJson(path, label) {
  let raw = null;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
  if (raw === null) return { raw, value: null };
  try {
    const value = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return { raw, value };
  } catch {
    throw new Error(`malformed Claude ${label} at ${path}; refusing to mutate it`);
  }
}

function validateSidecar(sidecar, path, settingsPath) {
  if (sidecar === null) return { version: 1, settingsPath, keys: {} };
  if (
    sidecar.version !== 1 || typeof sidecar.settingsPath !== 'string' ||
    typeof sidecar.keys !== 'object' || sidecar.keys === null || Array.isArray(sidecar.keys)
  ) {
    throw new Error(`malformed Claude settings ownership sidecar at ${path}; refusing to mutate it`);
  }
  if (sidecar.settingsPath !== settingsPath) {
    throw new Error(
      `Claude settings ownership is bound to ${sidecar.settingsPath}; refusing target ${settingsPath}`,
    );
  }
  for (const entry of Object.values(sidecar.keys)) {
    if (
      typeof entry !== 'object' || entry === null || Array.isArray(entry) ||
      typeof entry.hash !== 'string' || !Array.isArray(entry.owners) ||
      entry.owners.some((owner) => typeof owner !== 'string')
    ) {
      throw new Error(`malformed Claude settings ownership sidecar at ${path}; refusing to mutate it`);
    }
  }
  return sidecar;
}

const jsonBytes = (value) => JSON.stringify(value, null, 2) + '\n';

export async function planInstallClaudeSettings({ claude, skillsRoot }) {
  if (!claude?.available) {
    return {
      report: { status: 'skipped', reason: claude?.reason ?? 'Claude Code is not available' },
      writes: [],
    };
  }
  if (!claude.settingsPath) {
    return { report: { status: 'skipped', reason: 'Claude settings path is unavailable' }, writes: [] };
  }

  const settingsPath = await safeFile(claude.settingsPath, 'settings');
  const sidecarPath = await safeFile(join(dirname(settingsPath), CLAUDE_SIDECAR_NAME), 'settings ownership sidecar');
  const settingsFile = await readJson(settingsPath, 'settings JSON');
  const sidecarFile = await readJson(sidecarPath, 'settings ownership sidecar');
  const sidecar = validateSidecar(sidecarFile.value, sidecarPath, settingsPath);
  const settings = settingsFile.value ?? {};
  if (
    settings.env !== undefined &&
    (typeof settings.env !== 'object' || settings.env === null || Array.isArray(settings.env))
  ) {
    throw new Error(`malformed Claude settings JSON at ${settingsPath}; env must be an object`);
  }

  const hasValue = Object.hasOwn(settings.env ?? {}, CLAUDE_SETTING_KEY);
  const currentValue = settings.env?.[CLAUDE_SETTING_KEY];
  const owned = sidecar.keys[CLAUDE_SETTING_PATH];
  const currentHash = hasValue ? hashContent(currentValue) : null;

  if (hasValue && (!owned || owned.hash !== currentHash)) {
    return {
      report: { status: 'preserved', value: currentValue, path: settingsPath },
      writes: [],
      settingsPath,
    };
  }

  const owners = [...new Set([...(owned?.owners ?? []), skillsRoot])].sort();
  const nextSidecar = {
    ...sidecar,
    keys: {
      ...sidecar.keys,
      [CLAUDE_SETTING_PATH]: { hash: hashContent(CLAUDE_SETTING_VALUE), owners },
    },
  };
  const writes = [];
  if (!hasValue) {
    const nextSettings = {
      ...settings,
      env: { ...(settings.env ?? {}), [CLAUDE_SETTING_KEY]: CLAUDE_SETTING_VALUE },
    };
    writes.push({ path: settingsPath, before: settingsFile.raw, after: jsonBytes(nextSettings) });
  }
  const nextSidecarRaw = jsonBytes(nextSidecar);
  if (nextSidecarRaw !== sidecarFile.raw) {
    writes.push({ path: sidecarPath, before: sidecarFile.raw, after: nextSidecarRaw });
  }
  return {
    report: hasValue
      ? { status: 'unchanged', path: settingsPath }
      : { status: 'set', path: settingsPath },
    writes,
    settingsPath,
  };
}

export async function planUninstallClaudeSettings({ claude, skillsRoot }) {
  if (!claude?.available) {
    return {
      report: { status: 'skipped', reason: claude?.reason ?? 'Claude Code is not available' },
      writes: [],
    };
  }
  if (!claude.settingsPath) {
    return { report: { status: 'skipped', reason: 'Claude settings path is unavailable' }, writes: [] };
  }

  const settingsPath = await safeFile(claude.settingsPath, 'settings');
  const sidecarPath = await safeFile(join(dirname(settingsPath), CLAUDE_SIDECAR_NAME), 'settings ownership sidecar');
  const settingsFile = await readJson(settingsPath, 'settings JSON');
  const sidecarFile = await readJson(sidecarPath, 'settings ownership sidecar');
  const sidecar = validateSidecar(sidecarFile.value, sidecarPath, settingsPath);
  const settings = settingsFile.value ?? {};
  if (
    settings.env !== undefined &&
    (typeof settings.env !== 'object' || settings.env === null || Array.isArray(settings.env))
  ) {
    throw new Error(`malformed Claude settings JSON at ${settingsPath}; env must be an object`);
  }

  const owned = sidecar.keys[CLAUDE_SETTING_PATH];
  if (!owned || !owned.owners.includes(skillsRoot)) {
    return {
      report: { status: 'skipped', reason: 'this skills directory does not own the Claude setting' },
      writes: [],
    };
  }

  const remainingOwners = owned.owners.filter((owner) => owner !== skillsRoot);
  const nextKeys = { ...sidecar.keys };
  let report;
  const writes = [];
  if (remainingOwners.length > 0) {
    nextKeys[CLAUDE_SETTING_PATH] = { ...owned, owners: remainingOwners };
    report = { status: 'retained', path: settingsPath, owners: remainingOwners };
  } else {
    delete nextKeys[CLAUDE_SETTING_PATH];
    const hasValue = Object.hasOwn(settings.env ?? {}, CLAUDE_SETTING_KEY);
    const currentValue = settings.env?.[CLAUDE_SETTING_KEY];
    if (hasValue && hashContent(currentValue) === owned.hash) {
      const nextEnv = { ...settings.env };
      delete nextEnv[CLAUDE_SETTING_KEY];
      writes.push({
        path: settingsPath,
        before: settingsFile.raw,
        after: jsonBytes({ ...settings, env: nextEnv }),
      });
      report = { status: 'removed', path: settingsPath };
    } else if (hasValue) {
      report = { status: 'preserved', value: currentValue, path: settingsPath };
    } else {
      report = { status: 'released', path: settingsPath };
    }
  }

  const nextSidecar = { ...sidecar, keys: nextKeys };
  writes.push({
    path: sidecarPath,
    before: sidecarFile.raw,
    after: Object.keys(nextKeys).length === 0 ? null : jsonBytes(nextSidecar),
  });
  return { report, writes, settingsPath };
}
