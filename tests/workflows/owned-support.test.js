import { test, expect } from 'bun:test';
// Filesystem access uses the approved narrow exception: node:fs and
// node:fs/promises are Bun-implemented built-ins. No Node.js runtime is
// required. Path handling below is local (import.meta.dir), not node:.
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs';

// NOTE: structural checks only. They verify packaging, frontmatter, and
// relative-reference integrity of the owned support skills — not
// instruction-following behavior. Behavioral evidence comes from the fresh
// post-skill simulation owned by root.

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

function dirname(p) {
  const clean = p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  const i = clean.lastIndexOf('/');
  if (i < 0) return '.';
  if (i === 0) return '/';
  return clean.slice(0, i);
}

function resolve(from, rel) {
  if (rel.startsWith('/')) return '/' + normalizeSegs(splitSegs(rel)).join('/');
  return join(from, rel);
}

const here = import.meta.dir;
const root = dirname(dirname(here));
const skillsDir = join(root, 'skills');

const OWNED = ['axstack-research', 'axstack-explain', 'axstack-improve'];

function readSkill(name) {
  return readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8');
}

// Shared negative-fixture helpers: pure validators exercised against inline
// fixtures below, so no bad fixture file ever lands inside the bundle walk.
function hasFrontmatter(text) {
  return /^---\n[\s\S]*?\n---/.test(text);
}

function linkEscapesBundle(skillDir, fromDir, link) {
  if (/^(https?:|#|mailto:)/.test(link)) return false;
  const rel = link.split('#')[0];
  if (!rel) return false;
  const target = resolve(fromDir, rel);
  return !(target === skillDir || target.startsWith(skillDir + '/'));
}

test('owned-support: owned support skills exist with SKILL.md', () => {
  for (const name of OWNED) {
    const p = join(skillsDir, name, 'SKILL.md');
    expect(existsSync(p), `missing ${p}`).toBeTruthy();
    expect(lstatSync(p).isSymbolicLink(), `SKILL.md must not be a symlink: ${p}`).toBe(false);
  }
});

test('owned-support: frontmatter name matches directory with description', () => {
  for (const name of OWNED) {
    const text = readSkill(name);
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    expect(m, `${name}: missing YAML frontmatter block`).toBeTruthy();
    expect(m[1], `${name}: frontmatter name must match directory`).toMatch(
      new RegExp(`^name:\\s*${name}\\s*$`, 'm'),
    );
    expect(m[1], `${name}: frontmatter needs description`).toMatch(/^description:\s*\S+/m);
  }
});

test('owned-support: explain advertises the approved intent exactly', () => {
  const text = readSkill('axstack-explain');
  expect(text).toContain(
    'description: When understanding a system, change, or implementation gap, use axstack-explain to show how it works and what exists, is missing, or remains unverified.',
  );
});

test('owned-support: independently callable via shared references', () => {
  for (const name of OWNED) {
    const text = readSkill(name);
    for (const ref of ['../axstack/references/orca-runtime.md', '../axstack/references/contracts.md']) {
      expect(text.includes(ref), `${name}: must load shared reference ${ref}`).toBeTruthy();
    }
  }
});

test('owned-support: relative references resolve inside the bundle', () => {
  const bundleRoot = skillsDir + '/';
  for (const name of OWNED) {
    const dir = join(skillsDir, name);
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isSymbolicLink()) throw new Error(`escaping symlink not allowed: ${p}`);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && e.name.endsWith('.md')) {
          const text = readFileSync(p, 'utf8');
          const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((x) => x[1]);
          for (const link of links) {
            if (/^(https?:|#|mailto:)/.test(link)) continue;
            const rel = link.split('#')[0];
            if (!rel) continue;
            const target = resolve(dirname(p), rel);
            expect(target === skillsDir || target.startsWith(bundleRoot), `${p}: link escapes bundle: ${link}`).toBeTruthy();
            expect(existsSync(target), `${p}: linked file does not exist: ${link}`).toBeTruthy();
          }
        }
      }
    };
    walk(dir);
  }
});

test('owned-support: self-contained, no upstream skill dependency', () => {
  const forbidden = ['matt-pocock', 'poteto', 'haoshoku', '~/.agents', '/home/', '/Users/', 'C:\\'];
  for (const name of OWNED) {
    const dir = join(skillsDir, name);
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile()) {
          const text = readFileSync(p, 'utf8');
          for (const f of forbidden) {
            expect(text.includes(f), `${p} contains forbidden reference: ${f}`).toBe(false);
          }
        }
      }
    };
    walk(dir);
  }
});

test('owned-support: research is source-first with verified boundaries', () => {
  const text = readSkill('axstack-research');
  const lower = text.toLowerCase();
  for (const marker of ['primary source', 'bounded question', 'verified', 'unverified', 'inference']) {
    expect(lower.includes(marker), `research must state ${marker}`).toBeTruthy();
  }
  expect(/date|pin/i.test(text), 'research must date/pin claims when needed').toBeTruthy();
  expect(/markdown/i.test(text), 'research must produce a source-linked Markdown artifact').toBeTruthy();
  expect(/research-only/i.test(text), 'research-only must not require spec/tickets/author pipeline').toBeTruthy();
  expect(/direct/i.test(text), 'single direct lookup must stay direct').toBeTruthy();
  expect(/unless requested|only if requested/i.test(text), 'research must not write product code or publish unless requested').toBeTruthy();
  for (const profile of [
    'axstack-research-requirements',
    'axstack-research-code',
    'axstack-research-web',
    'axstack-research-web-google',
    'axstack-research-x',
    'axstack-explore-codebase',
    'axstack-explore-execution',
  ]) {
    expect(text.includes(profile), `research must list route ${profile}`).toBeTruthy();
  }
  expect(/data preset|confirm.*launch|availability.*launch/i.test(text), 'routes are data presets; live availability per shared launch').toBeTruthy();
});

test('owned-support: explain scales from direct answers to verified visuals', () => {
  const text = readSkill('axstack-explain');
  const lower = text.toLowerCase();
  for (const profile of ['axstack-explainer', 'axstack-explainer-review']) {
    expect(text.includes(profile), `explain must list route ${profile}`).toBeTruthy();
  }
  expect(/simple[^.]*current chat|current chat[^.]*simple/i.test(text), 'simple explanations must stay in the current chat').toBeTruthy();
  expect(/no mandatory agent|without.*agent|needs no.*agent/i.test(text), 'simple explanations must not require an agent').toBeTruthy();
  expect(/compact diagram|diagram.*useful/i.test(text), 'simple output may use a compact diagram when useful').toBeTruthy();
  expect(/self-contained html|requested artifact/i.test(text), 'visual must be self-contained HTML or the requested artifact').toBeTruthy();
  expect(/explicit[\s\S]*theme|theme[\s\S]*explicit/i.test(text), 'explicit user theme must win').toBeTruthy();
  expect(/dark/i.test(text), 'dark default theme must be stated').toBeTruthy();
  expect(/desktop/i.test(text) && /mobile/i.test(text), 'visual QA must cover desktop and mobile rendering').toBeTruthy();
  expect(/accessibility|reduced-motion|reduced motion/i.test(text), 'visual QA must cover interaction/accessibility/reduced-motion').toBeTruthy();
  expect(/missing|unavailable/i.test(text), 'unavailable browser evidence must be reported, not fabricated').toBeTruthy();
  expect(/invalidate|exact artifact/i.test(text), 'changed artifact must invalidate affected review').toBeTruthy();
  expect(/publish/i.test(text), 'local output vs publish authority must be distinct').toBeTruthy();
  expect(lower.includes('source'), 'material claims must be source-checked').toBeTruthy();
});

test('owned-support: explain caps the primary view without losing decisions', () => {
  const text = readSkill('axstack-explain');
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  expect(text).toMatch(/primary reader-facing explanation[^.]*maximum of 700 words/i);
  expect(text).toMatch(/chat[^.]*HTML[^.]*requested format/i);
  for (const essential of [
    'answer or purpose',
    'key rationale',
    'meaningful alternatives',
    'main data or operational boundary',
    'status and uncertainty',
    'live reader questions',
  ]) {
    expect(normalized).toContain(essential);
  }
  expect(normalized).toMatch(
    /live reader questions[^.]*answers[^.]*inspected evidence[^.]*(?:unknown|open)[^.]*rather than invent/i,
  );
  for (const counted of ['headings', 'table text', 'labels', 'captions']) {
    expect(normalized).toMatch(new RegExp(`reader-visible words[^.]*${counted}`, 'i'));
  }
  expect(normalized).toMatch(/(?:appendix|collapsible content)[^.]*same artifact[^.]*counts[^.]*700/i);
  expect(normalized).toMatch(/supporting detail[^.]*separate linked (?:ticket|appendix)/i);
  expect(normalized).toMatch(/essential answers[^.]*not[^.]*hid/i);
  expect(normalized).toMatch(/evidence[^.]*not[^.]*silently discard/i);
});

test('owned-support: explain distinguishes evidence and bounds every gap', () => {
  const text = readSkill('axstack-explain');
  for (const label of ['source implemented', 'tested', 'live observed', 'planned/proposed', 'unknown']) {
    expect(text.toLowerCase().includes(label), `explain must preserve ${label} evidence`).toBeTruthy();
  }
  expect(/coexist|independent/i.test(text), 'evidence dimensions must be independent and may coexist').toBeTruthy();
  expect(/gap[\s\S]{0,300}(inspected|scope)[\s\S]{0,240}(revision|stable source identity|content hash)/i.test(text), 'each gap must identify inspected scope and applicable stable source identity').toBeTruthy();
  expect(/stable source identity|content hash/i.test(text), 'non-versioned evidence must use a stable identity or content hash').toBeTruthy();
  expect(/non-versioned|screenshot|exported snippet/i.test(text), 'non-Git evidence must be explicitly supported').toBeTruthy();
  expect(/history[^.]*unavailable[^.]*limitation|unavailable history[^.]*limitation/i.test(text), 'unavailable history must be reported as a limitation').toBeTruthy();
  expect(/not found[\s\S]{0,180}(app-wide|whole app|entire app)[\s\S]{0,100}(without|unless)/i.test(text), 'not-found evidence must not become an app-wide absence claim').toBeTruthy();
});

test('owned-support: explain traces behavior without silently starting delivery', () => {
  const text = readSkill('axstack-explain');
  for (const marker of ['flow', 'boundaries', 'dependencies', 'current', 'intended', 'gap']) {
    expect(text.toLowerCase().includes(marker), `explain must cover ${marker}`).toBeTruthy();
  }
  expect(/project documentation|documentation/i.test(text), 'project documentation must remain supported').toBeTruthy();
  expect(/no automatic[^.]*design|does not[^.]*design/i.test(text), 'explanation must not automatically start design').toBeTruthy();
  expect(/no automatic[^.]*implementation|does not[^.]*implementation/i.test(text), 'explanation must not automatically start implementation').toBeTruthy();
  expect(/supersed[^.]*axstack-docs/i.test(text), 'new route must supersede a stale axstack-docs install').toBeTruthy();
});

test('owned-support: every HTML explanation triggers full exact-artifact QA', () => {
  const text = readSkill('axstack-explain');
  expect(/(?:any|every|the moment|when)[^.]*html[^.]*visual QA|html[^.]*full[^.]*visual QA/i.test(text), 'HTML must trigger full visual QA').toBeTruthy();
  expect(/desktop/i.test(text) && /mobile/i.test(text), 'HTML QA must cover desktop and mobile').toBeTruthy();
  expect(/interaction/i.test(text) && /accessibility/i.test(text) && /reduced-motion|reduced motion/i.test(text), 'HTML QA must cover interaction, accessibility, and reduced motion').toBeTruthy();
  expect(/public[\s\S]{0,240}(private|privacy|credential|identifier)/i.test(text), 'public artifacts must protect private data').toBeTruthy();
});

test('owned-support: role retirement and stale-upgrade migration are explicit', () => {
  const profiles = JSON.parse(readFileSync(join(root, 'profiles/presets/mixed.json'), 'utf8'));
  expect(profiles.roles.some(({ id }) => id === 'axstack-docs'), 'retired prose role must be absent').toBe(false);
  expect(profiles.roles.length, 'all current roles remain').toBe(24);
  const docs = readFileSync(join(root, 'docs', 'installation.md'), 'utf8') + '\n' +
    readFileSync(join(root, 'docs', 'workflows.md'), 'utf8');
  expect(docs).toMatch(/ordinary[^.]*upgrade[^.]*retain[^.]*axstack-docs/i);
  expect(docs).toMatch(/uninstall[^.]*install/i);
  expect(docs).toMatch(/edited|custom|unknown/i);
  expect(docs).toMatch(/without `--force`|no[^.]*--force/i);
});

test('owned-support: handoff is explicit, compact, and non-destructive', () => {
  const text = readFileSync(join(skillsDir, 'axstack/references/lifecycle.md'), 'utf8') + '\n' + readFileSync(join(skillsDir, 'axstack/references/run-record.md'), 'utf8');
  const lower = text.toLowerCase();
  expect(/recipient.s explicit\s+acceptance receipt before changing ownership/i.test(text), 'transfer must change driver only through recipient acceptance').toBeTruthy();
  for (const field of ['goal', 'scope', 'authority', 'revision', 'evidence', 'pending', 'unresolved']) {
    expect(lower.includes(field), `handoff record must include ${field}`).toBeTruthy();
  }
  expect(/resume|reconcile/i.test(text), 'must resume actual state before launching replacements').toBeTruthy();
  expect(/duplicate/i.test(text), 'must avoid duplicate writer/watch/replies').toBeTruthy();
  expect(/compact|pointer/i.test(text), 'must stay compact pointers, not a transcript dump').toBeTruthy();
  expect(/never.*archiv|no global sweep|idle alone/i.test(text), 'must never archive active/waiting workers or sweep on idle').toBeTruthy();
  expect(/scheduler|database/i.test(text), 'must state no new runtime database/scheduler').toBeTruthy();
});

test('owned-support negative fixtures: validators reject bad packaging', () => {
  expect(hasFrontmatter('# No frontmatter here'), 'missing frontmatter must fail').toBe(false);
  expect(hasFrontmatter('---\nname: axstack-explain\ndescription: ok\n---\nbody'), 'good frontmatter must pass').toBeTruthy();
  expect(
    linkEscapesBundle(skillsDir, join(skillsDir, 'axstack-explain'), '../../elsewhere/x.md'),
    'escaping link must be flagged',
  ).toBe(true);
  expect(
    linkEscapesBundle(skillsDir, join(skillsDir, 'axstack-explain'), '../axstack/references/contracts.md'),
    'shared reference link must pass',
  ).toBe(false);
});
