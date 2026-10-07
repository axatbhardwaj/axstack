# Ticket map: explain answers with inline T3 pages

Spec: `docs/specs/explain-inline-pages.md` approved rev 4 @ 7923df8
(content sha256 a7c3736f…7b9c).
Store: this repo Markdown file. Run: `20261007-explain-t3-inline-html`.
Stack (one linear `gh stack`): T0 -> T1 -> T2 -> T3. T4 runs on the T2 candidate
(D9 and D10 land there) before T1 merges. T5 waits for release authority.
Every PR raises the aggregate prose budget in `prose-size.test.js` by its own
measured net bytes with a dated comment; no task touches always-loaded files.

```text
Capability: C0 spec and map
Internal task: T0 spec + this map -> driver -> driver worktree
Theme: planning artifacts
Size est: about 225 lines
Acceptance: approved spec and map land with the stack
Depends: none
```

```text
Capability: C1 explain publishes inline pages
Internal task: T1 explain + inline-pages reference -> axstack-author -> own worktree
Theme: explain's answer path
Size est: 250-400 lines; commits near 200 lines (skill + reference, tests + budget)
Scope: spec scope 1, 2, 3 and the explain part of 8:
  - SKILL.md description names the Q2 triggers
  - §2.2 chat path limited to explicit chat request, no Q2 trigger, or D4
    fallback (contract test pins it)
  - §2.3 complex-visual default becomes the inline page path; explicit-format
    rule kept; archify on explicit viewer request via axstack-explainer (D5)
  - §3.1 routes pages to inline-pages.md and archify to visual-qa.md
  - §3.2 independent axstack-explainer-review for consequential or complex
    claims, archify output, or on request, with D6's examples
  - new references/inline-pages.md: theme variables (D8); fluid width, no outer
    frame or banner, no viewport heights, fixed chart heights; height (D11);
    no network (D2; scan includes srcset, EventSource, meta refresh; allows
    url(#id)); no storage, cookies, modals, popups (D10); accessibility and
    text alternatives (D9); layout guidance (Q4); checks (Q3, D7, D9);
    failure and retry rules, exact-bytes publication, evidence (D4)
  - visual-qa.md: one scoping line
  - explain-diagram.test.js and owned-support.test.js updated with removal,
    inversion, and rewording checks; archify holdouts stay pinned
Acceptance: spec repository acceptance 1 and 2 for Q2-Q4, D2-D8, D11; archify
  holdout tests still pass
Depends: T0
```

```text
Capability: C1 explain publishes inline pages
Internal task: T2 check boundaries -> axstack-author -> own worktree
Theme: who may preview, verify, and publish
Size est: 100-200 lines
Scope: spec scope 4 and the matching part of 8:
  - ui-verification.md: D9 second author exception, D10 page pass, own
    detached-checkout sentence rescoped to candidate checks
  - t3-runtime.md: dispatch brief rule adds "never call html_render" (D1)
  - diagram.test.js, t3-runtime.test.js, presets.test.js pinned sentences
Acceptance: spec repository acceptance 1 for D1, D9, D10
Depends: T1
```

```text
Capability: C2 spec readbacks, diagram routing, roles, docs
Internal task: T3 spec readback + diagram + presets + docs -> axstack-author -> own worktree
Theme: callers and descriptions of the new path
Size est: 150-250 lines
Scope: spec scope 5, 6, 7 and the matching part of 8:
  - axstack-spec checkpoint publishes the readback page with D12 identity
  - axstack-diagram description and body: archify only on explicit request;
    Mermaid for chat fallback, GitHub, docs; inline SVG or CSS in pages
  - presets (all three) and role-roster notes for axstack-explainer,
    axstack-explainer-review, and axstack-ui-verifier; drop "verifies rendered
    behavior"
  - user docs: README.md, docs/workflows.md, docs/getting-started.md,
    docs/installation.md where they describe explain or archify routing
  - diagram.test.js, presets.test.js, related contract tests
Acceptance: spec repository acceptance 1 and 2; D12 contract test
Depends: T2
```

```text
Capability: C3 rehearsal
Internal task: T4 rehearsal page -> driver -> driver worktree (no PR)
Theme: live check of the candidate rules
Size est: none (evidence only)
Acceptance: spec repository acceptance 3: one page explaining the change,
  published in the driver thread under the T1+T2 candidate rules, with
  both previews, clean static scan, verifier verdict if interactive, and
  recorded bytes, SHA-256, attachmentId
Depends: T2 candidate
```

```text
Capability: C4 deployment canary
Internal task: T5 deployment canary -> driver -> fresh T3 thread (no PR)
Theme: installed behavior
Size est: none (evidence only)
Acceptance: spec deployment acceptance 1 and 2 (fresh thread, plain question
  not naming the skill, one page, recorded evidence; spec checkpoint page)
Depends: T3 merged, release and install authority (pending)
```
