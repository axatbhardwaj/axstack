# UI verification

Every Playwright, browser, or rendered-UI check outside the two named browser
exceptions, including a "confirm it in the browser" step, goes through async
`delegate_task` to a configured UI verifier role.
The configured UI verifier roles are `axstack-ui-verifier` and
`axstack-ui-verifier-sonnet` from the role snapshot; select them under the
[dual-run trigger](#android-device-and-webpwa-dual-run) below.
Give each verifier the exact build, URL, or artifact and the private dispatch's evidence folder. The verifier is read-only: it never edits source.
The PR writer remains the sole writer.

Before using a PR preview URL, the UI verifier must read [PR previews](preview.md).

The first named browser exception is the driver's two `html_preview`
runs at 728px dark and 360px light.
Never replace the verifier's interaction pass with `html_preview`.
Follow [Inline pages](../../axstack-explain/references/inline-pages.md) for the page checks.

The second named browser exception permits dispatched roles to use
`html_preview` as a non-publishing self-check.
Dispatched-role self-checks never replace the driver's two previews or the `axstack-ui-verifier` pass.
Dispatched roles never call `html_render`.
All other browser checks outside the two named exceptions remain delegated to configured UI verifier roles under the dual-run trigger below.

Read the [T3 runtime boundary](t3-runtime.md) before dispatch; for candidate
checks use its driver-made disposable detached checkout at the pinned candidate SHA.
For explicit non-repository article or Improve discovery checks, use the local shared delegate and
owned SHA-256 snapshot in [Local artifacts](local-artifacts.md); no Git candidate
is fabricated. Engineering candidate checks retain the checkout requirement.
Use the configured verifier browser and honor the user browser-tool policy.
Engineering candidate browser and visual checks must run in a delegated UI verifier role in its own detached checkout; outputs go to its private evidence folder, never the driver worktree.

For every interactive page, require a real-browser `axstack-ui-verifier` interaction pass.
Give the evidence path and SHA-256 of the exact bytes in the verifier brief.
The verifier serves the exact bytes on loopback.
The verifier opens the loopback page in its configured browser.
The verifier checks clicks, keyboard, focus order, screen-reader names, expanded states, and reduced motion.
Require that `performance.getEntriesByType('resource')` is empty.
The detached-checkout rule does not apply to a page without a candidate.

Ask for screenshots and observed interactions, accessibility, desktop and
mobile layouts, and reduced-motion behavior where relevant. The verifier
returns a verdict with evidence paths and names checks it could not run.
Keep the verdict tied to the exact artifact or revision; changed bytes need a
fresh rendered pass.

Use a present `verify-<app>` skill for affected behavior.
If a PR changes a mapped feature, its author updates the feature file in the same PR.
For a missing skill, add "suggest `axstack-verify create`" to the receipt's `Unverified:` line.
Never generate a verification skill automatically.
For a broken or stale recipe, report the gap.
Report a broken or stale recipe as a `low` finding naming `axstack-verify maintain`.
Never let a broken or stale recipe waive existing acceptance obligations.
Keep browser recipes tool-neutral for the verifier.

## Android device and web/PWA dual run

Apply the dual run to Android device verification or explicitly requested
PWA/app feature verification, such as a `verify-<app>` device recipe or a user request.
Ordinary review and watch browser checks use one `axstack-ui-verifier` pass by default.
For these Android and web/PWA runs, assign run 1 to
`axstack-ui-verifier` (Terra high).
Dispatch independent run 2 to `axstack-ui-verifier-sonnet` with the same brief
and the same pinned build.
Never show run 2 the run 1 results.
Start run 2 only after run 1 completes shutdown; use a fresh delegated session
and a separate private evidence folder.
The two-provider check requires the mixed preset; an intentional single-provider
absence leaves dual-run verification unverified, without substitution.
This dual run does not add a second pass to the inline-page exception above.

Before run 1, record APK SHA-256 (or build SHA) and PWA deploy SHA in the brief.
Include feature files, prerequisites, target URL and per-feature acceptance checks.
Select the host through fleet routing using account-local configuration and
[capability examples](fleet-route-schema.md#device-and-browser-examples).
When `desktop:user` status is missing or unknown, treat the host as a user desktop.
On a `desktop:user` host, including that safe default, use only a headless browser and a windowless emulator.
Never focus windows or switch workspaces on a user desktop.
Allow only one emulator per host at a time.
Run a thermal precheck before starting on hosts that declare one; honor their
account-local start/stop thresholds and hold or route elsewhere if unsafe.
For iOS without a capable host, report unverified.

Each run follows the same lifecycle:

1. Call `device_list` and confirm `agentDeviceInstalled: true` before `device_open`.
   Pass the selected device's `hostId` and `id` to `device_open`.
2. Use `device_open` and its returned `agent-device` command to install, launch
   and drive the pinned APK; open the app before snapshots or input.
   Use the returned command's help for supported operations; report unavailable
   install/build capabilities as unverified rather than inventing commands.
3. Save a snapshot and `device_screenshot` for each feature end state in private
   evidence; capture actions, resulting states and side effects.
4. For web/PWA, use Playwright MCP at 390×844 and 1440×900, driving the same features.
   Capture console errors as route template and code only.
5. Return pass, fail or blocked per feature, pinned build identities and evidence
   paths; keep secrets, recovery phrases, tokens and addresses out of reports.
   Follow the app's production-testing policy; unattended production money paths
   stop at read-only actions.
6. After each run, including failed attempts, use `device_close` with
   `shutdown: true` and `browser_close` for owned sessions; preserve evidence.

The driver reconciles each feature:

- When both runs pass, the driver records pass.
- When both runs fail a feature, the driver records fail and routes it to `axstack-debug`.
- If runs disagree, the driver holds and requests one Sonnet rerun of that feature.
  Use a fresh delegated session and a separate private evidence folder for the
  Sonnet rerun, with the same brief and same pinned build.
  Never show the Sonnet rerun run 1 or run 2 results.
  If the rerun still disagrees with run 1, report flaky/unverified with all observations.
  If the rerun agrees with run 1, the agreed result stands while the driver records
  the initial disagreement in evidence; an agreed failure routes to `axstack-debug`.
- Blocked or missing coverage remains unverified, never a pass.

## Proof standards

Apply these standards wherever referenced, including the verifier's candidate checks
and inline-page interaction pass.

Drive the real user path.
Capture the action, the resulting state and its side effects.
For a dry-run claim, verify what it skips by observing files, network calls or Git refs.
Keep evidence in the private evidence folder after cleanup.

Ideas paraphrased from pstack's
[create-verification-skill](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/create-verification-skill/SKILL.md) (MIT).
