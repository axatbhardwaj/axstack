import { readFileSync } from 'node:fs';

const bindings = { codex: 'codex', claude: 'claudeAgent', grok: 'grok', antigravity: 'antigravity' };
const effortIds = { codex: 'reasoningEffort', claude: 'effort', grok: 'reasoningEffort' };
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

function argumentsFrom(args) {
  const options = { excluded: [] };
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    if (!['--provider', '--capabilities', '--class', '--model', '--effort', '--exclude'].includes(flag)) {
      throw new Error(`unexpected argument ${flag}`);
    }
    const value = args[i + 1];
    if (!nonempty(value) || value.startsWith('--')) throw new Error(`expected value after ${flag}`);
    if (flag === '--exclude') options.excluded.push(value);
    else {
      const key = flag.slice(2);
      if (key in options) throw new Error(`duplicate argument ${flag}`);
      options[key] = value;
    }
  }
  if (!options.provider || !options.capabilities || !options.effort) {
    throw new Error('expected --provider codex|claude|grok|antigravity --capabilities path --effort level');
  }
  return options;
}

function providerFrom(catalog, provider) {
  if (!Array.isArray(catalog?.providers) || catalog.providers.some((p) =>
    !p || !nonempty(p.providerInstanceId) || !nonempty(p.driverKind))) {
    throw new Error('malformed capabilities providers');
  }
  const matches = catalog.providers.filter((p) => p.providerInstanceId === bindings[provider]);
  if (matches.length !== 1 || matches[0].driverKind !== bindings[provider]) {
    throw new Error(`unknown or ambiguous provider instance ${bindings[provider]}`);
  }
  const instance = matches[0];
  if (!Array.isArray(instance.models) || instance.models.some((model) =>
    !model || !nonempty(model.id) || !Array.isArray(model.options) || model.options.some((option) =>
      !option || !nonempty(option.id) || (option.options !== undefined &&
        (!Array.isArray(option.options) || option.options.some((value) => !value || !nonempty(value.id))))))) {
    throw new Error('malformed capabilities models or options');
  }
  return instance;
}

function modelFrom(models, { provider, model: pin, class: modelClass, excluded }) {
  if (pin && pin !== 'null') {
    const model = models.find((model) => model.id === pin && !excluded.includes(model.id));
    if (!model) throw new Error(`missing requested model ${pin}`);
    return model;
  }
  if (!pin && !modelClass) throw new Error('expected --class or --model (use --model null for a null role)');
  if (!modelClass) {
    // A null-model role binds the first listed ID; exclusions never pick a default substitute.
    const model = models[0];
    if (!model || excluded.includes(model.id)) throw new Error('missing first listed model');
    return model;
  }
  if (!['codex', 'claude'].includes(provider) || !/^[a-z]+$/.test(modelClass)) {
    throw new Error(`unsupported model class ${modelClass} for ${provider}`);
  }
  const pattern = provider === 'codex'
    ? new RegExp(`^gpt-(\\d+(?:\\.\\d+)*)-${modelClass}$`)
    : new RegExp(`^claude-${modelClass}-(\\d+-\\d+)$`);
  const candidates = models.filter((model) => pattern.test(model.id) && !excluded.includes(model.id));
  candidates.sort((a, b) => {
    const left = a.id.match(pattern)[1].split(/[.-]/).map(Number);
    const right = b.id.match(pattern)[1].split(/[.-]/).map(Number);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const difference = (right[i] ?? 0) - (left[i] ?? 0);
      if (difference) return difference;
    }
    return 0;
  });
  if (!candidates.length) throw new Error(`no matching ${modelClass} model for ${provider}`);
  return candidates[0];
}

try {
  const options = argumentsFrom(process.argv.slice(2));
  const { provider, capabilities: path, effort } = options;
  if (!Object.hasOwn(bindings, provider)) throw new Error(`unknown provider ${provider}`);
  const catalog = JSON.parse(readFileSync(path, 'utf8'));
  const instance = providerFrom(catalog, provider);
  const model = modelFrom(instance.models, options);
  const effortOptions = model.options.filter((option) => effortIds[provider]
    ? option.id === effortIds[provider] : ['reasoningEffort', 'effort'].includes(option.id));
  if (effortOptions.length !== 1 || !effortOptions[0].options?.some((value) => value.id === effort)
    || (provider === 'grok' && effort === 'max')) {
    throw new Error(`unsupported effort ${effort} for ${provider}/${model.id}`);
  }
  console.log(JSON.stringify({ provider, providerInstanceId: instance.providerInstanceId,
    model: model.id, effortOption: { id: effortOptions[0].id, value: effort }, source: 'capabilities', path }));
} catch (error) {
  console.error(`model capabilities resolution hold: ${error.message}`);
  process.exitCode = 1;
}
