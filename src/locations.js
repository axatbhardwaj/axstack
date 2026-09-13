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
      skillsDir: '$CODEX_HOME/skills (default ~/.codex/skills)',
      discovery: 'docs',
      source: 'https://developers.openai.com/codex/skills',
      notes:
        'User skills live under $CODEX_HOME/skills per OpenAI docs (CODEX_HOME defaults to ~/.codex). The CLI honors $CODEX_HOME when set. Pass --skills-dir to override.',
    },
    {
      harness: 'opencode',
      skillsDir: '~/.config/opencode/skills',
      discovery: 'docs',
      source: 'https://opencode.ai/docs/skills',
      notes:
        'Global skills directory from OpenCode docs; confirm with local help. Pass --skills-dir to override.',
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
