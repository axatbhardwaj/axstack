import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const installation = () => read('docs/installation.md');

// The CLI's public spelling is an exact interface contract, unlike prose.
test('installation reference covers CLI help flags and commands', () => {
  const help = Bun.spawnSync(['bun', 'bin/axstack.js', '--help'], { cwd: root });
  expect(help.exitCode).toBe(0);
  const doc = installation();
  for (const flag of new Set(help.stdout.toString().match(/--[a-z]+(?:-[a-z]+)*/g))) {
    expect(doc, flag).toContain(flag);
    expect(doc.replaceAll(flag, ''), `${flag} omission`).not.toContain(flag);
  }
  for (const command of ['install', 'check', 'uninstall', '--help', '--version', '-h', '-V']) {
    expect(doc).toContain(`axstack ${command}`);
  }
});

for (const [name, concepts, rewording] of [
  ['HOME boundary', [/HOME/, /absolute/i, /home/i, /confirm\w*/i],
    'HOME defines the absolute home boundary used for write confirmation.'],
  ['Codex configuration', [/CODEX_HOME/, /AGENTS\.md/, /config\w*/i],
    'CODEX_HOME selects the Codex configuration directory containing AGENTS.md.'],
  ['Claude settings', [/CLAUDE_CONFIG_DIR/, /settings\.json/],
    'CLAUDE_CONFIG_DIR selects the directory containing settings.json.'],
  ['browser executable', [/ARCHIFY_CHROME/, /Chrome/, /executable/i],
    'ARCHIFY_CHROME selects the Chrome executable.'],
  ['archify fixture', [/AXSTACK_ARCHIFY_REPO/, /test-only/i, /repository/i],
    'AXSTACK_ARCHIFY_REPO is a test-only repository override.'],
]) {
  test(`installation environment: ${name}`, () => {
    const direction = /\b(?:defines|selects|is)\b/i;
    checkRule(installation().replace(/\s+/g, ' '), (text) => requires(text, ...concepts, direction), rewording,
      [[direction, 'does not select']], [...concepts, direction]);
  });
}

for (const [name, concepts, rewording] of [
  ['argument and validation errors', [/install/i, /exit\w* 1/i, /argument/i, /validation/i],
    'Install exits 1 for argument or validation errors.'],
  ['ownership and transaction failures', [/install/i, /exit\w* 1/i, /ownership/i, /transaction/i],
    'Install exits 1 for ownership or transaction failures.'],
  ['instruction conflict', [/install/i, /exit\w* 1/i, /instruction/i, /conflict/i],
    'Install exits 1 for an instruction conflict.'],
  ['roles not ready', [/install/i, /exit\w* 1/i, /roles/i, /ready/i],
    'Install exits 1 if the selected roles are not ready.'],
  ['legacy retirement failure', [/install/i, /exit\w* 1/i, /legacy/i, /retirement/i, /fail\w*|failure/i],
    'Install exits 1 for a legacy retirement failure.'],
  ['check gaps', [/check/i, /exit\w* 1/i, /any/i, /gap/i],
    'Check exits 1 for any reported gap.'],
]) {
  test(`installation exit codes: ${name}`, () => {
    // Mask only the expected negative status, rather than ignoring all denials.
    const accepts = (text) => requires(text.replace(/roles are not ready/gi, 'roles are unready'),
      ...concepts.map((concept) => concept.source === 'ready' ? /ready|unready/i : concept));
    checkRule(installation().replace(/\s+/g, ' '), accepts, rewording, [[/exit\w* 1/i, 'exits 0']]);
  });
}

test('installation check explains actual rows and separates driver MCP preflight', () => {
  const doc = installation();
  for (const label of ['bun', 'git', 'gh', 'gh stack', 't3']) expect(doc).toContain(`\`${label}\``);
  const concepts = [/check/i, /MCP readiness/i, /provider/i, /schedule activation/i, /mobile delivery/i];
  const accepts = (text) => prohibits(text, /does not prove/i, ...concepts);
  checkRule(doc.replace(/\s+/g, ' '), accepts,
    'Check does not prove MCP readiness, provider availability, schedule activation, or mobile delivery.',
    [[/does not prove/i, 'proves']], concepts);
  expect(doc).not.toMatch(/CLI labels in-session MCP readiness|separates[^.]*in-session MCP readiness/i);
});

test('installation model resolver documents its required selection and effort arguments', () => {
  const command = installation().match(/bun [^\n]*resolve-models\.js[^\n]*/)?.[0];
  expect(command).toBeDefined();
  for (const flag of ['--provider', '--capabilities', '--class', '--model', '--effort', '--exclude']) {
    expect(command, flag).toContain(flag);
  }
});

for (const [name, concepts, rewording] of [
  ['install force adoption', [/install/i, /--force/, /unknown/i, /take\w* ownership/i],
    'Install with --force can take ownership of unknown files at bundle destinations.'],
  ['uninstall force edits', [/uninstall/i, /--force/, /remove\w*/i, /edited/i, /owned/i],
    'Uninstall with --force can remove edited owned files.'],
]) {
  test(`installation force boundary: ${name}`, () => {
    const direction = /\bcan\b/i;
    checkRule(installation().replace(/\s+/g, ' '), (text) => requires(text, ...concepts, direction),
      rewording, [[direction, 'cannot']], [...concepts, direction]);
  });
}

for (const [name, script, flags, exits] of [
  ['Account picker', 'pick-instance.js', ['--provider', '--settings', '--json'], [0, 1, 2]],
  ['PR digest', 'pr-digest.js', ['--repo', '--prs', '--input', '--watermark'], [0, 10, 2]],
  ['Evidence archive', 'archive-evidence.js', ['--source-root', '--archive-root', '--repo', '--pr', '--run', '--task', '--head', '--dispatch', '--file', '--operation', '--manifest-hash'], [0, 1]],
]) {
  test(`installation packaged helper interface: ${name}`, () => {
    const section = installation().match(new RegExp(`^### ${name}\\n([\\s\\S]*?)(?=^#{2,3} |$(?![\\s\\S]))`, 'm'))?.[1];
    expect(section, `${name} documentation`).toBeDefined();
    expect(section).toContain(script);
    for (const flag of flags) expect(section, `${name} ${flag}`).toContain(flag);
    for (const code of exits) expect(section, `${name} exit ${code}`).toMatch(new RegExp(`exit ${code}\\b`));
  });
}
