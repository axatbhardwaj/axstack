const PROVIDER_BOUNDS = Object.freeze({
  mixed: new Set(['codex', 'claude', 'grok']),
  'codex-only': new Set(['codex']),
  'claude-only': new Set(['claude']),
});

const AUTHORED_ROUTES = Object.freeze({
  mixed: {
    'codex/gpt-5.6-sol': ['axstack-reviewer-secondary', 'claude/claude-opus-5', 'medium'],
    'claude/claude-opus-5': ['axstack-reviewer-primary', 'codex/gpt-5.6-sol', 'medium'],
  },
  'codex-only': {
    'codex/gpt-5.6-sol': ['axstack-reviewer-secondary', 'codex/gpt-5.6-terra', 'xhigh'],
  },
  'claude-only': {
    'claude/claude-opus-5': ['axstack-reviewer-secondary', 'claude/claude-sonnet-5', 'xhigh'],
  },
});

export function assertBundleRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new Error('invalid bundle roles: expected a non-empty roles array');
  }
  const ids = new Set();
  for (const role of roles) {
    if (!role || typeof role !== 'object' || Array.isArray(role)) {
      throw new Error('invalid bundle roles: every role must be an object');
    }
    for (const field of ['id', 'name', 'provider']) {
      if (typeof role[field] !== 'string' || role[field].trim() === '') {
        throw new Error(`invalid bundle roles: every role needs a non-empty ${field} string`);
      }
    }
    if (!role.id.startsWith('axstack-')) {
      throw new Error('invalid bundle roles: every role needs a namespaced axstack-* id');
    }
    if (ids.has(role.id)) throw new Error(`invalid bundle roles: duplicate role ID ${role.id}`);
    ids.add(role.id);
    if (!Object.hasOwn(role, 'model')) {
      throw new Error('invalid bundle roles: model must be a non-empty string or explicit null');
    }
    if (role.model !== null && (typeof role.model !== 'string' || role.model.trim() === '')) {
      throw new Error('invalid bundle roles: model must be a non-empty string or explicit null');
    }
    for (const field of ['icon', 'color', 'modeId', 'thinkingOptionId', 'notes']) {
      if (role[field] !== undefined && typeof role[field] !== 'string') {
        throw new Error(`invalid bundle roles: ${field} must be a string when present`);
      }
    }
    if (
      role.featureValues !== undefined &&
      (typeof role.featureValues !== 'object' || role.featureValues === null || Array.isArray(role.featureValues))
    ) {
      throw new Error('invalid bundle roles: featureValues must be an object when present');
    }
  }
}

export function assessRoleReadiness(roles, preset) {
  assertBundleRoles(roles);
  const bounds = PROVIDER_BOUNDS[preset];
  if (!bounds) throw new Error(`cannot assess readiness for unknown preset: ${preset}`);
  const byId = new Map(roles.map((role) => [role.id, role]));
  const gaps = [];
  const isIntentionalAbsence = (role) => role.model === null && (
    (preset === 'mixed' && role.id === 'axstack-checker') ||
    (preset === 'mixed' && role.id === 'axstack-research-x' && role.provider === 'grok') ||
    (preset === 'codex-only' && ['axstack-advisor-fable', 'axstack-arena-judge-fable', 'axstack-research-x'].includes(role.id)) ||
    (preset === 'claude-only' && ['axstack-advisor-astra', 'axstack-arena-judge-astra', 'axstack-research-x'].includes(role.id))
  );
  for (const role of roles) {
    if (!bounds.has(role.provider)) {
      gaps.push(`${role.id} provider ${JSON.stringify(role.provider)} is outside ${preset} bounds (${[...bounds].join('|')})`);
    }
    if (!isIntentionalAbsence(role) && (typeof role.model !== 'string' || role.model.trim() === '')) {
      gaps.push(`${role.id} requires a configured model`);
    }
  }

  for (const id of ['axstack-reviewer-opus', 'axstack-reviewer-sol']) {
    if (byId.has(id)) gaps.push(`legacy reviewer remains: ${id}`);
  }
  const primary = byId.get('axstack-reviewer-primary');
  const secondary = byId.get('axstack-reviewer-secondary');
  if (primary && secondary) {
    if (primary.model === secondary.model) gaps.push('reviewer pair must use two distinct models');
    if (preset === 'mixed' && primary.provider === secondary.provider) {
      gaps.push('mixed reviewer pair must use different providers');
    }
  }

  const author = byId.get('axstack-author');
  if (author) {
    const authorRoute = `${author.provider}/${author.model}`;
    const route = AUTHORED_ROUTES[preset]?.[authorRoute];
    if (!route) {
      gaps.push(`authored routing gap: unsupported axstack-author route ${authorRoute}`);
    } else {
      const [reviewerId, reviewerRoute, effort] = route;
      const reviewer = byId.get(reviewerId);
      if (!reviewer || `${reviewer.provider}/${reviewer.model}` !== reviewerRoute || reviewer.thinkingOptionId !== effort) {
        gaps.push(`authored routing gap: ${reviewerId} must be ${reviewerRoute}/${effort} for author ${authorRoute}`);
      }
    }
  }
  return { ready: gaps.length === 0, gaps };
}

export function installedRoleBytes(preset, roles) {
  return Buffer.from(JSON.stringify({ version: 1, preset, roles }, null, 2) + '\n');
}

export function assessInstalledRoleSnapshot(bytes, expectedPreset, expectedRoles) {
  let snapshot;
  try {
    snapshot = JSON.parse(bytes.toString());
  } catch {
    return { ready: false, gaps: ['installed axstack/roles.json is not valid JSON'] };
  }
  if (snapshot?.version !== 1 || snapshot?.preset !== expectedPreset || !Array.isArray(snapshot?.roles)) {
    return {
      ready: false,
      gaps: [`installed role snapshot must be version 1 for preset ${expectedPreset}`],
    };
  }
  try {
    assertBundleRoles(expectedRoles);
    const readiness = assessRoleReadiness(snapshot.roles, expectedPreset);
    const installedIds = new Set(snapshot.roles.map((role) => role.id));
    const expectedIds = new Set(expectedRoles.map((role) => role.id));
    const gaps = [];
    for (const role of expectedRoles) {
      if (!installedIds.has(role.id)) gaps.push(`missing selected bundle role: ${role.id}`);
    }
    for (const role of snapshot.roles) {
      if (!expectedIds.has(role.id)) gaps.push(`unexpected installed role: ${role.id}`);
    }
    gaps.push(...readiness.gaps);
    return { ready: gaps.length === 0, gaps };
  } catch (error) {
    return { ready: false, gaps: [error.message] };
  }
}
