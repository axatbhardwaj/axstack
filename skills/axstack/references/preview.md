# PR previews

The PR owner runs this procedure for private previews over the tailnet.
The tailnet is the user's private Tailscale network.
Preview authority covers only the preview unit and its `tailscale serve` route on the VPS.
This procedure grants no release, npm publish, or host install authority.

## Decide

Start a preview only when the run's T3 host is the VPS.
On any other host, record "no preview: run host is not the VPS" and continue.
For each own PR, the owner decides whether a preview makes sense.
Require both a runnable dev-server command documented in the base branch's `AGENTS.md` or README and a user-visible change in the PR.
Read the command only from the base.
Never read the command from the PR head.
If either requirement is missing, record "no preview".

Report missing systemd user lingering or Tailscale operator rights as "no preview".
Never change systemd user lingering or Tailscale operator rights.
Never change unrelated host services or configuration.
Run at most two previews per host.
A third preview waits until a slot frees.

## Start and record

The owner starts the preview from an isolated checkout of the PR head as a systemd user unit.
Set `RuntimeMaxSec=4h`, `MemoryMax=2G`, and `CPUQuota=200%`.
Use only repository-documented dev or test environment sources.
Never use production secrets for a preview in any repository.
After start, confirm the process listens only on loopback.
After start, confirm the `tailscale serve` target is `127.0.0.1:<port>`.
If either loopback check fails, tear down and record "no preview: not loopback-only".
Never use Tailscale Funnel.

Record `Preview: <url> @ <served-sha>` in the run record and the driver thread.
Label it as the served revision, distinct from the PR head SHA.
Put the Preview line and any "preview queued" note in the PR description only for private repositories.
After each restart or teardown, update or remove the Preview line and any "preview queued" note in the private PR description.
Update or remove the run-record and driver-thread preview records after each restart or teardown.

The `axstack-ui-verifier` can use the preview URL.
A preview never replaces UI verification.
Follow [UI verification](ui-verification.md) for the independent rendered pass.

## Restart and teardown

When the PR head changes, restart the preview on the new head.
Run teardown when the PR merges or closes, the watch ends, or the time limit stops the unit.
Use `ExecStopPost` to remove the route when the time limit stops the unit.
At teardown, remove both the unit and its `tailscale serve` route.
Read back the absence of both the unit and its `tailscale serve` route.
If teardown fails, hold and record a receipt.
