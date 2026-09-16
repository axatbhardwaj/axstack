import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = import.meta.dir.slice(0, -'/tests/workflows'.length);
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');

// Cross-file consistency checks for the automation contract. Each assertion
// binds a trigger to its required outcome (a transition), not a bare keyword.
// A sentence is the unit: `clause` returns the sentence that carries the
// trigger so the outcome must appear in the same rule.
function clause(text, trigger) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z`*(])/);
  const hit = sentences.find((s) => trigger.test(s));
  expect(hit, `no sentence matches ${trigger}`).toBeTruthy();
  return hit;
}

function section(text, start, end) {
  const from = text.indexOf(start);
  expect(from, `missing section start ${start}`).toBeGreaterThan(-1);
  const to = text.indexOf(end, from + start.length);
  expect(to, `missing section end ${end}`).toBeGreaterThan(from);
  return text.slice(from, to);
}

test('sol-1: an automation repair is reviewed at its local immutable SHA; ordinary candidates keep remote confirmation', () => {
  const pub = compact('skills/axstack/references/candidate-publication.md');
  const review = compact('skills/axstack-review/SKILL.md');

  // Ordinary boundary: remote equality before reviewer dispatch is unchanged.
  expect(pub).toMatch(/Before reviewer dispatch, read the remote ref back and confirm that it resolves to the candidate SHA/);
  expect(pub).toMatch(/Ordinary[^.]*(?:keep|retain)[^.]*remote confirmation|Every other caller[^.]*remote confirmation/i);

  // Automation exception: local commit SHA in the per-PR child worktree is the
  // candidate, confirmed by git rev-parse, not by remote equality.
  const exception = clause(pub, /automation repair/i);
  expect(exception).toMatch(/local immutable commit SHA[^.]*per-PR child worktree/i);
  expect(clause(pub, /git rev-parse/)).toMatch(/instead of remote equality/i);
  expect(clause(pub, /re-checked/i)).toMatch(/remote equality[^.]*publication readback[^.]*immediately before the fast-forward push/i);
  // The remote is expected to still be the pre-repair head, so equality is not required for admission.
  expect(clause(pub, /pre-repair/i)).toMatch(/expected-old remote SHA|not[^.]*equal[^.]*candidate/i);

  // Review skill: pin-the-brief step carries the same exception and keeps the ordinary rule.
  const pin = section(review, '1. **Pin the brief.**', '2. **Materialize');
  expect(pin).toMatch(/For an owned candidate, verify remote confirmation of the candidate SHA before reviewer dispatch/);
  expect(clause(pin, /automation repair/i)).toMatch(/local immutable candidate SHA[^.]*git rev-parse[^.]*child worktree/i);
  expect(clause(pin, /automation repair/i)).toMatch(/remote[^.]*pre-repair|expected-old remote/i);
});

test('sol-2: original-author continuity is scoped to run-launched sessions; an automation repair is authored by the automation session or a dispatched axstack-author', () => {
  const watch = compact('skills/axstack-watch/SKILL.md');
  const repair = compact('skills/axstack-watch/references/repair-publication.md');
  const ref = compact('skills/axstack/references/automations.md');

  for (const [name, text] of [['watch', watch], ['repair-publication', repair]]) {
    // Continuity rule is conditioned on a session the run itself launched.
    const continuity = clause(text, /original author session|same original author session/i);
    expect(continuity, `${name}: continuity must be scoped`).toMatch(/run itself launched|launched by (?:this|the) run|this run launched/i);
    // Automation branch: adopted own PR -> automation session or dispatched axstack-author.
    const automation = clause(text, /adopted own PR under (?:the|an) automation|under (?:the|an) automation[^.]*adopted own PR/i);
    expect(automation, `${name}: automation author`).toMatch(/automation session[^.]*(?:Claude\/Opus|provider `claude`)/i);
    expect(automation, `${name}: delegated author`).toMatch(/dispatched `axstack-author`/);
    // Reviewer pairing follows the recorded actual provenance of that repair.
    expect(clause(text, /authored-review pairing|authored review pairing/i)).toMatch(/actual provenance|recorded provenance/i);
  }
  // The shared reference names the two provenance -> reviewer transitions.
  expect(clause(ref, /repair author is the automation session/i)).toMatch(/`axstack-reviewer-primary`/);
  expect(clause(ref, /delegated to `axstack-author`/i)).toMatch(/`axstack-reviewer-secondary`/);
});
