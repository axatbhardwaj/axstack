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
[docs/specs/v1.md](docs/specs/v1.md).

Linear is the default integration (native document, report-only checker,
driver-owned updates); repository Markdown is an explicit alternative.
The checker's inexpensive model stays unset until setup.

## Install from source

Not released to any npm registry; install from a source checkout.
Requires Node.js >= 22, no runtime dependencies. `bin/axstack.js` is the
`axstack` binary.

```sh
# Check host tools (node, git, gh + gh stack extension, paseo)
node bin/axstack.js check --bundle .

# Install skills into an explicit target and merge profiles
node bin/axstack.js install --bundle . --skills-dir <dir> --profile <paseo-config>

# Re-run: expect "no changes (idempotent, everything unchanged)"
node bin/axstack.js install --bundle . --skills-dir <dir> --profile <paseo-config>

# Remove only unchanged owned assets (user edits survive)
node bin/axstack.js uninstall --skills-dir <dir> --profile <paseo-config>
```

Full command reference: [docs/installation.md](docs/installation.md) (ships
with the installer stream; resolves after integration).

Model presets ship as data in [profiles/paseo.json](profiles/paseo.json)
and are configurable; an unavailable model pauses affected work for your
decision — never automatic substitution. Phase skills live in [skills/](skills/).

## Verification status

- 14 structural packaging checks plus 12 simulated Muse scenario evaluations
  pass; these are not live harness support claims.
- Linux local runs on this host's Node are dev evidence only; the formal
  Node 22/26 matrix is still pending.
- macOS, WSL, and Claude/Codex/OpenCode/Grok runtime behavior are unverified.

## License

[MIT](LICENSE) © 2026 Axat Bhardwaj.
