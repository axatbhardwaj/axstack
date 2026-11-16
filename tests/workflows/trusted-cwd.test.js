import { afterAll, afterEach, expect, test } from 'bun:test';
import { checkRule, requires } from './prose-contract.js';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const source = `${import.meta.dir}/../..`;
const root = mkdtempSync(`${process.env.TMPDIR ?? '/tmp'}/trusted-cwd-`);
chmodSync(root, 0o700);
afterAll(() => rmSync(root, { recursive: true }));
const home = `${root}/home`, peer = `${root}/peer`, installed = `${home}/.agents/skills/axstack`;
for (const dir of [home, peer, `${root}/bin`]) mkdirSync(dir);
const env = { ...process.env, HOME: home, TMPDIR: root, PATH: `${root}/bin:${process.env.PATH}` };
function run(argv, cwd = '/') { return Bun.spawnSync(argv, { cwd, env }); }
function git(...args) {
  const result = run(['git', '-C', peer, ...args]);
  if (result.exitCode) throw Error(result.stderr.toString());
  return result.stdout.toString().trim();
}
git('init', '-qb', 'main');
writeFileSync(`${peer}/a`, 'base\n');
git('add', '.');
git('-c', 'user.name=Fixture', '-c', 'user.email=f@x', 'commit', '-qm', 'fixture');
const head = git('rev-parse', 'HEAD');
const preload = `${root}/preload-ran`, filter = `${root}/filter-ran`;
afterEach(() => { for (const path of [preload, filter]) if (existsSync(path)) rmSync(path); });
writeFileSync(`${peer}/bunfig.toml`, 'preload = ["./preload.js"]\n');
writeFileSync(`${peer}/preload.js`, `await Bun.write(${JSON.stringify(preload)}, 'ran'); console.log('{"forged":true}'); process.exit(0);`);
writeFileSync(`${peer}/.gitattributes`, '* filter=attack\n');
writeFileSync(`${peer}/a`, 'edit\n'); // Same size forces status to compare filtered contents.
writeFileSync(`${peer}/.env`, `GIT_CONFIG_COUNT=1\nGIT_CONFIG_KEY_0=filter.attack.clean\nGIT_CONFIG_VALUE_0="touch '${filter}'; cat"\n`);
writeFileSync(`${root}/empty.toml`, '');
writeFileSync(`${root}/body.md`, `<!-- axstack:proof -->\nFiles: 0\nLines added: 0\nLines removed: 0\nCommits: 0\nHead SHA: ${head}\nBase SHA: ${head}\n<!-- /axstack:proof -->`);
writeFileSync(`${root}/capabilities.json`, readFileSync(`${source}/tests/workflows/fixtures/t3-capabilities.json`));
writeFileSync(`${root}/response.json`, '{"data":{"repository":{}}}');
mkdirSync(`${root}/evidence`);
writeFileSync(`${root}/evidence/evidence.txt`, 'honest evidence\n');
writeFileSync(`${root}/bin/gh`, `#!${process.execPath}
const endpoint = process.argv[3];
console.log(JSON.stringify(endpoint === 'graphql' ? {data:{repository:{}}}
  : endpoint?.includes('/git/ref/') ? {object:{sha:${JSON.stringify(head)}}}
  : {changed_files:0,additions:0,deletions:0,commits:0,head:{sha:${JSON.stringify(head)}},base:{ref:'main'},body:await Bun.file(${JSON.stringify(`${root}/body.md`)}).text()}));`);
chmodSync(`${root}/bin/gh`, 0o700);
const install = run([process.execPath, `${source}/bin/axstack.js`, 'install', '--preset', 'mixed', '--bundle', source,
  '--skills-dir', `${home}/.agents/skills`, '--instructions', `${home}/AGENTS.md`, '--no-claude-settings', '--yes']);
if (install.exitCode) throw Error(install.stderr.toString());
// Old relative commands have real entrypoints, so their red is execution, not missing setup.
cpSync(`${installed}/scripts`, `${peer}/scripts`, { recursive: true });
mkdirSync(`${peer}/skills/axstack`, { recursive: true });
cpSync(`${installed}/scripts`, `${peer}/skills/axstack/scripts`, { recursive: true });
for (const file of ['pr-shape.js', 'git-argv.js']) cpSync(`${installed}/scripts/${file}`, `${peer}/${file}`);

const values = { bun: process.execPath, '<installed-axstack>': installed, '<repo-path>': peer,
  '<base>': head, '<head>': head, '<source>': head, '<number>': '7', '<owner/repo>': 'fixture/peer',
  '<owner/name>': 'fixture/peer', '<1,2>': '7', '<private-json>': `${root}/watermark.json`,
  '<saved-graphql-json>': `${root}/response.json`, '<codex|claude|grok>': 'codex', '<saved-json>': `${root}/capabilities.json`,
  '<level>': 'high', '<absolute-dir>': `${root}/evidence`, '<absolute-private-dir>': `${root}/archive`,
  '<full-sha>': head, '<id>': 'fixture', '<relative-path>': 'evidence.txt', '<path>': peer };
function argv(template) {
  const selected = template.replace('<--class <class>|--model <id|null>>', '--class sol')
    .replace('<--pr <number>|--run <id> --task <id>>', '--pr 7').replace(/\s*\[[^\]]*\]/g, '');
  return (selected.startsWith('bun ') ? selected : `bun ${selected}`).match(/<[^>]+>[^\s]*|\S+/g)
    .map(token => {
      for (const [key, value] of Object.entries(values)) if (token.startsWith(key)) return `${value}${token.slice(key.length)}`;
      return token;
    });
}

for (const [document, count] of [
  ['skills/axstack/references/pr-shape.md', 4], ['docs/installation.md', 4],
  ['skills/axstack/references/run-record.md', 1],
]) {
  test(`documented installed commands ignore peer startup code: ${document}`, () => {
    const text = readFileSync(`${source}/${document}`, 'utf8');
    const templates = [...text.matchAll(/(?:bun [^\n`]*?\/)?(?:pr-shape|resolve-models|pr-digest|archive-evidence|run-init)\.js [^\n`]+/g)]
      .map(m => m[0]);
    expect(templates.length).toBe(count);
    for (const template of templates) {
      expect(argv(template), template).toContain('--no-env-file');
      // Negative control: starting the trusted installed helper in this peer runs the preload.
      const old = run([process.execPath, `${installed}/scripts/pr-shape.js`, '--base', head, '--head', head], peer);
      expect(old.exitCode, old.stderr.toString()).toBe(0);
      expect(JSON.parse(old.stdout.toString()).forged).toBe(true);
      expect(existsSync(preload)).toBe(true);
      rmSync(preload);
      // Execute the documented startup location too, so a cwd regression reaches the attack.
      const result = run(argv(template), /trusted (?:cwd|working directory) `\/`/i.test(text) ? '/' : peer);
      expect(existsSync(preload), template).toBe(false);
      expect(existsSync(filter), template).toBe(false);
      expect(result.exitCode, `${template}\n${result.stderr}`).toBe(0);
      const output = result.stdout.toString();
      if (template.includes('pr-digest')) expect(output).toBe(''); // Empty saved/forge snapshots have no deltas.
      else {
        const data = JSON.parse(output);
        expect(data.forged).toBeUndefined();
        if (template.includes('--proof')) expect(data.terms.every(t => t.status === 'pass')).toBe(true);
        else if (template.includes('pr-shape')) expect(data.totals).toMatchObject({ files: 0, additions: 0, deletions: 0 });
        else if (template.includes('run-init')) expect(data.inputs.head).toBe(head);
        else if (template.includes('resolve-models')) expect(data.model).toBe('gpt-6.1-sol');
        else expect(data.status).toMatch(/archived|verified/);
      }
    }
  });
}

test('equals-form empty config and no-env-file block both startup vectors inside a peer', () => {
  const code = `const r = Bun.spawnSync(['git','-C',process.argv[1],'status','--porcelain']); process.exit(r.exitCode);`;
  const unsafe = run([process.execPath, `--config=${root}/empty.toml`, '-e', code, peer], peer);
  expect(unsafe.exitCode, unsafe.stderr.toString()).toBe(0);
  expect(existsSync(filter)).toBe(true); // An empty config alone still loads .env.
  rmSync(filter);
  const safe = run([process.execPath, `--config=${root}/empty.toml`, '--no-env-file', '-e', code, peer], peer);
  expect(safe.exitCode, safe.stderr.toString()).toBe(0);
  expect(existsSync(preload)).toBe(false);
  expect(existsSync(filter)).toBe(false);
});

test('installed-axstack resolves to an absolute installed skill directory at each new use site', () => {
  const shape = readFileSync(`${source}/skills/axstack/references/pr-shape.md`, 'utf8').replace(/`/g, '');
  const concepts = [/resolve/i, /<installed-axstack>/, /absolute/i, /installed axstack skill directory/i];
  checkRule(shape, text => requires(text, ...concepts),
    "Resolve <installed-axstack> as the installed axstack skill directory's absolute path.",
    [[/installed axstack skill directory/i, 'peer checkout'],
      [/installed axstack skill directory/i, 'peer axstack skill directory']], concepts);
  const record = readFileSync(`${source}/skills/axstack/references/run-record.md`, 'utf8');
  expect(record).toMatch(/\[[^\]]+\]\(pr-shape\.md#measure\)/);
});
