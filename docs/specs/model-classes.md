<!-- Approved spec: GitHub issue #210 rev 2; SHA-256 of gh output (issue body plus trailing newline): d2903d3455661765e724c44b93ab84ef45382124d0e4ef27f80ab95bb63706e8; raw issue body SHA-256: d7c3d3b7d9e5c1620e41bae76e86f698bd8c942076d25b571743dabf6741d0f5 -->
# Model classes: roles follow the latest model of their class

**Status:** Approved rev 2 (2026-09-30).
**Repository:** `axatbhardwaj/axstack`.
**Baseline:** `462d636` (v0.20.30).
**Align record:** private run `20260930-model-classes` (Q1–Q4, with astra and opus adviser receipts).

## Outcome

Presets name a **model class** per role instead of an exact model ID. Each run resolves every class to the newest model the harness offers. It records the exact ID and reuses it for the whole run, so a new model such as Opus 5.6 or Sol 6.1 is picked up on the next run without an Axstack release. When the newest Codex model in a class is explicitly rejected at launch, the run falls back to the next-newest model in that class and records it.

## Scope

1. **Classes and row shape.**
   - **Classes:** `fable`, `opus`, `sonnet`, `haiku` (provider `claude`) and `astra`, `sol`, `luna` (provider `codex`).
   - **Row shapes:** a role row is one of:
     - (a) `modelClass` set, `model` absent or `null`;
     - (b) `modelClass` set plus an exact `model` pin, where the pin's derived class must equal `modelClass`;
     - (c) a legacy row with only an exact `model`, kept valid for old snapshots and user-edited `roles.json`;
     - (d) an intentional absence: `model: null`, no class, and on the existing allowlist.
   - **Deriving a class:** Codex `^gpt-(\d+(?:\.\d+)*)-(astra|sol|luna)$`; Claude `^claude-(fable|opus|sonnet|haiku)-`. Anything else, such as `gpt-5.6-terra`, `gpt-5.5` or `gpt-reserve`, has no class.
   - **Validation:** the installer rejects a class/provider mismatch and a pin/class mismatch.
   - **Upgrade report:** the installer's upgrade output names each role whose `modelClass` or `model` changed. Today it lists only added and removed IDs.
2. **Codex resolution (resolver script** `skills/axstack/scripts/resolve-models.js`, Bun, no dependencies, with the catalog path passed explicitly):
   - It reads the catalog Orca's Codex launch actually uses. Today that is `~/.codex/models_cache.json`, since Orca sets no `CODEX_HOME`.
   - It keeps only `list`-visible slugs matching the class pattern and orders them by numeric version, segment by segment, so 6.10 beats 6.9.
   - It skips slugs whose `supported_reasoning_levels` lack the role's effort.
   - It records the catalog path, `client_version` and `fetched_at`.
   - A missing or unparseable catalog holds that role; it never guesses.
3. **Claude resolution (driver prose, no script).**
   - The first launch of each Claude class in a run passes the harness alias (`fable`, `opus`, `sonnet`, `haiku`).
   - The exact ID is read back from that worker's Claude session transcript (`message.model` on the first assistant turn) and recorded.
   - Every later launch of that class in the run passes the recorded exact ID, so no model changes midway.
   - A class not launched yet is recorded as `alias, unresolved`. A read-back that stays unknown is recorded as unknown and holds provenance-dependent steps such as review pairing. A worker self-report is used only as a labeled last resort.
4. **Snapshot.**
   - The run snapshot records, per role: class, resolved exact ID, source (catalog, transcript, or pin), and time.
   - Resume reuses the snapshot and never re-resolves. Changing a snapshot still needs a preset change or an explicit user decision.
5. **Within-class fallback (user decision Q2, the only automatic change).**
   - **Triggers:** only an explicit model-rejection error before the worker's first turn, such as "model … is not supported". Readiness timeouts, quota, auth and other failures still hold, and `routing.md`'s ban on quota routing stands.
   - **On trigger:** fence the failed Dispatch, retry with `--retry-of` using the next-newest eligible model in the same class, provider and effort, and record the tried ID, the error and the fallback ID in the snapshot and the reply.
   - **Never:** across classes or providers, and never lower the effort.
   - **Claude:** there is no enumerable candidate list, so a rejected Claude alias or ID holds (this scopes Q2).
   - **Scope:** the rule applies to every role, including advisers, judges and escalation seats. They keep their class.
   - **Contract text:** `contracts.md`, `routing.md`, `orca-runtime.md` and `axstack-review/SKILL.md` state this narrowly. Every other no-substitution rule is unchanged.
6. **Review pairing by class**, covering all four authored rows:
   - `mixed`: `sol` author → reviewer-secondary (`opus` medium); `opus` author → reviewer-primary (`sol` high).
   - `codex-only`: `sol` author → reviewer-secondary (`luna` xhigh).
   - `claude-only`: `opus` author → reviewer-secondary (`sonnet` high).
   - **Provenance:** the author's recorded exact ID maps to its class. An ID with no class, such as `gpt-5.6-terra` or an unknown value, is `INCOMPLETE`.
   - **`src/roles.js`:** the required-model check (`:78`) accepts class rows. The distinct-reviewer check (`:89`) compares resolved IDs, or classes before resolution. `AUTHORED_ROUTES` becomes class-keyed.
7. **Text that names exact IDs or forbids fallback** is updated consistently: `routing.md` (snapshot, provenance and fallback lines), `role-roster.md` (table), `contracts.md`, `orca-runtime.md`, `axstack-review/SKILL.md` (table, provenance, fallback), `axstack-audit/SKILL.md`, preset `notes`, README, `docs/installation.md` and `docs/workflows.md`. `lifecycle.md` is untouched.

## Delivery

A bottom-up `gh stack` of three PRs. Each is green and usable on its own:

- **A: schema and validation (backward compatible).** Row shapes (a) through (d), class derivation, installer validation, and the upgrade field report. Presets stay unchanged.
- **B: class-based pairing.** `src/roles.js` pairing and provenance, plus the tables in `role-roster.md`, the review skill and the audit skill.
- **C: resolution and activation.** The resolver, the Claude read-back rule, the snapshot and fallback contracts, the docs, and switching the presets to classes.

## Acceptance criteria

- **Validation:** tests cover all four row shapes, the class/provider and pin/class mismatches, and the upgrade report naming changed roles.
- **Resolver**, run against fixture catalogs with an explicit path:
  - `gpt-6.1-sol` beats `gpt-6-sol`, and 6.10 beats 6.9;
  - `hide` slugs, terra, `gpt-5.5` and suffixed slugs are ignored;
  - a slug missing the role's effort is skipped;
  - a missing or malformed catalog holds;
  - the output records path, `client_version` and `fetched_at`.
- **Pairing:** all four authored rows match by class; `codex/gpt-5.6-sol` maps to `sol`; terra and unknown IDs are `INCOMPLETE`.
- **Contracts:** tests pin these rules:
  - Claude first-launch read-back and exact-ID reuse;
  - `alias, unresolved` and unknown holds;
  - resume reuses the snapshot;
  - the fallback trigger is explicit rejection only (timeout and quota hold);
  - Claude rejection holds;
  - fallback never crosses class or provider, and never lowers effort.
- **Guard:** the Sonnet ≤ high guard covers the `sonnet` class.
- **Suite and review:** `env -u TMPDIR bun test` passes with a private `TMPDIR` in evidence; `routing.md` stays under its budget and `lifecycle.md` is unchanged; each PR gets reviewer APPROVE plus a diligence PASS.
- **Feasibility receipt (before PR C):** one real Claude alias launch through Orca whose transcript read-back yields the exact ID, and one resolver run against the live catalog, both recorded.

## Verification (after release; separate host authority)

Install on desktop and VPS. One real run records resolved IDs and sources in its snapshot.

## Exclusions

- Not fixing Orca ↔ Codex ≥ 0.158 readiness, and not unpinning desktop Codex. Until that's fixed, Sol 6.1 cannot resolve under Orca.
- No Claude model catalog or Claude fallback; no cross-class or cross-provider fallback; no effort changes.
- No daemon, scheduler, model cache or runtime database.
- Antigravity and Grok rows keep `model: null`, the TUI default, unchanged.
