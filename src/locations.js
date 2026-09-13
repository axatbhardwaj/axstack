// Supported harness skill locations. `discovery` records how the default
// directory was established: upstream docs, local CLI help, or unverified.
// Unverified harnesses (notably Grok) have no automatic destination: callers
// must pass an explicit --skills-dir override. Installing files alone never
// proves harness behavior; that needs a real end-to-end run.
export function harnessLocations() {
  return [
    {
      harness: 'claude',
      skillsDir: '~/.claude/skills',
      discovery: 'docs',
      notes:
        'Default from Claude Code docs; confirm with local help. Pass --skills-dir to override.',
    },
    {
      harness: 'codex',
      skillsDir: '~/.codex/skills',
      discovery: 'docs',
      notes:
        'Default from Codex docs; confirm with local help. Pass --skills-dir to override.',
    },
    {
      harness: 'opencode',
      skillsDir: '~/.config/opencode/skills',
      discovery: 'docs',
      notes:
        'Default from OpenCode docs; confirm with local help. Pass --skills-dir to override.',
    },
    {
      harness: 'grok',
      skillsDir: '(explicit --skills-dir required)',
      discovery: 'unverified',
      notes:
        'No verified skill directory for Grok; automatic discovery is unverified so an explicit --skills-dir override is required.',
    },
  ];
}
