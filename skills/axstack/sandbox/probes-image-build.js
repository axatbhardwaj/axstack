import { mkdir, rm, symlink } from 'node:fs/promises';

/** Fixed image-build commands. This plan does not fetch or install anything. */
export function provisionPlan(pins) {
  if (pins.platform !== 'linux/amd64' || !Array.isArray(pins.artifacts)) throw Error('unsupported pin manifest');
  const ids = new Set();
  return pins.artifacts.map((a) => {
    if (!/^[\w.-]+$/.test(a.id) || ids.has(a.id) || !a.version || !a.source?.startsWith('https://') || !a.url?.startsWith('https://') || !/^\/opt\/[\w./-]+$/.test(a.destination) || a.destination.split('/').includes('..')) throw Error('invalid pin');
    ids.add(a.id);
    if (!new RegExp(`^[a-f0-9]{${{ sha1: 40, sha256: 64, sha512: 128 }[a.algorithm] ?? 0}}$`).test(a.checksum)) throw Error(`invalid checksum ${a.id}`);
    if (!['sha1', 'sha256', 'sha512'].includes(a.algorithm)) throw Error(`unsupported checksum algorithm ${a.id}`);
    const stage = `/tmp/axstack-image-${a.id}`, archive = `${stage}/artifact`, dest = a.destination;
    const source = ['python', 'rust', 'cargo'].includes(a.kind) ? `${stage}/source` : dest;
    const steps = [];
    const command = (argv, cwd = '/') => steps.push({ argv, cwd });
    if (['tar', 'content', 'python', 'rust', 'cargo'].includes(a.kind)) {
      command(['mkdir', '-p', source]);
      command(['tar', '-xf', archive, '-C', source, `--strip-components=${a.strip ?? 0}`, '--no-same-owner']);
    } else if (['zip', 'android'].includes(a.kind)) {
      command(['mkdir', '-p', a.kind === 'android' ? `${stage}/unpacked` : dest]);
      command(['unzip', '-q', archive, '-d', a.kind === 'android' ? `${stage}/unpacked` : dest]);
      if (a.kind === 'android') command(['python3', '-c', 'import pathlib,shutil,sys; p=list(pathlib.Path(sys.argv[1]).iterdir()); assert len(p)==1 and p[0].is_dir(); shutil.copytree(p[0],sys.argv[2],dirs_exist_ok=True)', `${stage}/unpacked`, dest]);
    } else if (a.kind === 'file') {
      command(['mkdir', '-p', dest.slice(0, dest.lastIndexOf('/'))]);
      command(['cp', archive, dest]);
      if (a.id === 'solc') command(['chmod', '0755', dest]);
    } else throw Error(`unknown artifact recipe ${a.kind}`);
    if (a.kind === 'python') {
      command(['./configure', `--prefix=${dest}`, '--with-ensurepip=install'], source);
      command(['make', '-j2'], source); command(['make', 'install'], source);
    }
    if (a.kind === 'rust') command(['./install.sh', `--prefix=${dest}`, '--without=rust-docs', '--disable-ldconfig'], source);
    if (a.kind === 'cargo') command(['/opt/rust/bin/cargo', 'install', '--locked', '--path', source, '--root', dest]);
    if (a.kind === 'content') {
      command(['git', 'init', '-q', dest]);
      command(['git', '-C', dest, '-c', 'core.autocrlf=false', 'add', '-f', '.']);
      for (const link of a.gitlinks ?? []) command(['git', '-C', dest, 'update-index', '--add', '--cacheinfo', `160000,${link.sha},${link.path}`]);
      command(['git', '-C', dest, 'write-tree']);
    }
    if (a.id === 'swift') command(['sh', '-ec', `printf 'print("Swift smoke")\\n' > ${stage}/smoke.swift; /opt/swift/usr/bin/swift --version; /opt/swift/usr/bin/swiftc ${stage}/smoke.swift -o ${stage}/smoke; ${stage}/smoke`]);
    if (a.id === 'swiftlint') command(['mv', '/opt/swiftlint/swiftlint-static', '/opt/swiftlint/swiftlint']);
    if (a.id === 'swiftlint') command(['sh', '-ec', `printf 'print("Swift smoke")\\n' > ${stage}/smoke.swift; /opt/swiftlint/swiftlint version; /opt/swiftlint/swiftlint lint --strict --no-cache --quiet ${stage}/smoke.swift`]);
    return { id: a.id, status: 'unknown', evidence: [a.source], stage, downloadArgv: ['curl', '--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--proto-redir', '=https', '--max-time', '600', '--output', archive, a.url], verify: { path: archive, algorithm: a.algorithm, checksum: a.checksum }, steps, ...(a.tree ? { expectedTree: a.tree } : {}) };
  });
}

/** Verification precedes every install command; corruption stops the build. */
export async function verifyArtifact({ path, algorithm, checksum }) {
  const hash = new Bun.CryptoHasher(algorithm);
  for await (const chunk of Bun.file(path).stream()) hash.update(chunk);
  if (hash.digest('hex') !== checksum) throw Error(`checksum mismatch: ${path}`);
}

async function runCommand(argv, cwd = '/') {
  const child = Bun.spawn(argv, { cwd, env: { ...process.env, HOME: '/tmp/axstack-image-home', CARGO_HOME: '/tmp/axstack-image-cargo', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/tmp/axstack-image-gitconfig' }, stdin: 'ignore', stdout: 'pipe', stderr: 'inherit' });
  const output = await new Response(child.stdout).text();
  if (await child.exited !== 0) throw Error(`build command failed: ${JSON.stringify(argv)}`);
  return output.trim();
}

async function install(pins, artifactsOnly = false) {
  if (process.env.AXSTACK_IMAGE_BUILD !== '1' || process.getuid() !== 0) throw Error('run only in the Dockerfile image build');
  await mkdir('/tmp/axstack-image-home', { recursive: true });
  await Bun.write('/tmp/axstack-image-gitconfig', '');
  for (const item of provisionPlan(pins)) {
    await mkdir(item.stage, { recursive: false });
    await runCommand(item.downloadArgv);
    await verifyArtifact(item.verify);
    for (const step of item.steps) {
      const result = await runCommand(step.argv, step.cwd);
      if (step.argv.at(-1) === 'write-tree' && result !== item.expectedTree) throw Error(`upstream tree mismatch ${item.id}`);
    }
    const artifact = pins.artifacts.find((a) => a.id === item.id);
    if (artifact.kind === 'content') await rm(`${artifact.destination}/.git`, { recursive: true });
    await rm(item.stage, { recursive: true });
    console.log(JSON.stringify({ id: item.id, status: 'pass', evidence: [artifact.source, artifact.checksum, 'installed; toolchain smoke remains required'] }));
  }
  const links = {
    '/usr/local/bin/bun': '/opt/bun-1.4.4/bun-linux-x64/bun',
    '/usr/local/bin/npm': '/opt/npm/bin/npm-cli.js', '/usr/local/bin/npx': '/opt/npm/bin/npx-cli.js',
    '/usr/local/bin/pnpm': '/opt/pnpm/bin/pnpm.cjs', '/usr/local/bin/pnpx': '/opt/pnpm/bin/pnpx.cjs',
    '/usr/local/bin/solc': '/opt/svm/0.8.28/solc-0.8.28',
  };
  for (const v of ['1.2.2', '1.3.14', '1.4.4']) links[`/usr/local/bin/bun-${v}`] = `/opt/bun-${v}/bun-linux-x64/bun`;
  for (const [path, target] of Object.entries(links)) await symlink(target, path);
  // npm must resolve to the frozen inventory version rather than Node's bundled copy.
  for (const line of ['20', '22', '24']) for (const name of ['npm', 'npx']) {
    await rm(`/opt/node-${line}/bin/${name}`);
    await symlink(`/usr/local/bin/${name}`, `/opt/node-${line}/bin/${name}`);
  }
  await runCommand(['/opt/python-3.12/bin/python3', '-m', 'ensurepip']);
  await mkdir('/opt/android/licenses', { recursive: true });
  await Bun.write('/opt/android/licenses/android-sdk-license', `${pins.androidLicense.sha1}\n`);
  if (artifactsOnly) {
    for (const path of ['/tmp/axstack-image-home', '/tmp/axstack-image-cargo', '/tmp/axstack-image-gitconfig']) await rm(path, { recursive: true });
    return;
  }
  await preload();
}

async function preload() {
  if (process.env.AXSTACK_IMAGE_BUILD !== '1' || process.getuid() !== 0) throw Error('run only in the Dockerfile image build');
  await mkdir('/tmp/axstack-image-home', { recursive: true });
  await Bun.write('/tmp/axstack-image-gitconfig', '');
  // Pre-resolve AGP/Kotlin's transitive build artifacts with a trusted synthetic project.
  const project = '/tmp/axstack-image-gradle';
  await mkdir(project);
  await Bun.write(`${project}/settings.gradle.kts`, 'pluginManagement { repositories { maven { url = uri("/opt/android-maven") }; google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositories { google(); mavenCentral() } }\nrootProject.name = "sandbox-preload"\n');
  await Bun.write(`${project}/gradle.properties`, 'android.builtInKotlin=false\nandroid.newDsl=false\n');
  await Bun.write(`${project}/build.gradle.kts`, 'plugins { id("com.android.library") version "9.4.1"; id("org.jetbrains.kotlin.android") version "2.2.10" }\nandroid { namespace = "sandbox.preload"; compileSdk = 37; buildToolsVersion = "37.0.0"; defaultConfig { minSdk = 26 } }\n');
  await runCommand(['mkdir', '-p', `${project}/src/main`]);
  await Bun.write(`${project}/src/main/AndroidManifest.xml`, '<manifest xmlns:android="http://schemas.android.com/apk/res/android"/>');
  await runCommand(['/opt/gradle/gradle-9.6.0/bin/gradle', '--no-daemon', '--gradle-user-home', '/opt/gradle-build-cache', 'assembleDebug'], project);
  await runCommand(['mv', '/opt/gradle-build-cache', '/opt/gradle-cache']);
  for (const path of [project, '/tmp/axstack-image-home', '/tmp/axstack-image-cargo', '/tmp/axstack-image-gitconfig']) await rm(path, { recursive: true });
}

if (import.meta.main) {
  const mode = Bun.argv[2];
  if (mode === '--help') console.log('Usage: bun probes-image-build.js --plan|--run|--artifacts|--preload|--help\n--plan: read bundled pins, print pending per-artifact terms and exact download/install argv; no writes/network. --artifacts installs verified artifacts only; --preload builds the synthetic Android project only; --run does both. Writers: Dockerfile build only (root plus AXSTACK_IMAGE_BUILD=1), downloads pinned HTTPS artifacts, verifies published checksums, installs toolchains under /opt, creates /usr/local/bin links, uses/removes fixed /tmp/axstack-image-* scratch, preloads /opt/gradle-build-cache through a trusted synthetic project (network to upstream registries), moves its read-only dependency cache to /opt/gradle-cache. Public Solidity content is unpacked and Git-tree checked, no content scripts run. No host config, containers, mounts, credentials, dispatch or publication. Cleanup failure stops build. Exit 0 facts, 1 error; plan terms remain unknown until build and integration smoke.');
  else {
    try {
      const pins = await Bun.file(new URL('./probes-image-pins.json', import.meta.url)).json();
      if (mode === '--plan') console.log(JSON.stringify(provisionPlan(pins), null, 2));
      else if (mode === '--run' || mode === '--artifacts') await install(pins, mode === '--artifacts');
      else if (mode === '--preload') await preload();
      else throw Error('use --plan, --run or --help');
    } catch (error) { console.error(String(error)); process.exitCode = 1; }
  }
}
