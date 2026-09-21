import { test, expect } from 'bun:test';
// Filesystem access uses the approved narrow exception: node:fs and
// node:fs/promises are Bun-implemented built-ins. No Node.js runtime is
// required. Path handling below is local (import.meta.dir), not node:.
import { readFileSync, existsSync, lstatSync, readdirSync } from 'node:fs';

// NOTE: structural checks only. They verify packaging, frontmatter,
// relative-reference integrity, declared audit scenarios, and preservation
// of the existing 12 scenarios — not instruction-following behavior.
// Behavioral evidence comes from a fresh model evaluation owned by root.

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
const auditDir = join(skillsDir, 'axstack-audit');

function readAudit() {
  return readFileSync(join(auditDir, 'SKILL.md'), 'utf8');
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

test('owned-audit: audit skill exists with SKILL.md and record schema', () => {
  const p = join(auditDir, 'SKILL.md');
  expect(existsSync(p), `missing ${p}`).toBeTruthy();
  expect(lstatSync(p).isSymbolicLink(), `SKILL.md must not be a symlink: ${p}`).toBe(false);
  const rec = join(auditDir, 'references', 'record.md');
  expect(existsSync(rec), `missing audit record schema ${rec}`).toBeTruthy();
});

test('owned-audit: frontmatter name matches directory with description', () => {
  const text = readAudit();
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  expect(m, 'axstack-audit: missing YAML frontmatter block').toBeTruthy();
  expect(m[1], 'frontmatter name must match directory').toMatch(/^name:\s*axstack-audit\s*$/m);
  expect(m[1], 'frontmatter needs description').toMatch(/^description:\s*\S+/m);
});

test('owned-audit: loads shared references like other owned skills', () => {
  const text = readAudit();
  for (const ref of ['../axstack/references/orca-runtime.md', '../axstack/references/contracts.md']) {
    expect(text.includes(ref), `must load shared reference ${ref}`).toBeTruthy();
  }
});

test('owned-audit: relative references resolve inside the bundle', () => {
  const bundleRoot = skillsDir + '/';
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
  walk(auditDir);
});

test('owned-audit: self-contained, no upstream skill dependency', () => {
  const forbidden = ['matt-pocock', 'poteto', 'haoshoku', '~/.agents', '/home/', '/Users/', 'C:\\'];
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
  walk(auditDir);
});

test('owned-audit: auditor is non-author readonly with no children', () => {
  const text = readAudit();
  const lower = text.toLowerCase();
  expect(lower.includes('non-author'), 'auditor must be a non-author').toBeTruthy();
  expect(lower.includes('readonly') || lower.includes('read-only'), 'auditor must be readonly').toBeTruthy();
  expect(/audit artifact/i.test(text), 'only the assigned audit artifact may be written').toBeTruthy();
  expect(/no edits to product|no.*product.*config/i.test(text), 'no edits to product/skills/config').toBeTruthy();
  expect(/no child/i.test(text), 'auditor launches no child sessions').toBeTruthy();
});

test('owned-audit: inspects the real run record, not memory', () => {
  const text = readAudit();
  const lower = text.toLowerCase();
  for (const marker of ['approved spec', 'peer', 'research', 'maintenance scope', 'decision log', 'receipt', 'git revision', 'test', 'review evidence', 'execution record']) {
    expect(lower.includes(marker), `auditor must inspect ${marker}`).toBeTruthy();
  }
});

test('owned-audit: cadence is bounded with no new runtime service', () => {
  const text = readAudit();
  const lower = text.toLowerCase();
  expect(/substantive run.*default|default.*substantive run/i.test(text), 'enabled per substantive run by default').toBeTruthy();
  expect(/checkpoint/i.test(text) && lower.includes('deviation'), 'checkpoint after material deviation').toBeTruthy();
  expect(/repair pattern/i.test(text), 'checkpoint after repair pattern when useful').toBeTruthy();
  expect(/reuse.*evidence|no repeated.*rescan/is.test(text), 'reuse audit evidence, no repeated whole-run rescans').toBeTruthy();
  expect(/compact audit record/i.test(text), 'routine small lookup may end with a compact audit record').toBeTruthy();
  expect(/never force|do not force/i.test(text), 'must not force the full implementation pipeline for research').toBeTruthy();
  expect(/no extra daemon|no.*daemon.*timer|no new runtime/is.test(text), 'no extra daemon/timer/analytics service').toBeTruthy();
});

test('owned-audit: metrics carry counts, denominators, and evidence', () => {
  const text = readAudit();
  const lower = text.toLowerCase();
  expect(/denominator/i.test(text), 'metrics need denominators').toBeTruthy();
  expect(/passed.*failed.*unverified/i.test(text), 'acceptance tallied passed/failed/unverified').toBeTruthy();
  expect(/trace.*sha|sha.*trace/i.test(text), 'acceptance traced to tests plus SHA').toBeTruthy();
  expect(/completed.*deviated/i.test(text), 'planned steps completed/deviated').toBeTruthy();
  expect(/why.*approval|approval.*why/i.test(text), 'deviations need why plus approval').toBeTruthy();
  for (const marker of ['spec creation', 'spec revision', 'design', 'consequential']) {
    expect(lower.includes(marker), `Fable coverage must name ${marker}`).toBeTruthy();
  }
  expect(/red-green|red green/i.test(text), 'TDD red-green proof or recorded noncompliance').toBeTruthy();
  expect(/exact-rev|exact rev/i.test(text), 'independent exact-revision review').toBeTruthy();
  expect(/unresolved finding/i.test(text), 'unresolved findings recorded').toBeTruthy();
  expect(/rework cycle/i.test(text), 'rework cycles with causes').toBeTruthy();
  expect(/avoidable.*intervention/i.test(text), 'avoidable user interventions where records support').toBeTruthy();
  expect(/identified.*dispatched|dispatched.*identified/i.test(text), 'parallelizable identified vs dispatched').toBeTruthy();
  expect(/writer isolation|dependency.*writer|writer.*dependency/i.test(text), 'parallelism judged with dependency/writer isolation').toBeTruthy();
  for (const marker of ['model', 'tool', 'time', 'token', 'cost']) {
    expect(lower.includes(marker), `cost evidence must name ${marker}`).toBeTruthy();
  }
  expect(/unknown otherwise|unknown when/i.test(text), 'unknown cost when receipts are absent').toBeTruthy();
});

test('owned-audit: judgment separates outcome, adherence, and coverage', () => {
  const text = readAudit();
  expect(/execution outcome.*procedural adherence.*measurement coverage/i.test(text), 'must distinguish outcome vs adherence vs coverage').toBeTruthy();
  expect(/never count(?:s)? missing evidence as\s+(?:a\s+)?pass/is.test(text), 'missing evidence is never a pass').toBeTruthy();
  expect(/vanity score/i.test(text), 'no collapse to a vanity score').toBeTruthy();
  expect(/not.*game|never.*game/i.test(text), 'parallelism is not a metric to game').toBeTruthy();
});

test('owned-audit: proposals follow the bounded validation loop', () => {
  const text = readAudit();
  const lower = text.toLowerCase();
  for (const marker of ['observed failure', 'inefficiency', 'root cause', 'counterevidence', 'bounded', 'hypothesized', 'regression scenario first', 'holdout', 'reviewed pr', 'human merge']) {
    expect(lower.includes(marker), `proposal loop must state ${marker}`).toBeTruthy();
  }
  expect(/cost.*quality comparison|quality.*cost/i.test(text), 'cost/quality comparison when measured').toBeTruthy();
  expect(/auditor suggests/i.test(text), 'auditor suggests; driver arranges author and review').toBeTruthy();
});

test('owned-audit: prohibitions and privacy guard the loop', () => {
  const text = readAudit();
  const lower = text.toLowerCase();
  expect(/no self-edit/i.test(text), 'no self-edit').toBeTruthy();
  expect(/no changing acceptance|preserve the accepted\s+criteria and metrics after failures/i.test(text), 'no changing acceptance/metrics after failures').toBeTruthy();
  expect(/no external transmission of raw traces|keep raw traces and run artifacts local\s+and private/i.test(text), 'no external transmission of raw traces').toBeTruthy();
  expect(/no hidden.*memory mutation|perform no self-edit, hidden per-user memory mutation/is.test(text), 'no hidden per-user memory mutation').toBeTruthy();
  expect(/no automatic merge|perform no self-edit[^.]*automatic merge/i.test(text), 'no automatic merge or activation').toBeTruthy();
  expect(/local.*private by default|private by default/i.test(text), 'run artifacts local/private by default').toBeTruthy();
  expect(/sanitized summar/i.test(text), 'sanitized summaries only when authorized').toBeTruthy();
  expect(/compatible runs|qualify causal/i.test(text), 'compare compatible runs and qualify causality').toBeTruthy();
});

test('owned-audit: learning candidates are bounded, report-only, and promotion-safe', () => {
  const text = readAudit();
  const record = readFileSync(join(auditDir, 'references', 'record.md'), 'utf8');
  const combined = `${text}\n${record}`;

  expect(combined).toMatch(/Learning candidates/i);
  expect(combined).toMatch(/accepted audited evidence set/i);
  expect(combined).toMatch(/durable user\s+preference|durable[^.]*correction/i);
  expect(combined).toMatch(/verified workspace fact/i);
  for (const field of ['statement', 'scope', 'evidence', 'revision', 'target instruction surfaces', 'contradiction', 'uncertainty', 'disposition']) {
    expect(combined.toLowerCase().includes(field), `learning candidate needs ${field}`).toBeTruthy();
  }
  expect(combined).toMatch(/already covered[^.]*no-op/i);
  expect(combined).toMatch(/transient/i);
  expect(combined).toMatch(/secret/i);
  expect(combined).toMatch(/untrusted/i);
  expect(combined).toMatch(/workspace[^.]*AGENTS\.md[^.]*CLAUDE\.md/is);
  expect(combined).toMatch(/user-wide[^.]*\$CODEX_HOME\/AGENTS\.md[^.]*~\/\.claude\/CLAUDE\.md/is);
  expect(combined).toMatch(/semantic parity/i);
  expect(combined).toMatch(/preserv(?:e|ation)[^.]*non-Axstack[^.]*ownership/i);
  expect(combined).toMatch(/reject(?:s|ed|ion)?[^.]*partial promotion/i);
  expect(combined).toMatch(/report-only/i);
  expect(combined).toMatch(/writes only[^.]*audit\.md/i);
  expect(combined).toMatch(/no[^.]*instruction[^.]*config[^.]*memory mutation/i);
  expect(combined).toMatch(/no[^.]*hook[^.]*transcript[^.]*scan[^.]*index[^.]*timer[^.]*cadence[^.]*daemon[^.]*scheduler[^.]*runtime database/is);
});

test('owned-audit: declared audit scenarios enumerate twelve expected outcomes', () => {
  const data = JSON.parse(readFileSync(join(root, 'tests', 'workflows', 'audit-scenarios.json'), 'utf8'));
  expect(data.version).toBe(1);
  expect(data.cases.length).toBe(12);
  const ids = data.cases.map((c) => c.id);
  for (const required of [
    'missing-acceptance-evidence',
    'absent-fable-design-receipt',
    'independent-tasks-serialized',
    'automatic-self-edit-request',
    'no-cost-receipts',
    'meaningful-spec-deviations',
    'durable-learning-candidate',
    'unsafe-learning-inputs-excluded',
    'already-covered-learning-no-op',
    'learning-conflict-uncertainty',
    'learning-report-only-boundary',
    'learning-promotion-parity',
  ]) {
    expect(ids.includes(required), `missing audit scenario: ${required}`).toBeTruthy();
  }
  for (const c of data.cases) {
    expect(c.title && c.spec_ref && c.input && c.expected, `${c.id}: needs title/spec_ref/input/expected`).toBeTruthy();
  }
});

test('owned-audit: existing twelve scenarios preserved unchanged', () => {
  const data = JSON.parse(readFileSync(join(root, 'tests', 'workflows', 'scenarios.json'), 'utf8'));
  expect(data.version).toBe(1);
  expect(data.cases.length).toBe(12);
  const ids = data.cases.map((c) => c.id);
  for (const required of [
    'model-outage',
    'changed-parent',
    'spec-drift',
    'two-reviewer-disagreement',
    'serious-risk-relay-failure',
    'duplicate-launch-uncertainty',
    'linear-done-drift',
    'watch-expiry',
    'strict-tdd-violation',
    'missing-mcp-access',
    'model-materialization',
    'rollout-publish',
  ]) {
    expect(ids.includes(required), `missing scenario: ${required}`).toBeTruthy();
  }
});

test('owned-audit negative fixtures: validators reject bad packaging', () => {
  expect(hasFrontmatter('# No frontmatter here'), 'missing frontmatter must fail').toBe(false);
  expect(hasFrontmatter('---\nname: axstack-audit\ndescription: ok\n---\nbody'), 'good frontmatter must pass').toBeTruthy();
  expect(
    linkEscapesBundle(skillsDir, join(skillsDir, 'axstack-audit'), '../../elsewhere/x.md'),
    'escaping link must be flagged',
  ).toBe(true);
  expect(
    linkEscapesBundle(skillsDir, join(skillsDir, 'axstack-audit'), '../axstack/references/contracts.md'),
    'shared reference link must pass',
  ).toBe(false);
});
