// Small explicit POSIX path helper covering only the operations the
// installer uses (join, resolve, relative, isAbsolute, basename, dirname).
// Backslashes are ordinary filename characters on POSIX and are NEVER
// treated as separators (this is the documented divergence from pathe,
// which normalizes Windows separators). No syscalls, no dependencies.
export const sep = '/';

export function isAbsolute(p) {
  return typeof p === 'string' && p.startsWith('/');
}

function normalizeSegments(parts, { allowAboveRoot }) {
  const out = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (allowAboveRoot) out.push('..');
    } else {
      out.push(part);
    }
  }
  return out;
}

export function normalize(p) {
  if (typeof p !== 'string') throw new TypeError('path must be a string');
  if (p === '') return '.';
  const absolute = p.startsWith('/');
  const trailing = p.length > 1 && p.endsWith('/');
  const segs = normalizeSegments(p.split('/'), { allowAboveRoot: !absolute });
  let result = (absolute ? '/' : '') + segs.join('/');
  if (result === '') result = absolute ? '/' : '.';
  else if (trailing && result !== '/') result += '/';
  return result;
}

export function join(...parts) {
  const strings = parts.filter((p) => typeof p === 'string' && p !== '');
  if (strings.length === 0) return '.';
  const joined = strings.join('/');
  let result = normalize(joined);
  // join preserves a trailing slash from the last segment.
  const last = strings[strings.length - 1];
  if (last.endsWith('/') && !result.endsWith('/')) result += '/';
  return result;
}

export function resolveFrom(cwd, ...paths) {
  let resolved = '';
  let isAbs = false;
  const all = [...paths];
  for (let i = all.length - 1; i >= 0; i--) {
    const p = all[i];
    if (typeof p !== 'string' || p === '') continue;
    resolved = resolved ? `${p}/${resolved}` : p;
    if (p.startsWith('/')) {
      isAbs = true;
      break;
    }
  }
  if (!isAbs) resolved = resolved ? `${cwd}/${resolved}` : String(cwd);
  const result = normalize(resolved);
  return result.length > 1 && result.endsWith('/') ? result.slice(0, -1) : result;
}

export function resolve(...paths) {
  return resolveFrom(Bun.cwd, ...paths);
}

export function relative(from, to) {
  const a = resolve(from);
  const b = resolve(to);
  if (a === b) return '';
  const aSegs = a.split('/').filter((s) => s !== '');
  const bSegs = b.split('/').filter((s) => s !== '');
  let common = 0;
  while (common < aSegs.length && common < bSegs.length && aSegs[common] === bSegs[common]) {
    common++;
  }
  const up = aSegs.length - common;
  return [...Array(up).fill('..'), ...bSegs.slice(common)].join('/');
}

function stripTrailing(p) {
  let end = p.length;
  while (end > 1 && p[end - 1] === '/') end--;
  return p.slice(0, end);
}

// No `ext` parameter: no caller strips extensions (YAGNI).
export function basename(p) {
  if (typeof p !== 'string') throw new TypeError('path must be a string');
  const stripped = stripTrailing(p);
  if (stripped === '') return '';
  const idx = stripped.lastIndexOf('/');
  return idx === -1 ? stripped : stripped.slice(idx + 1);
}

export function dirname(p) {
  if (typeof p !== 'string') throw new TypeError('path must be a string');
  const stripped = stripTrailing(p);
  if (stripped === '') return '.';
  const idx = stripped.lastIndexOf('/');
  if (idx === -1) return '.';
  if (idx === 0) return '/';
  return stripped.slice(0, idx);
}
