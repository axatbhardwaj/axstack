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

for (const [name, concepts, rewording, code = 1] of [
  ['argument and validation errors', [/\binstall\b/i, /exit\w* 1/i, /argument/i, /validation/i,
    /unknown command or flag/i, /missing flag value/i, /--profile/, /Claude settings flags/i,
    /Bun below/i, /preset/i, /skills target/i, /tools path/i, /bundle or manifest/i,
    /unsafe path or symlink/i, /overlapping/i, /home write/i, /--yes/],
    'Install exits 1 for argument or validation errors: unknown command or flag, missing flag value, obsolete --profile, conflicting Claude settings flags, Bun below the floor, invalid preset, unresolved skills target or tools path, malformed bundle or manifest, unsafe path or symlink, overlapping roots, or refused home write without --yes.'],
  ['ownership and transaction failures', [/\binstall\b/i, /exit\w* 1/i, /ownership/i, /transaction/i,
    /unknown destination/i, /--force/, /instruction.path binding/i, /archify record/i,
    /archify SHA mismatch/i, /settings\/sidecar conflict/i, /concurrent edit/i,
    /filesystem failure/i, /failed recovery/i],
    'Install exits 1 for ownership or transaction failures: unknown destination without --force, conflicting instruction-path binding, edited archify record, archify SHA mismatch, Claude settings/sidecar conflict, concurrent edit, filesystem failure, or failed recovery.'],
  ['instruction conflict', [/install/i, /exit\w* 1/i, /instruction/i, /conflict/i],
    'Install exits 1 for an instruction conflict.'],
  ['roles not ready', [/install/i, /exit\w* 1/i, /roles/i, /ready/i],
    'Install exits 1 if the selected roles are not ready.'],
  ['legacy retirement failure', [/install/i, /exit\w* 1/i, /legacy/i, /retirement/i, /fail\w*|failure/i],
    'Install exits 1 for a legacy retirement failure.'],
  ['check gaps', [/check/i, /exit\w* 1/i, /any/i, /gap/i, /failed capability row/i,
    /archify record\/copy\/SHA/i, /non.owned instruction binding/i, /legacy routing/i, /owned block/i],
    'Check exits 1 for any reported gap: a failed capability row, invalid archify record/copy/SHA, non-owned instruction binding, or legacy routing outside the owned block.'],
  ['check input failures', [/check/i, /argument/i, /bundle.validation/i, /filesystem/i, /errors/i, /exit\w* 1/i],
    'Check exits 1 for argument, bundle-validation, and filesystem errors.'],
  ['uninstall failures', [/uninstall/i, /exit\w* 1/i, /argument/i, /validation/i,
    /ownership.binding/i, /home.confirmation/i, /transaction/i, /errors/i],
    'Uninstall exits 1 for argument, validation, ownership-binding, home-confirmation, or transaction errors.'],
  ['install success and tolerated failures', [/\binstall\b/i, /exit\w* 0/i, /clean/i, /idempotent/i,
    /preserved edits/i, /ordinary owned skills/i, /unavailable archify/i, /offline host/i, /missing Git/i, /clone failure/i],
    'Install exits 0 for a clean or idempotent result, preserved edits to ordinary owned skills, or unavailable archify caused by an offline host, missing Git, or clone failure.', 0],
  ['check success and Chrome warning', [/check/i, /exit\w* 0/i, /no gaps|zero gaps/i, /Chrome absence/i, /warning/i],
    'Check exits 0 when there are zero gaps, and Chrome absence is a warning.', 0],
  ['uninstall success and preservation', [/uninstall/i, /exit\w* 0/i, /completion/i, /preserved user edits/i, /retained archify copies/i],
    'Uninstall exits 0 on completion, including preserved user edits and retained archify copies.', 0],
  ['help and version success', [/help/i, /version/i, /exit\w* 0/i, /Bun floor/i, /met/i],
    'Help and version exit 0 when the Bun floor is met.', 0],
  ['Bun floor before every command', [/every command/i, /\binstall\b/i, /\bcheck\b/i, /\buninstall\b/i,
    /help/i, /version/i, /Bun below/i, /exit\w* 1/i, /before argument parsing/i, /capability report/i],
    'For every command (install, check, uninstall, help and version), Bun below the floor exits 1 before argument parsing or any capability report.'],
]) {
  test(`installation exit codes: ${name}`, () => {
    // Mask only the expected negative status, rather than ignoring all denials.
    const accepts = (text) => requires(text.replace(/roles are not ready/gi, 'roles are unready').replace(/\bno gaps\b/gi, 'zero gaps'),
      ...concepts.map((concept) => concept.source === 'ready' ? /ready|unready/i : concept));
    checkRule(installation().replace(/\s+/g, ' '), accepts, rewording, [[new RegExp(`exit\\w* ${code}`, 'i'), `exits ${1 - code}`]], concepts);
  });
}

test('installation check explains actual rows and separates driver MCP preflight', () => {
  const doc = installation();
  for (const label of ['bun', 'git', 'gh', 'gh stack', 't3']) expect(doc).toContain(`\`${label}\``);
  const bunRow = [/bun row/i, /already.validated/i, /running version/i, /Bun below/i, /exit\w* 1/i, /before any row/i];
  checkRule(doc.replace(/`/g, '').replace(/\s+/g, ' '), (text) => requires(text, ...bunRow),
    'The bun row shows the already-validated running version because Bun below the floor exits 1 before any row is printed.',
    [[/before any row/i, 'after any row']], bunRow);
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
