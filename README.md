# Axstack

Axstack is a standalone toolkit for finishing agreed engineering work with
less supervision while retaining independent cross-model review. Chat drives
execution; a setup CLI installs skills and checks configuration. There is no
Axstack daemon, scheduler, or workflow state machine.

Design inspiration comes from disciplined user alignment and accountable PR
ownership workflows; Axstack ships its own self-contained skills and has no
upstream skill dependency.

## How a run works

Invoke a phase from chat (`axstack`, `axstack-align`, `axstack-spec`,
`axstack-tickets`, `axstack-implement`, `axstack-review`, `axstack-watch`):

1. Align on decisions and constraints, then write a spec with observable
   acceptance criteria and explicit exclusions.
2. You approve the spec. The approved revision is the execution baseline,
   then work proceeds autonomously phase to phase.
3. Capabilities become internal tasks and a reviewed PR stack with one
   persistent owner per PR and exactly two independent final reviewers.
4. You merge by default, bottom-up for a stack. Review approval never
   grants merge authority.

Defaults: one execution host per run, two active PRs, 24-hour bounded
monitoring with a resumable handoff. Details: [docs/workflows.md](docs/workflows.md),
spec: [issue #1](https://github.com/axatbhardwaj/axstack/issues/1).

Linear is the default integration (native document, report-only checker,
driver-owned updates); repository Markdown is an explicit alternative.
The checker's inexpensive model stays unset until setup.

## Install from source

Not released to any npm registry; install from a source checkout.
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

Model presets ship as data in [profiles/paseo.json](profiles/paseo.json)
and are configurable; an unavailable model pauses affected work for your
decision — never automatic substitution. Phase skills live in [skills/](skills/).

## Verification status

- 14 workflow checks (structural packaging plus the 12-scenario evaluation
  contract) pass under Bun; prior Muse simulation evidence for the 12
  scenarios stands separately. None of this is live harness support.
- CI targets Ubuntu and macOS with Bun 1.3.14 and 1.4.2 (`bun test` and
  `bun pm pack --dry-run` on pushes and pull requests) — see
  [GitHub Actions](https://github.com/axatbhardwaj/axstack/actions).
  Bun results are pending until observed.
- Windows is intended through WSL (unverified). Live harness, Linear, and
  model compatibility remain unverified until observed.

## License

[MIT](LICENSE) © 2026 Axat Bhardwaj.
