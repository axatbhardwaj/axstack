export const driverInversions = {
  "dispatch plan pointer": [[/\b(?:run|invoke)\b/i, 'skip'], [/recorded role snapshot/i, 'new role selection'], [/saved capabilities/i, 'live capabilities']],
  "null ID receipt": [[/null.model/i, 'pinned-model'], [/from the plan/i, 'from the provider default']],
  "dispatch verification pointer": [[/\b(?:run|invoke)\b/i, 'skip'], [/same plan inputs/i, 'different plan inputs']],
};

