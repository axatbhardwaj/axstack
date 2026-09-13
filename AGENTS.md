# Axstack

Read `docs/specs/v1.md` and the assigned task in `docs/plans/v1.md`.
The spec issue is https://github.com/axatbhardwaj/axstack/issues/1.

## This build

- Only OpenCode Muse Spark 1.3 Free implementation agents are authorized.
- Do not launch Claude or Codex children, switch models, or use paid APIs.
- Driver owns orchestration, GitHub mutations and integration; workers stay within their assigned files.
- Strict TDD: write and run meaningful checks before implementing behavior; record red/green evidence. Missing module failures alone are not sufficient behavioral evidence.
- KISS, YAGNI and SOLID. No runtime orchestration engine or programmatic escalation gate.
- Never edit live home configuration during development. Tests use temporary homes and fixtures.
- Commit coherent changes around 200 lines when practical, using semantic messages.
- Use `gh stack` for PR stacks; workers do not push, submit, merge, or publish.
- Treat model availability and simulated tests separately from verified end-to-end compatibility.
- No dependency on installed Matt/Poteto/Haoshoku skills in the shipped product.

## Interfaces

Bun >=1.3.14 JavaScript, `bun:test`, no runtime dependencies initially.
Narrow approved exception: node:fs and node:fs/promises (Bun-implemented
built-ins); no Node.js runtime.
The installer owns `src/`, `bin/`, `package.json`, `tests/installer/`.
The workflow author owns `skills/`, `profiles/`, `tests/workflows/`, `docs/workflows.md`, `docs/installation.md`, and root `README.md`.
Package assets are `skills/<axstack-name>/SKILL.md` with self-contained relative references, and `profiles/paseo.json`.
The driver owns integration planning and coordination records; source fixes return to authors.
