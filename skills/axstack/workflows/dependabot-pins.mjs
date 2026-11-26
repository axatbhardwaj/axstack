import { githubObject, githubPages } from './dependabot-pages.mjs';

export const isSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);


function uses(document) {
  const actions = new Map();
  const put = (key, entry) => {
    if (entry && Object.hasOwn(entry, 'uses')) actions.set(key, entry.uses);
  };
  if (!document || typeof document !== 'object' || !document.jobs || typeof document.jobs !== 'object') return null;
  for (const [name, job] of Object.entries(document.jobs)) {
    if (!job || typeof job !== 'object' || (job.steps !== undefined && !Array.isArray(job.steps))) return null;
    put(JSON.stringify([name]), job);
    job.steps?.forEach((step, index) => put(JSON.stringify([name, index]), step));
  }
  return actions;
}

export async function changedRefs(files, readWorkflow) {
  const changed = [];
  for (const { filename, previous_filename, status } of files) {
    if (!['added', 'modified', 'renamed', 'removed'].includes(status)) return null;
    // Workflow-local paths and ambiguous YAML are held open for the driver.
    if (!/\.(yml|yaml)$/.test(filename)) return null;
    const old = status === 'added' ? new Map() : uses(await readWorkflow(previous_filename ?? filename, 'base'));
    const current = status === 'removed' ? new Map() : uses(await readWorkflow(filename, 'head'));
    if (!old || !current) return null;
    for (const [key, value] of current) {
      if (old.has(key) && old.get(key) === value) continue;
      const match = typeof value === 'string' &&
        /^([\w.-]+\/[\w.-]+)(?:\/[\w./-]+)?@([\w.+-]+)$/.exec(value);
      if (!match) return null;
      changed.push({ action: match[1].toLowerCase(), ref: match[2] });
    }
  }
  return changed;
}

function versionClaim(action, messages) {
  const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = '(?:\\[' + escaped + '\\]\\(https://github\\.com/' + escaped +
    '(?:/[^)\\s]*)?\\)|[`*]*' + escaped + '[`*]*)';
  const version = '[`*]*(v?\\d+(?:\\.\\d+){0,2}(?:[-+][\\w.-]+)?)';
  const sentence = new RegExp('(?:^|\\b(?:bump|bumps|update|updates)\\s+)' + named +
    '\\s+from\\s+[^\\n]{1,100}?\\s+to\\s+' + version + '(?=\\.?($|[^\\w.-]))', 'gim');
  const table = new RegExp('^\\s*\\|?\\s*' + named + '\\s*\\|[^|\\n]+\\|\\s*' +
    version + '[`*]*\\s*(?:\\||$)', 'gim');
  const claims = new Set();
  for (const message of messages) {
    for (const pattern of [sentence, table]) {
      for (const match of message.matchAll(pattern)) claims.add(match[1].replace(/^v/i, ''));
    }
  }
  return claims.size === 1 ? [...claims][0] : null;
}

async function resolveTag(request, repo, tag) {
  const ref = await githubObject(request, `${repo}/git/ref/tags/${encodeURIComponent(tag)}`);
  if (ref?.ref !== 'refs/tags/' + tag) return null;
  let target = ref.object;
  for (let depth = 0; depth < 5 && isSha(target?.sha); depth++) {
    if (target.type === 'commit') return target.sha;
    if (target.type !== 'tag') return null;
    target = (await githubObject(request, `${repo}/git/tags/${target.sha}`))?.object;
  }
  return null;
}

async function releaseTag(request, repo, releases, tag) {
  const alias = /^v\d+(?:\.\d+)?$/.test(tag);
  const published = releases.some((entry) => entry.tag_name === tag);
  const candidates = alias && !published ? releases.filter((entry) => entry.tag_name.startsWith(tag + '.') &&
    /^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(entry.tag_name)) : [];
  if (!published && !candidates.length) return { status: 'fail' };
  const sha = await resolveTag(request, repo, tag);
  if (!sha) return { status: 'unknown' };
  if (published) return { status: 'pass', sha };
  let unresolved = false;
  for (const entry of candidates) {
    const target = await resolveTag(request, repo, entry.tag_name);
    if (target === sha) return { status: 'pass', sha };
    if (!target) unresolved = true;
  }
  return { status: unresolved ? 'unknown' : 'fail' };
}

const combine = (values) => values.includes('fail') ? 'fail' : values.includes('unknown') ? 'unknown' : 'pass';

export async function pinFacts(request, changes, messages) {
  const claims = [];
  const tags = [];
  const pins = [];
  const cache = new Map();
  for (const { action, ref } of changes) {
    const claim = versionClaim(action, messages);
    claims.push(claim === null ? 'unknown' : 'pass');
    if (!claim) {
      tags.push('unknown');
      pins.push('unknown');
      continue;
    }
    const repo = 'repos/' + action;
    if (!cache.has(repo)) cache.set(repo, githubPages(request, repo + '/releases', {}, null,
      (release) => typeof release?.tag_name === 'string' && typeof release.draft === 'boolean' &&
        (release.draft || Number.isFinite(Date.parse(release.published_at))) ? release.tag_name : null));
    const releases = (await cache.get(repo))?.filter((item) => !item.draft);
    if (!releases) {
      tags.push('unknown');
      pins.push('unknown');
      continue;
    }
    const names = [claim, 'v' + claim].filter((name) =>
      releases.some((entry) => entry.tag_name === name) || /^v\d+(?:\.\d+)?$/.test(name));
    const results = await Promise.all(names.map((name) => releaseTag(request, repo, releases, name)));
    const valid = results.filter(({ status }) => status === 'pass');
    const sha = valid[0]?.sha;
    const claimed = results.some(({ status }) => status === 'unknown') || valid.some((item) => item.sha !== sha)
      ? 'unknown' : sha ? 'pass' : 'fail';
    const actual = isSha(ref) ? { status: 'pass', sha: ref } : await releaseTag(request, repo, releases, ref);
    tags.push(combine([claimed, actual.status]));
    pins.push(claimed === 'pass' && actual.status === 'pass' ? (actual.sha === sha ? 'pass' : 'fail') : 'unknown');
  }
  return { claims: combine(claims), releaseTags: combine(tags), pins: combine(pins) };
}
