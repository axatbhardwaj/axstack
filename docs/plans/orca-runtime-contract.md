# Frozen T1 integration contract

Applies to approved Orca migration spec revision 1, SHA-256 `aad2d9e4b447aa533920e8a70757b7d52f8624052476402abc97e41c8b6b805b`.

- Current-base preservation amendment: the clean recovery clone revealed merged subscription-preset and Claude-settings features at `51b4765`, newer than the initial source snapshot. Preserve those unrelated features as required by the approved spec. This replaces the single bundled-default proposal below; it adds no new preset.
- Bundle assets: existing `profiles/presets/{mixed,codex-only,claude-only}.json` paths, converted to `{ "version": 1, "roles": [...] }`. Keep explicit `--preset`, no default, identical role ID sets, existing provider/effort bounds and authored-review mappings.
- Installed selected asset: `{ "version": 1, "preset": "<selected preset>", "roles": [...] }`. The selected preset is part of the runtime snapshot; it is not inferred from provider or defaults.
- Installed asset: `<skills-dir>/axstack/roles.json`, owned and hashed like a normal skill file. No second role store, daemon merge or Orca settings mutation.
- Fields: preserve existing role `id`, `name`, `provider`, `model`, `modeId`, `thinkingOptionId`, `notes`; existing optional display fields may survive validation. `model` is required; the checker explicitly has `model: null`.
- The 17 mixed-preset IDs and model/effort values are the table in the approved spec. Preserve the two other already-merged preset tables without claiming live Orca compatibility. Peer IDs are `axstack-reviewer-primary` and `axstack-reviewer-secondary`; no obsolete reviewer aliases. Preserve approved upstream permission-intent data, but never claim effective permission parity from stored fields or copy private host overrides into public assets.
- Unknown or user-edited destination data is preserved using existing ownership rules. An edited role asset stays editable; runtime routing reads that installed file and records its exact snapshot. Invalid/unset role fields hold that role; no implicit runtime defaults.
- Legacy manifest `profiles` data is retained as inert historical provenance. It never triggers configuration reads/writes, path-binding refusal, obsolete flag advice or an install/uninstall gate. Record historical leftovers and point to separate legacy cleanup documentation. Never silently discard their ownership record.
- The installer owner supplies role validation, role-file copying, capability checks and temporary fixtures. The workflow owner supplies the production role asset and instructions that discover it relative to the installed `axstack` skill.
- Native Orca guides are runtime dependencies, not Axstack-owned files. Capability discovery resolves the proper CLI once, loads the version-matched guides, and separates executable existence, runtime readiness, configured launch preferences and real execution.
- Permission fields are declared intent until actual Orca launcher parity is verified. No automatic security-mode changes or prompt-only sandbox claims.
- Preserve Claude settings ownership/sidecar transactions and `--claude-settings` / `--no-claude-settings`: these configure Claude Code, not Paseo. Only the former Paseo `--profile` flow is obsolete. Tests remain temporary-home only.
- Native automation model/effort/permission pinning and expiry remain a T4 capability hold. Independent T2/T3 work is ready. No Paseo fallback, custom scheduler or reduced watch contract.

Advisor: Fable 5.1 medium returned AGREE in `msg_4fc36d6af613`; driver accepted both corrections (inert legacy provenance and exact IDs/null-model shape).
Baseline: `bun test` before production changes passed 215, skipped 1, failed 0; skipped test needs an installed Paseo protocol parser.

Current-base advisor: Fable returned AGREE in `msg_751b55e7545e`; driver accepted preservation of explicit presets, readiness invariants and Claude settings; effective model/permission claims remain limited to actual evidence. Rebased baseline at `0607ed1` passed 285, skipped 1, failed 0.
