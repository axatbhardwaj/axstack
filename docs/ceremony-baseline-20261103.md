# Ceremony baseline — 2026-11-03

CR-2 reporting baseline, built from the 2026-10-29–11-03 thread research and
11 recent run records read on axat-vps. This is observational evidence and
never gates work. Missing measurements stay `unknown`, never zero.

## Sources and selection

Private source root: `<axstack-git-common-dir>/axstack/runs/align-ceremony-20261103/evidence/`.
Research `R` is `research-threads-5d/{report.md,vps-window.json,vps-nonrm.tsv,rm-pr-role.tsv,classify.jq}`.
The read-only source inventory, full SHA-256 hashes, frozen inputs and extraction
receipt are in `author-t2/{source-manifest.json,inputs/,baseline-check.json}`.
Source IDs below identify `progress.md` under each repository's
`.git/axstack/runs/<run>/`. Hash prefixes identify the frozen source bytes.

Selected the 11 most recently modified top-level run records available under
`/root/dev/*` and `/root/defi/*`; the oldest are dated October 28, supplementing
the five-day research. Nested author records are excluded to avoid duplication.
Review-manager PRs are excluded: the 107 PR keys in `R/rm-pr-role.tsv` have no
intersection with the 11 PRs below. Peer/dependency PRs mentioned in a record
are excluded too. Separate release PRs owned by the sampled drivers remain.

| ID | Repository | Run | SHA-256 prefix | Evidence used |
| --- | --- | --- | --- | --- |
| A | axstack | align-ceremony-20261103 | 91543da0c52c | Spec r1–r5; #606 publication; shared multi-PR scope |
| B | monorepo | 20261102-sentry-full-visibility | dc355065a99c | Review a1–a4 at four heads; #1988 merged; wider spec r1–r2 |
| C | monorepo | 20261102-def-2899-spec | 3b69089aac91 | Spec drafts r1–r12; no PR |
| D | monorepo | 20261102-ci-speed-spec | 18f822172f1c | Six completed workers; drafts r1–r2; paused; no PR |
| E | monorepo | 20261030-def-2848-frame-loop | 39ef13c9eb98 | #1963 review a1 at 2e3e3dac; replacement #1964 |
| F | monorepo | 20261029-def-2826-implement | f29473236880 | #1950 review a1 cancelled; a2 complete at c61d2160 |
| G | monorepo | 20261029-def-2826-debug | b50d620bef28 | Explicit no-dispatch diagnostic; no PR |
| H | monorepo | 20261029-def-2794 | ccf119a912d0 | #1924 reviews a1–a4, including base-update heads |
| I | monorepo | 20261028-feature-map-refresh | 1b3c9dd241df | #1900 repair and base-update reviews; no complete tally |
| J | axstack | 20261028-advisory-file-size | cc90b8f1df5d | #576 reviews a1–a4; separate #580 release review |
| K | axstack | 20261028-readable-spec-format | 27be6bf2da79 | #577 reviews a1–a4; separate #581 release review |

## Per-PR observations

A dispatch is one native task or launch, counted once by its identity. A review
round is one authored-review pass at one head, including passing passes and
distinct passes at the same head. Spec adviser and diligence receipts are not
authored-review rounds. Interrupted review fragments do not prove a full pass.
Spec revisions count distinct attributable drafts including the first; a spec
shared across PRs stays unallocated without an allocation receipt.

These are snapshot observations, not a claim of complete lifetime accounting.
Known review totals below have individually recorded passes; dispatch totals
remain `unknown` because complete per-PR native-task inventories are absent.
Durations require active/wait intervals; elapsed time alone cannot supply them.
Driver and worker token totals require separate provider receipts and a stated
cache basis. No sampled PR has those measurements.

| PR | Source | Dispatches | Review rounds | Spec revisions | Active time | Wait time | Driver tokens | Worker tokens |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [axstack #606](https://github.com/axatbhardwaj/axstack/pull/606) | A | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| [monorepo #1988](https://github.com/defi-com/monorepo/pull/1988) | B | unknown | 4 | unknown | unknown | unknown | unknown | unknown |
| [monorepo #1963](https://github.com/defi-com/monorepo/pull/1963) | E | unknown | 1 | unknown | unknown | unknown | unknown | unknown |
| [monorepo #1964](https://github.com/defi-com/monorepo/pull/1964) | E | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| [monorepo #1950](https://github.com/defi-com/monorepo/pull/1950) | F | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| [monorepo #1924](https://github.com/defi-com/monorepo/pull/1924) | H | unknown | 4 | unknown | unknown | unknown | unknown | unknown |
| [monorepo #1900](https://github.com/defi-com/monorepo/pull/1900) | I | unknown | unknown | unknown | unknown | unknown | unknown | unknown |
| [axstack #576](https://github.com/axatbhardwaj/axstack/pull/576) | J | unknown | 4 | unknown | unknown | unknown | unknown | unknown |
| [axstack #580](https://github.com/axatbhardwaj/axstack/pull/580) | J | unknown | 1 | unknown | unknown | unknown | unknown | unknown |
| [axstack #577](https://github.com/axatbhardwaj/axstack/pull/577) | K | unknown | 4 | unknown | unknown | unknown | unknown | unknown |
| [axstack #581](https://github.com/axatbhardwaj/axstack/pull/581) | K | unknown | 1 | unknown | unknown | unknown | unknown | unknown |

Coverage: review rounds measured for 7/11 PRs (19 passes); each other field
measured for 0/11 PRs. This is not a total-cost estimate or an average over all
PRs. #1950 has one completed and one interrupted review, so its total stays
`unknown`. #1964 carries #1963's approval; it receives no duplicate pass count.
The two no-PR spec runs and diagnostic run contribute evidence, not invented PRs.

## Research cross-check and unallocated run costs

`R/report.md` §§1–2, 7 reports 684 VPS threads; raw data separates 527 manager
children. `vps-nonrm.tsv` still includes five manager drivers: removing them
leaves **152 non-manager threads and 23,405 items**. Their title classifications
are 28 top-level, 49 advisers, 13 escalations, 21 diligence, 9 reviewers,
4 authors, 4 verifiers, 3 arena and 21 other subagents. These are observed
thread/item counts, not dispatch or token totals. A resumed thread can contain
multiple native tasks; deleted threads cannot be recovered from this list.

C and `R/report.md` §2 record 12 spec drafts, 43 observed spec dispatches and
two UI verifier threads for DEF-2899. D records six completed workers and two
drafts. G explicitly records no dispatches. Those facts belong to their runs;
none is silently assigned to a later implementation PR. A's five spec drafts
also serve a multi-PR delivery, while B's wider spec is separate from PR1.

The research's 2h28m DEF-2899 spec loop, roughly six-hour #1988 readiness loop,
and 69.5-hour fleet build are elapsed windows, with active and wait time both
`unknown`. The fleet build's deleted children prevent full dispatch recovery.
iobox was unreachable; other fleet lists were partial or not saved. No fleet
total, token total, causal speed claim or post-change saving is established.

Later audits should compare compatible per-PR cost lines against this file,
report measurement coverage separately, and keep unknowns visible.
