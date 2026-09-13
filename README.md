# Axstack

Axstack is a standalone toolkit for finishing agreed engineering work with
less supervision while retaining independent cross-model review. Chat drives
execution; a setup CLI installs skills and checks configuration. There is no
Axstack daemon, scheduler, or workflow state machine.

Design inspiration comes from disciplined user alignment and accountable PR
ownership workflows; Axstack ships its own self-contained skills and has no
dependency on Matt Pocock or Poteto skills. Native session handoff is
provided by Paseo; see [workflow prerequisites](docs/workflows.md#native-handoff).

## How a run works

Invoke a phase from chat (`axstack`, `axstack-align`, `axstack-spec`,
`axstack-tickets`, `axstack-implement`, `axstack-review`, `axstack-watch`,
plus direct `axstack-research` and `axstack-explain` routes that need no spec
ceremony). Handoffs use Paseo’s native `paseo-handoff` when available;
Axstack retains the run-record and ownership context:

Updated 2026-09-13 by user-requested change: scope readiness is proportional.

1. Classify new engineering work as substantial, small, or unclear and record
   a brief reason. Clarify unclear scope first, then classify it as small or
   substantial. Small, clear, bounded one-PR work may use its request or
   existing issue plus explicit acceptance checks and exclusions.
2. Substantial features and multi-PR or stacked work need an approved spec and
   matching ticket map; a bounded small feature is not substantial merely
   because it is labelled a feature. Alignment prepares that identity through
   one spec approval and stops with a handoff; small ambiguity can instead
   return a snapshotted small-change intent.
3. Invoke `axstack` to execute prepared work. Capabilities become internal
   tasks and reviewed PRs with one persistent owner per PR. Peer PRs receive
   independent Sol and Opus review; authored PRs receive one independent
   reviewer from a different model family than the actual author.
4. You merge by default, bottom-up for a stack. Review approval never
    grants merge authority. Colleague PRs review in peer mode against
    their linked intent with no Axstack spec required; adopted PRs keep a
    maintenance scope snapshot; monitoring stays bounded with one owner,
    an independent read-only monitor and watchdog, and no silent renewal.

Defaults: one execution host per run, two active PRs, 24-hour bounded
monitoring with a resumable handoff. Details: [docs/workflows.md](docs/workflows.md),
spec: [issue #1](https://github.com/axatbhardwaj/axstack/issues/1).

Linear is the default integration (native document, report-only checker,
driver-owned updates); repository Markdown is an explicit alternative.
The checker's inexpensive model stays unset until setup.

## Install a release

Download the complete Bun package from [GitHub Releases](https://github.com/axatbhardwaj/axstack/releases).
It is not published to the npm registry. The CLI installs and checks skills;
Paseo remains the runtime.

```sh
bun add --global https://github.com/axatbhardwaj/axstack/releases/download/v0.2.0/axstack-0.2.0.tgz
axstack --version
axstack check
axstack install --harness codex --yes
# Or select --harness claude; add --profile <paseo-config> to bootstrap profiles.
```

Ordinary upgrades preserve retired owned assets. Existing installations must
remove the former handoff and docs assets through the documented no-force
uninstall/install cycle. Follow the [retired asset migration
instructions](docs/installation.md#retiring-former-skills-and-profiles).

## Install from source

Alternatively, install from a source checkout.
Requires Bun >= 1.3.14, no runtime dependencies. Filesystem access uses the
approved narrow exception: node:fs and node:fs/promises are Bun-implemented
built-ins; no Node.js runtime is used. `bin/axstack.js` is the
`axstack` binary.

```sh
# From the source checkout root. Check host tools (bun, git, gh + gh stack extension, paseo)
bun bin/axstack.js check --bundle .

# Install skills into an explicit target and merge profiles
# (--yes is required when the target or profile lives under your home directory)
bun bin/axstack.js install --bundle . --skills-dir <dir> --profile <paseo-config> [--yes]

# Re-run: expect "no changes (idempotent, everything unchanged)"
bun bin/axstack.js install --bundle . --skills-dir <dir> --profile <paseo-config>

# Remove only unchanged owned assets (user edits survive)
bun bin/axstack.js uninstall --skills-dir <dir> --profile <paseo-config>
```

Full command reference: [docs/installation.md](docs/installation.md).

The public bundle contains 17 presets in
[profiles/paseo.json](profiles/paseo.json): 16 configured defaults that the
installer can merge, plus the `axstack-checker` setup placeholder whose model
is intentionally unset. The placeholder stays bundled but is deferred from
the Paseo config and ownership manifest until you select its model; an
existing configured checker is preserved. No model is substituted.

`install --profile` writes the selected JSON config file only. It does not
apply a native config patch, hot-reload a daemon, or prove runtime readback;
perform and verify any host application step separately. Axstack has no
runtime profile registry or profile editor: manage live models, effort, and
permissions in Paseo, and existing live user configuration stays authoritative.
Phase skills live in [skills/](skills/).

## Verification status

- 102 workflow structural and contract checks pass under Bun. The repository
  contains 36 declared scenarios; their shape checks are not model behavior.
- A root-owned, session-fresh Sol 33-case simulation at `a97c1a7` observed
  intended decisions for the 25 declared scenarios plus 8 baseline cases.
  Its private artifact is not shipped. This is model simulation, not live
  runtime or harness-support proof.
- CI targets Ubuntu and macOS with Bun 1.3.14 and 1.4.2 (`bun test` and
  `bun pm pack --dry-run` on pushes and pull requests) — see
  [GitHub Actions](https://github.com/axatbhardwaj/axstack/actions).
  Bun results are pending until observed.
- Windows is intended through WSL (unverified). Live harness, Linear, and
  model compatibility remain unverified until observed.

## License

[MIT](LICENSE) © 2026 Axat Bhardwaj.
