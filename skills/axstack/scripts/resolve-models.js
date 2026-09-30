import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const path = option('--catalog');
const modelClass = option('--class');
const effort = option('--effort');
const excluded = args.flatMap((arg, index) => arg === '--exclude' ? [args[index + 1]] : []);

try {
  if (!path || !['astra', 'sol', 'luna'].includes(modelClass) || !effort) {
    throw new Error('expected --catalog path --class astra|sol|luna --effort level');
  }
  if (excluded.some((slug) => !slug || slug.startsWith('--'))) {
    throw new Error('expected slug after --exclude');
  }
  const catalog = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(catalog.models) || typeof catalog.client_version !== 'string'
    || typeof catalog.fetched_at !== 'string') {
    throw new Error('malformed catalog');
  }
  const classPattern = new RegExp(`^gpt-(\\d+(?:\\.\\d+)*)-${modelClass}$`);
  const candidates = catalog.models
    .filter((entry) => entry && entry.visibility === 'list'
      && typeof entry.slug === 'string'
      && classPattern.test(entry.slug)
      && !excluded.includes(entry.slug)
      && Array.isArray(entry.supported_reasoning_levels)
      && entry.supported_reasoning_levels.some((level) => level?.effort === effort))
    .map((entry) => entry.slug)
    .sort((left, right) => {
      const a = left.slice(4, -(modelClass.length + 1)).split('.').map(Number);
      const b = right.slice(4, -(modelClass.length + 1)).split('.').map(Number);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const difference = (b[i] ?? 0) - (a[i] ?? 0);
        if (difference) return difference;
      }
      return 0;
    });
  if (!candidates.length) throw new Error(`no eligible ${modelClass} model in catalog`);
  console.log(JSON.stringify({
    provider: 'codex', modelClass, effort, model: candidates[0], candidates,
    catalog: { path, client_version: catalog.client_version, fetched_at: catalog.fetched_at },
  }));
} catch (error) {
  console.error(`model catalog resolution hold: ${error.message}`);
  process.exitCode = 1;
}
