# Orca migration — approved task breakdown

Spec: `docs/specs/orca-migration.md`, approved revision 1. SHA-256: `aad2d9e4b447aa533920e8a70757b7d52f8624052476402abc97e41c8b6b805b`. Approval: `docs/specs/orca-migration-approval.md`.
Store: repository Markdown. No external tickets or PRs created.
Status: approved execution. T1 contract and capability research complete; T2 and T3 active; T4 held; T5 integration/review pending. The source base is `51b4765f7428e86cfa2dc9bf4aab0947842260b1`; the amended contract preserves its subscription presets and Claude settings.

| Task | Theme / files | Depends | Acceptance | Proposed owner / execution |
| --- | --- | --- | --- | --- |
| T1 | Freeze role asset container/path, manifest upgrade contract and verified Orca capability matrix; migration spec/coordination records | none | A3; native watch feasibility for A8; exact launcher permission mapping | Driver, with bounded Sol research and Fable decision review; no production source edits |
| T2 | Installer and capability port: `src/`, `bin/`, `package.json`, `tests/installer/` | T1 | A1–A3; fixture red/green, package smoke | Dedicated PR owner; exclusive Sol author in its own Orca worktree; independent Opus reviewer |
| T3 | Workflow/role port: `skills/`, `profiles/presets/*.json`, `tests/workflows/`, README and installation/workflow docs; includes safe unsupported-watch guidance, not live watch integration | T1 | A3–A7; predeclared behavioral scenarios plus structural checks | Separate PR owner; exclusive Sol author/worktree; independent Opus reviewer |
| T4 | Native watch integration: watch skill/runtime reference, timer portions of lifecycle and matching scenarios | T1 verified watch path, T3 | A8; pinned roles, actual ticks, expiry, recovery and cleanup | Existing workflow owner/author resumes; no concurrent writer with T3 |
| T5 | Integration and compatibility documentation: README, installation/workflow docs, combined evidence | T2, T3; T4 for complete migration | A1–A10; new exact-revision review and Luna audit | Driver coordinates; source fixes return to the owning author; documentation assigned exclusively |

T2 and T3 may run in parallel only after their shared asset contract is frozen. T4 is held if native Orca cannot preserve the accepted watch contract; do not use Paseo as fallback. T5 may collect core evidence before T4, but must not declare the full migration complete.

Size estimates: T1 small documentation/research; T2 and T3 each medium, targeted below the 2,000 changed-line PR band; T4 medium; T5 small-to-medium excluding source fixes. These are planning bands, not measured diffs. Split further by independently green behavior if actual size requires it; use the configured cohesion/exception rules instead of arbitrary file counts.

Actual owner and worktree IDs are allocated and recorded immediately before each dispatch. No role label alone is an ownership receipt. T2 and T3 cannot submit independently while the new profile asset contract leaves the combined package broken: integrate through a dependency stack and validate each submitted candidate at its actual parent/base.

TDD sequence for each behavior: declare expected observable effect → execute intended failing check → implement minimal change → green → refactor → independent review. Prompt evaluations record real agent responses and limitations. Structural tests never substitute for behavior evidence.

This map is bound to the approved spec SHA-256 above; preserve that exact spec. Completion means merged required PRs plus accepted checks; a reviewed unmerged PR remains In Review. Release/cutover are separate authorized operations, not implicit tasks in this map.
