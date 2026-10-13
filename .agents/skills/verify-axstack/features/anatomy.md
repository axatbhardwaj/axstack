# Anatomy source and theme

Entry points: `skills/axstack-anatomy/SKILL.md`, `theme.js` and `SOURCE-PROOF.json`.
Prerequisites: Launch and Doctor, Bun and an owned scratch directory.
This path checks source identity and the injected browser wrapper's unit boundary.
It never runs retained Chrome-spawning scripts or React examples.

```bash
doctor > "$EVIDENCE/anatomy-doctor.log" 2>&1
bun run test tests/workflows/anatomy.test.js \
  tests/workflows/anatomy-source.test.js tests/workflows/anatomy-theme.test.js \
  tests/workflows/anatomy-boundary.test.js > "$EVIDENCE/anatomy-contracts.log" 2>&1
STATUS=0
bun test skills/axstack-anatomy > "$EVIDENCE/anatomy-discovery.log" 2>&1 || STATUS=$?
test "$STATUS" -eq 1
rg 'did not match any test files' "$EVIDENCE/anatomy-discovery.log"
```

For the mechanical Bun build smoke, copy `kit/`, `scripts/inline-kit.mjs` and
`examples/dial-indicator/` into dispatch scratch with the same relative layout.
Hash the installed tree before and after; it must be unchanged.
Run `bun <scratch>/examples/dial-indicator/build.mjs`, then inject `theme.js`
verbatim as an inline script after the kit script. Measure final UTF-8 bytes,
scan exact bytes under Inline pages, and retain the page's SHA-256 and elapsed time.
Run `--audit` under Bun for figures using audited parts, recording result/time.
A build's exit zero alone proves no geometry audit, line check or rendered quality.

Acceptance visuals are authored by the selected `axstack-explainer` and reviewed
at exact final bytes by `axstack-explainer-review` through Explain.
The driver owns gating previews and `html_render`.
Interactive pages require the configured `axstack-ui-verifier` browser pass;
honor user browser-tool policy. Above 512,000 bytes, use Anatomy's loopback
verification and host-local save route with the same review bindings.
Live T3 theme switching remains unproven unless separately observed. The unit
fixture dispatches mutations by observer scope: animated figure updates must
not recompute the theme; root attributes, head stylesheets, explicit body markers
and system appearance still do. Wrapper
unit tests cover markers, CSS-color resolution, variable changes, standalone fallback
and matching document color-scheme on load and every theme change.

## Browser acceptance handoff

For changed rendering or theme behavior, the authored reviewer delegates this
feature file to `axstack-ui-verifier` at the pinned final head. Unit tests and
author logs alone do not prove the browser result. Use the verifier's own
host-loopback instance and configured browser, following UI verification;
the offline CLI network namespace is not the browser's server instance.

Give the verifier reviewed page bytes rebuilt with this head's wrapper, their
SHA-256, and a private evidence folder. Bind the served HTTP bytes to that hash.
At 728px and 360px, drive both dark and light, including OS appearance opposite
the simulated T3 frame. Test on load and after live changes to `--background`,
explicit `data-axstack-theme` markers, and standalone system appearance.
Require body `data-theme` and computed root `color-scheme` to match the resolved
theme. Also embed the page in a same-origin light parent iframe: the transparent
outer page must show the light parent's backdrop, with no opaque dark rectangle.
Record screenshots and computed styles; a same-document background check alone
misses iframe compositing. Preserve geometry and interactive keyboard/pointer,
focus and reduced-motion checks under Explain's page rules.

The verifier's own final-head drive is the browser proof. Name unrun cases
`changed-behavior: unproven`. Live T3 switching is a separate claim from frame
simulation. Only the driver owns gating previews and page publication.
