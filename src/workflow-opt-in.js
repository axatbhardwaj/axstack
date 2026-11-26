import { existsSync, linkSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync } from 'node:fs';
import { writeAtomic } from './installer.js';
import { writeFileExclusive } from './manifest.js';
import { dirname, join, resolve } from './posixpath.js';
import { matchesWorkflowConformance, validateWorkflowManifest } from '../skills/axstack/workflows/workflow-contract.mjs';
import { requireDrained, requireProbe, requireRunningT3Version, t3Environment, workflowT3Version } from './workflow-t3.js';

const MANIFEST = '.axstack-workflows.json';
const NAME = /^[A-Za-z0-9_][\w.-]*$/;

function sha256(bytes) {
  return new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
}

function inspect(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return null;
  }
}

function privateJson(path, kind) {
  const info = inspect(path);
  if (!info?.isFile() || info.uid !== process.getuid() || (info.mode & 0o077)) {
    throw new Error(`${kind} must be a private regular file owned by the current user`);
  }
  const bytes = readFileSync(path);
  let json;
  try {
    json = JSON.parse(bytes.toString());
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
  } catch {
    throw new Error(`${kind} must contain a JSON object`);
  }
  return { json, digest: sha256(bytes) };
}

function requirePrivateBinding(path, packageRoot, base) {
  if (!path?.startsWith('/') || path !== realpathSync(path)) {
    throw new Error('binding must be an absolute canonical file path outside the repository');
  }
  if ([realpathSync(packageRoot), base].some((root) => path === root || path.startsWith(root + '/'))) {
    throw new Error('binding must be outside the package and the T3 base');
  }
  for (let parent = dirname(path); parent !== '/'; parent = dirname(parent)) {
    if (existsSync(join(parent, '.git'))) throw new Error('binding must be outside the repository');
  }
  return privateJson(path, 'binding').digest;
}

function readManifest(path) {
  if (!inspect(path)) return { version: 1, workflows: {} };
  return validateWorkflowManifest(privateJson(path, 'workflow manifest').json);
}

function ownedFile(path, record) {
  const info = inspect(path);
  if (!info) return false;
  if (!record) throw new Error('workflow destination is unowned');
  if (!info.isFile() || sha256(readFileSync(path)) !== record.digest) {
    throw new Error('owned workflow file is modified');
  }
  return true;
}

async function deploy(path, bytes) {
  const stage = path + '.installing-' + crypto.randomUUID();
  await writeFileExclusive(stage, bytes);
  try {
    // An exclusive link publishes completed bytes without overwriting a competing file.
    linkSync(stage, path);
  } finally {
    unlinkSync(stage);
  }
}

async function saveManifest(path, manifest) {
  await writeAtomic(path, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
}

async function optIn({ base, directory, manifestPath, manifest, name, flags, packageRoot, t3 }) {
  const built = join(packageRoot, 'skills/axstack/workflows');
  const catalog = await Bun.file(join(built, 'catalog.json')).json();
  const version = Object.hasOwn(catalog, name) ? catalog[name] : null;
  // Only this triggerless workflow has a body safe to start as registration readback.
  if (name !== 'axstack-load-probe' || !Number.isSafeInteger(version) || version < 1) throw new Error('workflow is outside the shipped catalog');
  const t3Version = workflowT3Version(t3);
  const conformance = privateJson(flags.conformance, 'conformance receipt').json;
  if (!matchesWorkflowConformance(conformance, t3Version, t3Environment(base))) {
    throw new Error('conformance has no passing receipt for this T3 environment, version, and suite');
  }
  requireRunningT3Version(base, t3Version);
  const binding = flags.binding;
  const bindingDigest = requirePrivateBinding(binding, packageRoot, base);
  const identity = name + '@' + version;
  const bytes = readFileSync(join(built, 'bundles', name + '-v' + version + '.mjs'));
  const digest = sha256(bytes);
  const target = join(directory, name + '-v' + version + '.mjs');
  const record = manifest.workflows[identity];
  const present = ownedFile(target, record);
  if (record && record.digest !== digest) throw new Error('changed workflow bundle requires a version bump');
  if (record && (record.bindingDigest !== bindingDigest || record.binding !== binding)) {
    throw new Error('binding differs from the recorded opt-in');
  }
  if (present) {
    await requireProbe(t3, base, name, version);
    return { identity, action: 'unchanged' };
  }
  if (Object.keys(manifest.workflows).some((key) => key.startsWith(name + '@') && Number(key.split('@')[1]) > version)) {
    throw new Error('a newer version is installed; remove it explicitly before rolling back');
  }
  const hadManifest = inspect(manifestPath) !== null;
  const ownership = record ?? { digest, binding, bindingDigest };
  if (!record) {
    // Record the binding before T3 can observe the bundle. A missing bundle
    // can be restored using this same record after an interrupted deployment.
    await saveManifest(manifestPath, {
      version: manifest.version, workflows: { ...manifest.workflows, [identity]: ownership },
    });
  }
  let deployed = false;
  try {
    await deploy(target, bytes);
    deployed = true;
    await requireProbe(t3, base, name, version);
  } catch (error) {
    if (deployed) {
      // Inventory can take time. Check the file after that read before unlinking.
      requireDrained(t3, base, name, version);
      if (ownedFile(target, ownership)) unlinkSync(target);
    }
    if (!record) {
      if (hadManifest) await saveManifest(manifestPath, manifest);
      else unlinkSync(manifestPath);
    }
    throw error;
  }
  return { identity, action: 'registered' };
}

async function remove({ base, directory, manifestPath, manifest, name, version, t3 }) {
  const identity = name + '@' + version;
  const target = join(directory, name + '-v' + version + '.mjs');
  const record = manifest.workflows[identity];
  if (!record) throw new Error('workflow is unowned');
  const present = ownedFile(target, record);
  requireDrained(t3, base, name, version);
  // Stage an existing definition outside T3's glob. A missing file leaves only ownership to remove.
  const staged = present ? target + '.removing-' + crypto.randomUUID() : null;
  if (staged) renameSync(target, staged);
  try {
    if (staged && !ownedFile(staged, record)) throw new Error('staged workflow disappeared during removal');
    requireDrained(t3, base, name, version);
    if (inspect(target)) throw new Error('workflow file reappeared during removal; retry');
    delete manifest.workflows[identity];
    await saveManifest(manifestPath, manifest);
  } catch (error) {
    if (staged && inspect(staged) && !inspect(target)) {
      linkSync(staged, target);
      unlinkSync(staged);
    }
    throw error;
  }
  if (staged) unlinkSync(staged);
  return { identity, action: 'removed' };
}

export async function manageWorkflow({ action, flags, home, packageRoot }) {
  const name = flags.name;
  const version = Number(flags.version);
  if (!flags.yes || !name || !NAME.test(name)) throw new Error('workflow operation requires --yes and a valid --name');
  if (action === 'opt-in' && (!flags.binding || !flags.conformance)) {
    throw new Error('opt-in requires --binding and --conformance');
  }
  if (action === 'remove' && (!/^[1-9]\d*$/.test(flags.version) || !Number.isSafeInteger(version))) {
    throw new Error('remove requires --version <positive integer>');
  }
  const t3 = Bun.which('t3');
  if (!t3) throw new Error('t3 is required on PATH');
  const base = join(realpathSync(home), '.t3');
  const directory = join(base, 'workflows');
  if (realpathSync(base) !== base || (Bun.env.T3CODE_HOME && resolve(Bun.env.T3CODE_HOME) !== base) ||
      (Bun.env.T3CODE_WORKFLOWS && resolve(Bun.env.T3CODE_WORKFLOWS) !== directory)) {
    throw new Error('workflow operation requires the default T3 base and workflow directory');
  }
  if (inspect(directory) && realpathSync(directory) !== directory) throw new Error('workflow directory is symlinked');
  const manifestPath = join(base, MANIFEST);
  const lock = manifestPath + '.lock';
  mkdirSync(lock, { mode: 0o700 });
  try {
    const manifest = readManifest(manifestPath);
    const input = { base, directory, manifestPath, manifest, name, flags, packageRoot, version, t3 };
    if (action === 'remove') return await remove(input);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    return await optIn(input);
  } finally {
    rmdirSync(lock);
  }
}
