// Supported harness skill locations. `discovery` records how the default
// directory was established: upstream docs, local CLI help, or unverified.
// `source` is the verified primary-source page for the default (checked
// 2026-09-13; re-check local `<tool> --help` when in doubt). Unverified
// harnesses (notably Grok) have no automatic destination: callers must pass
// an explicit --skills-dir override. Installing files alone never proves
// harness behavior; that needs a real end-to-end run.
export function harnessLocations() {
  return [
    {
      harness: 'claude',
      skillsDir: '~/.claude/skills',
      discovery: 'docs',
      source: 'https://docs.claude.com/en/api/agent-sdk/skills',
      notes:
        'User skills directory from Anthropic docs; confirm with local help. Pass --skills-dir to override.',
    },
    {
      harness: 'codex',
      skillsDir: '~/.agents/skills',
      discovery: 'docs',
      source: 'https://learn.chatgpt.com/docs/build-skills',
      notes:
        'Codex user skills use the shared ~/.agents/skills root. CODEX_HOME still selects AGENTS.md. Pass --skills-dir to override skill placement and skip automatic legacy migration.',
    },
    {
      harness: 'opencode',
      skillsDir: '~/.config/opencode/skills',
      discovery: 'docs',
      source: 'https://opencode.ai/docs/skills',
      notes:
        'Global skills directory from OpenCode docs; OpenCode also reads ~/.claude/skills and ~/.agents/skills. Pass --skills-dir to override.',
    },
    {
      harness: 'antigravity',
      skillsDir: '~/.gemini/config/skills',
      discovery: 'docs',
      source: 'https://antigravity.google/docs/skills',
      notes:
        'Global skills directory shared by the Antigravity IDE and agy CLI per Google docs (confirmed with agy 2026-09-17; the older ~/.gemini/antigravity/skills path is not read). Pass --skills-dir to override.',
    },
    {
      harness: 'grok',
      skillsDir: '(explicit --skills-dir required)',
      discovery: 'unverified',
      source: null,
      notes:
        'No verified skill directory for Grok; automatic discovery is unverified so an explicit --skills-dir override is required.',
    },
  ];
}
