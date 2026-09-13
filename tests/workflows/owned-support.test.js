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

const OWNED = ['axstack-research', 'axstack-docs', 'axstack-handoff'];

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

test('owned-support: three owned skills exist with SKILL.md', () => {
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

test('owned-support: independently callable via shared references', () => {
  for (const name of OWNED) {
    const text = readSkill(name);
    for (const ref of ['../axstack/references/paseo-launch.md', '../axstack/references/contracts.md']) {
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
    'axstack-explore-codebase',
    'axstack-explore-execution',
  ]) {
    expect(text.includes(profile), `research must list route ${profile}`).toBeTruthy();
  }
  expect(/data preset|confirm.*launch|availability.*launch/i.test(text), 'routes are data presets; live availability per shared launch').toBeTruthy();
});

test('owned-support: docs separates prose from visual verification', () => {
  const text = readSkill('axstack-docs');
  const lower = text.toLowerCase();
  for (const profile of ['axstack-docs', 'axstack-explainer', 'axstack-explainer-review']) {
    expect(text.includes(profile), `docs must list route ${profile}`).toBeTruthy();
  }
  expect(/no mandatory intermediate artifact|without.*intermediate/i.test(text), 'prose must not require a mandatory intermediate artifact').toBeTruthy();
  expect(/no mandatory html|html.*not required|prose.*without html/i.test(text), 'prose must not mandate HTML').toBeTruthy();
  expect(/self-contained html|requested artifact/i.test(text), 'visual must be self-contained HTML or the requested artifact').toBeTruthy();
  expect(/explicit.*theme|theme.*explicit/i.test(text), 'explicit user theme must win').toBeTruthy();
  expect(/dark/i.test(text), 'dark default theme must be stated').toBeTruthy();
  expect(/desktop/i.test(text) && /mobile/i.test(text), 'visual QA must cover desktop and mobile rendering').toBeTruthy();
  expect(/accessibility|reduced-motion|reduced motion/i.test(text), 'visual QA must cover interaction/accessibility/reduced-motion').toBeTruthy();
  expect(/missing|unavailable/i.test(text), 'unavailable browser evidence must be reported, not fabricated').toBeTruthy();
  expect(/invalidate|exact artifact/i.test(text), 'changed artifact must invalidate affected review').toBeTruthy();
  expect(/publish/i.test(text), 'local output vs publish authority must be distinct').toBeTruthy();
  expect(lower.includes('source'), 'material claims must be source-checked').toBeTruthy();
});

test('owned-support: handoff is explicit, compact, and non-destructive', () => {
  const text = readSkill('axstack-handoff');
  const lower = text.toLowerCase();
  expect(/recipient acceptance|accepted by/i.test(text), 'transfer must change driver only through recipient acceptance').toBeTruthy();
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
  expect(hasFrontmatter('---\nname: axstack-docs\ndescription: ok\n---\nbody'), 'good frontmatter must pass').toBeTruthy();
  expect(
    linkEscapesBundle(skillsDir, join(skillsDir, 'axstack-docs'), '../../elsewhere/x.md'),
    'escaping link must be flagged',
  ).toBe(true);
  expect(
    linkEscapesBundle(skillsDir, join(skillsDir, 'axstack-docs'), '../axstack/references/contracts.md'),
    'shared reference link must pass',
  ).toBe(false);
});
