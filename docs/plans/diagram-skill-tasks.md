# Ticket map: `axstack-diagram` with a pinned archify viewer

Spec: `docs/specs/diagram-skill.md` approved rev 3 @ 7f5aa505330f20e1ba8dab7eac56316edd795b39
Store: this repo Markdown file. Run: `20261004-diagram-skill`.
Stack (one linear `gh stack`): T0 -> T1 -> T2 -> T3 -> T5. T4 runs after T3 and before T5.

```text
Capability: C0 spec and map
Internal task: T0 spec + this map -> driver -> driver worktree
Theme: planning artifacts
Size est: <150 lines
Acceptance: approved spec and map land with the stack
Depends: none
```

```text
Capability: C1 Pinned archify provisioning
Internal task: T1 installer archify provisioning -> axstack-author -> own worktree
Theme: installer clones, records, checks, and releases one pinned external tool
Size est: 600-900 lines (target band); commits near 200 lines, split as pin+clone,
  owners and uninstall, check and docs
Note: T1 writes skills/axstack-diagram/archify.json before T2 adds the skill; acceptable
  because release requires T1-T3 merged
Acceptance: spec acceptance 1; acceptance 6 for AGENTS.md Interfaces exception and
  docs/installation.md; acceptance 7 (bun test green, TMPDIR under /tmp)
Depends: T0
```

```text
Capability: C2 axstack-diagram skill
Internal task: T2 skill, references, ui-verification exception, smoke test -> axstack-author -> own worktree
Theme: the diagram skill contract
Size est: 400-700 lines (target band)
Content: format routing, fidelity, finalize contract and holds, Q7 40-word card cap in
  references/archify.md, Q8 one-way roles, D3 credits, D4 defaults (motion, exports,
  share cards, brand marks off)
Acceptance: spec acceptance 2; acceptance 4 smoke test (uses the five shipped examples
  inside the pinned archify copy, archify/examples/; env-var discovery, skip reasons,
  sandbox/Chrome failure = skip, copy stays clean after a run); acceptance 6 for bundle
  discovery (16 skills) and the prose-size comment; acceptance 7
Depends: T1
```

```text
Capability: C3 Explain integration
Internal task: T3 explain + visual-qa + README + docs/workflows.md -> axstack-author -> own worktree
Theme: explain routes every diagram through axstack-diagram
Size est: 200-400 lines (target band)
Acceptance: spec acceptance 3 (explain applies the T2 card cap as an exemption);
  prose-contract test for visual-qa.md (artifact.sha256 binding, mandatory node-and-edge
  review for archify output); acceptance 6 for README (archify credit) and
  docs/workflows.md; acceptance 7; raises the prose-size ceiling by its own net bytes
  with a recorded reason (every PR that adds skill Markdown does the same)
Depends: T2
```

```text
Capability: C2+C3 demonstration
Internal task: T4 desktop demonstration -> driver dispatches explainer, ui-verifier, explainer-review -> private evidence only
Theme: real end-to-end evidence; no repository change
Size est: none (evidence only)
Acceptance: spec acceptance 4 non-skipped five-type finalize run at the pin with kept log;
  acceptance 5 real installer-flow explanation from a 0700 /tmp skills root and tools dir
  (live home untouched), receipt status "pass", ui-verifier verdict, node-and-edge review;
  findings fixed in the owning PR or recorded with the user's decision
Depends: T3
```

```text
Capability: release
Internal task: T5 chore(release) minor bump -> axstack-author -> own worktree; tag, publish, install by driver
Theme: release and host install
Size est: <50 lines
Gates: approved-spec release authority recorded; the user merges the release PR and
  approves the npm stage; host-mutation authority recorded for desktop and VPS
Acceptance: spec acceptance 8 (published; desktop and VPS installed; `axstack check` shows the pin)
Depends: T1, T2, T3 merged; T4 complete
```

## Spec acceptance coverage

| Spec acceptance | Task |
|---|---|
| 1 installer cases | T1 |
| 2 skill prose contracts | T2 |
| 3 explain integration and Q7 | T3 |
| 4 five-type smoke (test in T2, non-skipped run in T4) | T2, T4 |
| 5 real demonstration | T4 |
| 6 discovery, prose comment, docs, AGENTS.md | T1, T2, T3 |
| 7 bun test green | T1, T2, T3 |
| 8 release and install | T5 |
