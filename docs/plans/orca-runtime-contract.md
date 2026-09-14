# Frozen T1 integration contract

Applies to approved Orca migration spec revision 1, SHA-256 `aad2d9e4b447aa533920e8a70757b7d52f8624052476402abc97e41c8b6b805b`.

- Bundle asset: `profiles/roles.json`, exactly `{ "version": 1, "roles": [...] }`.
- Installed asset: `<skills-dir>/axstack/roles.json`, owned and hashed like a normal skill file. No second role store, daemon merge or Orca settings mutation.
- Fields: preserve existing role `id`, `name`, `provider`, `model`, `modeId`, `thinkingOptionId`, `notes`; existing optional display fields may survive validation. `model` is required; the checker explicitly has `model: null`.
- The 17 IDs and model/effort values are the table in the approved spec. Peer IDs are `axstack-reviewer-primary` and `axstack-reviewer-secondary`; no obsolete reviewer aliases. Public permission intents remain the old conservative package defaults; installed private overrides are not bundled.
- Unknown or user-edited destination data is preserved using existing ownership rules. An edited role asset stays editable; runtime routing reads that installed file and records its exact snapshot. Invalid/unset role fields hold that role; no implicit runtime defaults.
- Legacy manifest `profiles` data is retained as inert historical provenance. It never triggers configuration reads/writes, path-binding refusal, obsolete flag advice or an install/uninstall gate. Record historical leftovers and point to separate legacy cleanup documentation. Never silently discard their ownership record.
- The installer owner supplies role validation, role-file copying, capability checks and temporary fixtures. The workflow owner supplies the production role asset and instructions that discover it relative to the installed `axstack` skill.
- Native Orca guides are runtime dependencies, not Axstack-owned files. Capability discovery resolves the proper CLI once, loads the version-matched guides, and separates executable existence, runtime readiness, configured launch preferences and real execution.
- Permission fields are declared intent until actual Orca launcher parity is verified. No automatic security-mode changes or prompt-only sandbox claims.
- Native automation model/effort/permission pinning and expiry remain a T4 capability hold. Independent T2/T3 work is ready. No Paseo fallback, custom scheduler or reduced watch contract.

Advisor: Fable 5.1 medium returned AGREE in `msg_4fc36d6af613`; driver accepted both corrections (inert legacy provenance and exact IDs/null-model shape).
Baseline: `bun test` before production changes passed 215, skipped 1, failed 0; skipped test needs an installed Paseo protocol parser.
