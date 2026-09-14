# Paseo launch sequence (read this before launching any session)

Materialize an Axstack role from verified live configuration and finish with a
persisted session receipt. Read this reference immediately before actual
dispatch, not for ordinary read/write work. Native handoff follows the native
skill after the [handoff preflight](lifecycle.md#native-handoff-and-resume); do
not reproduce its launch procedure here.

Runtime capabilities determine the tools and signatures. Use returned schemas
or tool help; a missing step is a setup gap, never a reason to guess a call.

Before launch, read the run's routing snapshot. Active runs keep that recorded
snapshot after a preset switch; only new runs use the newly selected preset.
Never silently replace or migrate an active session.

1. `list_profiles` — read the installed, user-configured live profiles; they are authoritative.
   Bundled `profiles/presets/*.json` files contain setup defaults only and have
   no guaranteed installed path; their runtime presence is not guaranteed.
   Select the matching `axstack-*` role from the run's recorded routing
   snapshot. Never override its configured model. If
   `axstack-checker` is absent or unconfigured, hold
   checker dispatch while the driver checks directly or reports the gap.
2. `list_providers` — confirm the selected profile's provider is configured.
   Reuse unchanged capability discovery across phases.
3. `list_models` — query only that provider and confirm the configured model
   is available. Preserve an unset model as a setup gap rather than launching
   a provider default. An unavailable or exhausted model pauses affected work
   for the user's decision; never substitute or fall back.
4. `inspect_provider` — preserve the profile's mode and thinking settings.
   Bundled presets are claude `bypassPermissions` and codex `full-access`.
   Preserve explicit live overrides; access mode never expands task authority.
5. `create_workspace` — reconcile first. On resume, reuse the existing
   workspace and session for the PR/role. Otherwise resolve the canonical
   project and pass its `projectId`, plus `workspaceId` when reusing, then
   create the requested isolation. A missing canonical project owner is a
   setup gap, not permission to invent a scratch project.
6. `create_agent` — create the role session with `${provider}/${model}` plus
   the configured mode and thinking settings. Its brief includes the task,
   applicable identity — approved spec revision for substantial work,
   small-change intent for small work, maintenance snapshot for adoption, or
   linked intent for peer review — plus exact candidate revision and profile
   notes. When present, propagate the caller's `Notification policy`, including
   its required `axstack-relay` instructions path, without adding private
   transport values. A role name never proves its provider or model; verify the
   materialized values against the routing snapshot.
7. Verify the returned agent/workspace IDs, role, provider, and model. Persist
   that session receipt in the run record. If creation is ambiguous, mark the
   receipt pending and reconcile actual runtime state before any retry.
8. Use notifications to wake the driver; waiting never keeps a model reasoning
   continuously.

Dispatch is complete only when the requested live profile has produced one
verified, persisted ownership receipt or an exact setup/availability gap has
left affected work paused.
