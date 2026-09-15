import { test, expect } from 'bun:test';
// Filesystem access uses the approved narrow exception: node:fs and
// node:fs/promises are Bun-implemented built-ins. No Node.js runtime is
// required. Path handling below is local (import.meta.dir), not node:.
import { readFileSync, existsSync } from 'node:fs';

function dirname(p) {
  const clean = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  const i = clean.lastIndexOf('/');
  if (i < 0) return '.';
  if (i === 0) return '/';
  return clean.slice(0, i);
}

function splitSegs(p) {
  return p.split('/').filter((s) => s !== '');
}

function normalizeSegs(segs) {
  const out = [];
  for (const s of segs) {
    if (s === '.' || s === '') continue;
    else if (s === '..') out.pop();
    else out.push(s);
  }
  return out;
}

function join(...parts) {
  const absolute = parts.length > 0 && parts[0].startsWith('/');
  return (absolute ? '/' : '') + normalizeSegs(parts.flatMap(splitSegs)).join('/');
}

const here = import.meta.dir;
const root = dirname(dirname(here));
const skillsDir = join(root, 'skills');

function skill(name) {
  const dir = join(skillsDir, name);
  const main = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  // Conditional branch rules may live in files explicitly linked by this skill.
  const local = [...main.matchAll(/\]\((references\/[^)#]+)(?:#[^)]*)?\)/g)]
    .map((match) => match[1]);
  return [main, ...new Set(local)].map((value, index) =>
    index === 0 ? value : readFileSync(join(dir, value), 'utf8')).join('\n').replace(/\s+/g, ' ');
}

// NOTE: interface/invariant checks only. They verify packaging and stated
// contracts, not instruction-following behavior (same boundary as the
// structural checks; behavioral evidence comes from scenario evaluation).

test('owned-core: shared routing and lifecycle/receipt references exist and are loaded', () => {
  for (const ref of ['orca-runtime.md', 'contracts.md', 'routing.md', 'lifecycle.md']) {
    expect(
      existsSync(join(skillsDir, 'axstack', 'references', ref)),
      `missing shared reference skills/axstack/references/${ref}`,
    ).toBeTruthy();
  }
  for (const name of ['axstack', 'axstack-review', 'axstack-watch']) {
    const text = skill(name);
    expect(
      text.includes('references/routing.md'),
      `${name}: must explicitly load shared routing reference`,
    ).toBeTruthy();
    expect(
      text.includes('references/lifecycle.md'),
      `${name}: must explicitly load shared lifecycle/receipt reference`,
    ).toBeTruthy();
  }
});

test('owned-core: entry routes research/explain/improve/handoff directly without spec ceremony', () => {
  const text = skill('axstack');
  for (const name of ['axstack-research', 'axstack-explain', 'axstack-improve', 'orca-cli']) {
    expect(text.includes(name), `entry must route directly to ${name}`).toBeTruthy();
  }
  expect(
    /research/i.test(text) && /explain/i.test(text) && /improve/i.test(text) && /handoff/i.test(text) && /no spec ceremony|without[^.]*spec|no[^.]*spec[^.]*ceremony/i.test(text),
    'entry must state research/explain/improve/handoff need no spec ceremony',
  ).toBeTruthy();
});

test('owned-core: review peer mode accepts linked intent without Axstack spec', () => {
  const text = skill('axstack-review');
  expect(/peer/i.test(text), 'review must name a peer (colleague PR) mode').toBeTruthy();
  expect(
    /linked issue/i.test(text),
    'peer mode must accept the linked issue as intent',
  ).toBeTruthy();
  expect(
    /no Axstack(-created)? approved\s+spec|without.*(new|Axstack) spec|does not demand.*spec/i.test(text),
    'peer mode must not demand an Axstack-created approved spec',
  ).toBeTruthy();
  expect(
    /missing|contradictory/i.test(text) && /coverage/i.test(text),
    'peer mode must report missing/contradictory intent as incomplete coverage',
  ).toBeTruthy();
});

test('owned-core: review authored mode keeps baseline; adopted scope needs no repeated approval', () => {
  const text = skill('axstack-review');
  expect(/authored/i.test(text), 'review must name an authored mode').toBeTruthy();
  expect(
    /adopt/i.test(text),
    'authored mode must cover adopting an existing PR',
  ).toBeTruthy();
  expect(
    /without repeated approval|accepted without.*approval|snapshot.*accepted/i.test(text),
    'adopted maintenance scope snapshot must be accepted without repeated approval',
  ).toBeTruthy();
});

test('owned-core: mode-specific independent review keeps exact rev, isolation, and owner validation', () => {
  const text = skill('axstack-review');
  expect(/peer[\s\S]*exactly two/i.test(text), 'peer mode must require exactly two final reviewers').toBeTruthy();
  expect(/authored[\s\S]*exactly one|authored[\s\S]*one independent/i.test(text), 'authored mode must require one independent cross-family reviewer').toBeTruthy();
  expect(/same.*six-angle|six-angle.*same|identical.*six-angle/i.test(text), 'peer reviewers must get the same six-angle brief').toBeTruthy();
  expect(/exact[\s\S]*revision|exact[\s\S]*sha/i.test(text), 'review must bind to the exact revision').toBeTruthy();
  expect(
    /no.*cross-read|without.*cross-read|neither reviewer reads the\s+other[’']s initial findings/is.test(text),
    'must forbid first-pass cross-reading between reviewers',
  ).toBeTruthy();
  expect(/without vot/i.test(text), 'owner must validate findings without voting').toBeTruthy();
});

test('owned-core: owner publishes and confirms the candidate before review', () => {
  const implement = skill('axstack-implement');
  const publication = readFileSync(join(skillsDir, 'axstack', 'references', 'candidate-publication.md'), 'utf8');
  const review = skill('axstack-review');

  expect(implement).toMatch(/owner[^.]*reconcil[^.]*receipt/i);
  expect(implement).toMatch(/gh stack[^.]*push|push[^.]*gh stack/i);
  expect(implement).toMatch(/remote[^.]*readback[^.]*review/i);
  expect(publication).toMatch(/local[^.]*green[^.]*CI[^.]*pending/i);
  expect(publication).toMatch(/owner[^.]*does not edit[^.]*candidate/i);
  expect(publication).toMatch(/expected-old[^.]*remote[^.]*SHA/i);
  expect(publication).toMatch(/candidate[^.]*base[^.]*remote ref[^.]*confirmed remote SHA[^.]*CI/is);
  expect(review).toMatch(/remote[^.]*confirm[^.]*candidate SHA[^.]*before[^.]*dispatch/i);
});

test('owned-core: report-only writes nothing; authorized submit binds commit and verifies receipt', () => {
  const text = skill('axstack-review');
  expect(
    /report-only/i.test(text) && /no GitHub writes|no external|writes nothing/i.test(text),
    'report-only must state explicitly that no GitHub writes occur',
  ).toBeTruthy();
  expect(
    /submit/i.test(text) && /authoriz/i.test(text),
    'must gate consolidated peer review submission on authorization',
  ).toBeTruthy();
  expect(
    /bind.*commit|commit.*bind/i.test(text),
    'submission must bind the commit under review',
  ).toBeTruthy();
  expect(
    /verify.*receipt|receipt.*verif/i.test(text),
    'submission must verify the review receipt',
  ).toBeTruthy();
  expect(
    /ambiguous/i.test(text) && /lookup\s+before\s+retry|look\s+up\s+before\s+retry/i.test(text),
    'ambiguous submission must require lookup before retry',
  ).toBeTruthy();
  expect(
    /peer code[\s\S]*readonly|readonly[\s\S]*peer/i.test(text),
    'peer code must remain readonly',
  ).toBeTruthy();
});

test('owned-core: prompt-only escalation with optional relay and concrete chat fallback', () => {
  const text = skill('axstack-review');
  expect(/prompt-only/i.test(text), 'escalation must stay prompt-only').toBeTruthy();
  expect(
    /optional/i.test(text) && /relay/i.test(text),
    'relay must be optional and configured',
  ).toBeTruthy();
  expect(
    /chat[\s\S]*fallback|fallback[\s\S]*chat/i.test(text),
    'must name a concrete chat fallback when relay delivery fails',
  ).toBeTruthy();
});

test('owned-core: watch adopts existing PR; observation-only dispatches nothing writable', () => {
  const text = skill('axstack-watch');
  expect(/adopt/i.test(text), 'watch must adopt an existing PR').toBeTruthy();
  expect(
    /observation-only|monitoring-only/i.test(text),
    'watch must name an observation-only mode',
  ).toBeTruthy();
  expect(
    /no author|without.*author|never.*author/i.test(text),
    'observation-only dispatch must launch no author',
  ).toBeTruthy();
  expect(
    /no reply|without.*reply|never.*repl/i.test(text),
    'observation-only dispatch must send no reply',
  ).toBeTruthy();
});

test('owned-core: authorized repairs use original author with reviewed code and exact text', () => {
  const text = skill('axstack-watch');
  expect(
    /original author|same author/i.test(text),
    'authorized repairs must reuse the original author',
  ).toBeTruthy();
  expect(
    /exact[\s\S]*(reply|response|public)[\s\S]*(text|bodies)|exact text/i.test(text),
    'authorized publication requires the exact public reply text reviewed',
  ).toBeTruthy();
  expect(
    /fresh/i.test(text) && /remote head|head.*base|base.*head/i.test(text),
    'must confirm fresh remote head/base before publication',
  ).toBeTruthy();
  expect(
    /feedback/i.test(text),
    'must confirm fresh review feedback before publication',
  ).toBeTruthy();
  expect(
    /gh stack/i.test(text) && /no overwrite|scoped|without.*overwrit|adopted PR only, preserving unrelated stack entries/i.test(text) && /expected-old SHA[^.]*mismatch holds publication/i.test(text),
    'delivery must be gh stack scoped with no overwrite',
  ).toBeTruthy();
  expect(
    /receipt/i.test(text),
    'publication must verify the review receipt',
  ).toBeTruthy();
});

test('owned-core: one persistent owner; native watch roles stay held without capability', () => {
  const text = skill('axstack-watch');
  expect(
    /one (persistent )?owner/i.test(text),
    'must keep one persistent owner per PR',
  ).toBeTruthy();
  expect(/monitor/i.test(text) && /watchdog/i.test(text), 'must name monitor and watchdog roles').toBeTruthy();
  expect(
    /independent/i.test(text) && /read-only/i.test(text),
    'monitor/watchdog must be independent and read-only',
  ).toBeTruthy();
  expect(/native Orca/i.test(text), 'watch must name the native Orca boundary').toBeTruthy();
  expect(/capability hold|activation[^.]*hold/i.test(text), 'watch activation must remain held').toBeTruthy();
  expect(/handshake/i.test(text), 'must require initial verified handshakes').toBeTruthy();
  expect(
    /snapshot-only|healthy ticks/i.test(text),
    'healthy ticks must be snapshot-only',
  ).toBeTruthy();
  expect(/dedup/i.test(text), 'must deduplicate event IDs').toBeTruthy();
  expect(
    /uncertain/i.test(text) && /reconcil/i.test(text),
    'uncertain sends must be reconciled',
  ).toBeTruthy();
  expect(/restart/i.test(text) && /reuse/i.test(text), 'restart must reuse prior state').toBeTruthy();
});

test('owned-core: shared 24h deadline covers open PRs; merge-ready distinct from merged', () => {
  const text = skill('axstack-watch');
  expect(/24h|24-hour|24 hour/i.test(text), 'must state the 24h default deadline').toBeTruthy();
  expect(/open PR/i.test(text), 'deadline must explicitly cover open PRs').toBeTruthy();
  expect(
    /no silent renewal|never.*renew/i.test(text),
    'must forbid silent renewals',
  ).toBeTruthy();
  expect(
    /merge-ready.*(distinct|not|observed)|observed state/i.test(text),
    'merge-ready must be distinct from merged',
  ).toBeTruthy();
  expect(
    /human.*merg|merg.*human/i.test(text),
    'human merge authority must be stated',
  ).toBeTruthy();
});

test('owned-core: owned skills stay compact references, no daemon or programmatic gate', () => {
  for (const name of ['axstack', 'axstack-review', 'axstack-watch']) {
    const text = skill(name);
    expect(
      /(?:create|build|introduce|ship|run)\s+(?:a\s+|new\s+)?daemon/i.test(text),
      `${name}: must not introduce a daemon`,
    ).toBe(false);
    expect(/state machine/i.test(text), `${name}: must not introduce a state machine`).toBe(false);
    expect(
      /programmatic gate|decision engine/i.test(text),
      `${name}: must not introduce a programmatic gate/engine`,
    ).toBe(false);
  }
  for (const ref of ['routing.md', 'lifecycle.md']) {
    const text = readFileSync(join(skillsDir, 'axstack', 'references', ref), 'utf8');
    expect(text.length, `${ref} must stay compact (<7500 chars)`).toBeLessThan(7500);
  }
});

test('owned-core: all presets expose stable configured role IDs', () => {
  const expectedIds = JSON.parse(readFileSync(join(root, 'profiles/presets/mixed.json'), 'utf8'))
    .roles.map(({ id }) => id);
  expect(expectedIds).toHaveLength(18);
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const data = JSON.parse(readFileSync(join(root, `profiles/presets/${preset}.json`), 'utf8'));
    expect(data.roles.map(({ id }) => id)).toEqual(expectedIds);
    expect(data.roles.some(({ id }) => /reviewer-(?:opus|sol)/.test(id))).toBe(false);
  }
});

test('owned-core: review separates mode-specific completeness from verdict; binds commit parameter', () => {
  const text = skill('axstack-review');
  expect(
    /complete[\s\S]*evidence/i.test(text) && /REQUEST_CHANGES/i.test(text),
    'complete mode-required evidence with validated defects must permit REQUEST_CHANGES',
  ).toBeTruthy();
  expect(
    /INCOMPLETE/i.test(text) && /never.*fabricat|no.*fabricat/i.test(text),
    'incomplete/stale review must never fabricate a verdict',
  ).toBeTruthy();
  expect(
    /urgent hold[\s\S]{0,400}not.*block.*report|report[\s\S]{0,200}validated risk/i.test(text),
    'urgent holds must not block reporting validated risk',
  ).toBeTruthy();
  expect(
    /commit parameter|commitSha/i.test(text),
    'submission must bind the actual GitHub commit parameter, not SHA text alone',
  ).toBeTruthy();
  expect(
    /internal verdict/i.test(text),
    'report-only must permit an internal verdict with no external writes',
  ).toBeTruthy();
});

test('owned-core: standalone review/watch materialize axstack-owner; workers never recurse', () => {
  const lifecycle = readFileSync(join(skillsDir, 'axstack/references/lifecycle.md'), 'utf8').replace(/\s+/g, ' ');
  expect(lifecycle).toMatch(/prefer[^.]*parallel[^.]*independent[^.]*bounded|prefer[^.]*independent[^.]*parallel[^.]*bounded/i);
  expect(lifecycle).toMatch(/no redundant workers/i);
  for (const name of ['axstack-review', 'axstack-watch']) {
    const text = skill(name);
    expect(text.includes('axstack-owner'), `${name}: must name axstack-owner materialization`).toBeTruthy();
    expect(
      /only[\s\S]*owner[\s\S]*launch/i.test(text),
      `${name}: only the owner launches writer/reviewers/monitor/watchdog`,
    ).toBeTruthy();
    expect(
      /no.*recursive|never.*recursive/is.test(text),
      `${name}: workers must launch no recursive teams`,
    ).toBeTruthy();
  }
  const watch = skill('axstack-watch');
  expect(
    /watcher.*never.*writ|never.*writer/i.test(watch),
    'adoption watcher itself must never be the writer',
  ).toBeTruthy();
  expect(
    /competing coordinator|no.*compet/i.test(watch),
    'current chat must avoid a competing coordinator',
  ).toBeTruthy();
});

test('owned-core: observation-only dominates every repair path; adoption verifies authority', () => {
  const text = skill('axstack-watch');
  expect(
    /dominat|every repair path/i.test(text),
    'observation-only restriction must dominate every repair path',
  ).toBeTruthy();
  expect(
    /writable ownership|maintenance authority/i.test(text),
    'adoption must verify writable ownership and user maintenance authority',
  ).toBeTruthy();
  expect(
    /peer mode[\s\S]{0,200}never/i.test(text),
    'peer mode must never repair',
  ).toBeTruthy();
});

test('owned-core: monitor/watchdog policy survives the native capability hold', () => {
  const text = skill('axstack-watch');
  expect(/5\s?min/i.test(text), 'monitor cadence default 5min must be stated').toBeTruthy();
  expect(/hourly/i.test(text), 'watchdog cadence default hourly must be stated').toBeTruthy();
  expect(/same[\s\S]*24h/i.test(text), 'both must share the same 24h expiry').toBeTruthy();
  expect(/Create no schedule|no production timer/i.test(text), 'held watch must create no schedule').toBeTruthy();
  expect(/dedup/i.test(text), 'actionable events must remain deduplicated').toBeTruthy();
  expect(
    /approval alone/i.test(text),
    'a review approval alone must not count as merge-ready',
  ).toBeTruthy();
});

test('owned-core: publication keys reply bodies to feedback IDs with freshness checks', () => {
  const text = skill('axstack-watch');
  expect(/feedback IDs/i.test(text), 'reply bodies must key to feedback IDs').toBeTruthy();
  expect(/expected-old/i.test(text), 'history rewrite needs expected-old SHA').toBeTruthy();
  expect(
    /body identity/i.test(text),
    'publication must verify reply body identity',
  ).toBeTruthy();
  expect(
    /remain blocked|stays blocked|stay blocked/i.test(text),
    'ambiguous send outcome must remain blocked',
  ).toBeTruthy();
});

test('owned-core: lifecycle carries roster, idle-complete protocol, and audit hook', () => {
  const text = readFileSync(join(skillsDir, 'axstack', 'references', 'lifecycle.md'), 'utf8');
  expect(/roster/i.test(text), 'lifecycle must include a compact roster').toBeTruthy();
  expect(/archive|retain/i.test(text), 'lifecycle must define idle-complete archive/retain').toBeTruthy();
  expect(/audit/i.test(text), 'lifecycle must define the end-of-run audit hook').toBeTruthy();
});

test('owned-core: align and spec use both configured advisers; auditor role exists', () => {
  for (const name of ['axstack-align', 'axstack-spec']) {
    const text = skill(name);
    for (const adviser of ['axstack-advisor-astra', 'axstack-advisor-fable']) {
      expect(text.includes(adviser), `${name}: must involve ${adviser}`).toBeTruthy();
    }
    expect(text).toMatch(/same bounded (?:evidence and question|question and evidence)/i);
    expect(text).toMatch(/independent/i);
    expect(text).toMatch(/disagree/i);
    expect(text).toMatch(/unchanged[^.]*receipt|receipt[^.]*unchanged/i);
  }
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    const data = JSON.parse(readFileSync(join(root, `profiles/presets/${preset}.json`), 'utf8'));
    const auditor = data.roles.find(({ id }) => id === 'axstack-auditor');
    expect(auditor, `${preset}: missing axstack-auditor`).toBeTruthy();
    expect(auditor.notes).toMatch(/readonly|read-only/i);
  }
});

test('owned-core: docs cover owned skills and role presets without upstream claims', () => {
  const workflows = readFileSync(join(root, 'docs', 'workflows.md'), 'utf8');
  for (const name of ['axstack', 'axstack-review', 'axstack-watch', 'axstack-research', 'axstack-explain', 'axstack-improve', 'orca-cli']) {
    expect(workflows.includes(name), `docs/workflows.md must reference ${name}`).toBeTruthy();
  }
  expect(/retir/i.test(workflows), 'workflows doc must note retiring skills reimplements nothing').toBeTruthy();
  for (const preset of ['mixed', 'codex-only', 'claude-only']) {
    expect(workflows.includes(preset), `docs/workflows.md must name ${preset}`).toBeTruthy();
  }
  expect(workflows).toMatch(/axstack-reviewer-primary/);
  expect(workflows).toMatch(/axstack-reviewer-secondary/);
  expect(workflows).toMatch(/active runs?[^.]*snapshot/i);
  expect(workflows).toMatch(/structural checks[^.]*not[^.]*agent behavior/i);
  const install = readFileSync(join(root, 'docs', 'installation.md'), 'utf8');
  expect(/Model presets|role presets/i.test(install), 'installation doc must document role presets').toBeTruthy();
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  expect(readme.includes('axstack-review'), 'README must reference axstack-review').toBeTruthy();
  expect(readme.includes('axstack-watch'), 'README must reference axstack-watch').toBeTruthy();
  expect(readme).toMatch(/profiles\/presets\/mixed\.json/);
  expect(readme).not.toMatch(/profiles\/paseo\.json/);
  expect(readme).toMatch(/reviewer-primary/);
  expect(readme).toMatch(/reviewer-secondary/);
  const spec = readFileSync(join(root, 'docs', 'specs', 'v1.md'), 'utf8');
  expect(spec).toMatch(/axstack-explain/);
  expect(spec).toMatch(/project documentation/i);
});
