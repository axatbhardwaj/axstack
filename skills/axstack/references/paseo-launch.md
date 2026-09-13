# Paseo launch sequence (read this before launching any session)

Follow these steps in order for every role materialization. Runtime
capabilities determine the actual tools available; if a step cannot run,
report the missing setup rather than inventing calls.

1. `list_profiles` — read the installed `profiles/paseo.json` asset and select the profile matching the role.
2. `list_providers` — confirm the profile's provider is configured.
3. `list_models` — query models only for the selected provider and confirm the profile's model is available. A null model (checker before setup) blocks dispatch: require setup selection first and never launch a provider default. An unavailable or exhausted model pauses affected work pending user decision; never substitute another model automatically.
4. `inspect_provider` — verify the profile's mode and thinking settings. Conservative configurable presets are claude `default` and codex `auto`; keep them unless the user explicitly configures otherwise.
5. `create_workspace` — create the workspace under the canonical project (one worktree per PR candidate; reviewers use independent checkouts of the immutable revision).
6. `create_agent` — create the agent with provider string `${provider}/${model}` and the profile's settings (modeId, thinkingOptionId). Pass a compact brief: task, approved spec revision, current candidate revision, and the profile's role notes. Never launch native GPT children pretending to be Opus: the Opus reviewer must be a claude session running the Opus model.
7. Verify the session model/ownership receipt — confirm the returned agent and workspace IDs run the requested provider/model for the requested role. Persist these actual IDs in the run record and reuse existing owners and workers on resume instead of spawning replacements.
8. Notifications wake the driver; do not keep models reasoning continuously while waiting.
