import { fact, hold } from './launcher-policy.js';

function canonicalImage(reference) {
  const [repository, digest] = reference.split('@');
  const parts = repository.split('/');
  if (!parts[0].includes('.') && !parts[0].includes(':') && parts[0] !== 'localhost') parts.unshift('docker.io');
  if (parts[0] === 'docker.io' && parts.length === 2) parts.splice(1, 0, 'library');
  return `${parts.join('/')}@${digest}`;
}

export function dockerObservers(execute) {
  const inspect = async (kind, id) => {
    const r = await execute(['docker', kind, 'inspect', id]);
    if (r.exitCode !== 0) {
      if (/No such (container|object|image)/i.test(r.stderr)) return null;
      hold(`cannot inspect ${kind} ${id}`);
    }
    try { const [item] = JSON.parse(r.stdout); if (item) return item; } catch { /* Unknown is a hold. */ }
    hold(`incomplete ${kind} inspection ${id}`);
  };
  function owned(item, owner) {
    const labels = item.Config?.Labels;
    return labels?.['axstack.sandbox'] === 'true' && Object.entries(owner).every(([key, value]) => labels[`axstack.sandbox.${key}`] === String(value));
  }
  return {
    async inspectImages(p) {
      const volumes = {};
      for (const c of p.containers) {
        if (Object.hasOwn(volumes, c.image)) continue;
        const image = await inspect('image', c.image);
        if (!image?.Config || !image.RepoDigests?.some(reference => canonicalImage(reference) === canonicalImage(c.image))) hold(`image pin/config unavailable: ${c.image}`);
        volumes[c.image] = Object.keys(image.Config?.Volumes ?? {});
      }
      return volumes;
    },
    async removeContainer(owner, c) {
      const item = await inspect('container', c.id);
      if (!item) return;
      if (!owned(item, owner)) hold(`refuse unlabelled/foreign container ${c.id}`);
      await execute(['docker', 'rm', '--force', c.id]);
    },
    async containersGone(p) {
      for (const c of p.containers) if (await inspect('container', c.id)) return false;
      return true;
    },
    async inspectMounts(p) {
      const terms = [];
      for (const c of p.containers) {
        const item = await inspect('container', c.id);
        if (!item || !owned(item, p.owner)) hold(`container identity missing: ${c.id}`);
        if (!Array.isArray(item.Mounts)) hold(`mount observation unavailable: ${c.id}`);
        for (const t of c.tmpfs) {
          const expected = `rw,nosuid,nodev,${t.noexec ? 'noexec' : 'exec'},size=${t.bytes},uid=${t.uid},gid=${t.gid},mode=${t.mode}`;
          if (item.HostConfig?.Tmpfs?.[t.path] !== expected) hold(`missing/changed capped tmpfs: ${c.id} ${t.path}`);
        }
        if (['fetch', 'test'].includes(c.role)) {
          if (!item.Mounts.some(m => m.Type === 'bind' && m.Source === p.sourceExport.path && m.Destination === '/source' && m.RW === false)) hold(`source mount missing: ${c.id}`);
          if (!item.Mounts.some(m => m.Type === 'volume' && m.Name === p.storage.volumeName && m.Destination === '/dependencies' && m.RW === (c.role === 'fetch'))) hold(`capped dependency mount missing/changed: ${c.id}`);
        }
        for (const m of item.Mounts) {
          if (m.Type === 'volume' && !(m.Name === p.storage.volumeName && m.Destination === '/dependencies' && ['fetch', 'test'].includes(c.role))) hold(`uncreated volume mount: ${c.id} ${m.Destination}`);
          if (m.Type === 'tmpfs' && !c.tmpfs.some(t => t.path === m.Destination)) hold(`unplanned tmpfs: ${c.id}`);
          if (m.Type === 'bind' && !(m.Source === p.sourceExport.path && m.Destination === '/source' && m.RW === false)) hold(`unplanned bind mount: ${c.id}`);
        }
        terms.push(fact(`mounts-${c.id}`, 'pass', 'all volume mounts are launcher-created; declared VOLUME paths use capped tmpfs'));
      }
      return terms;
    },
    async engineVersion() {
      const r = await execute(['docker', 'version', '--format', '{{.Server.Version}}']);
      if (r.exitCode !== 0 || !r.stdout.trim()) hold('engine version unknown');
      return r.stdout.trim();
    },
  };
}
