export const hold = message => Object.assign(Error(message), { sandboxHold: true });

export async function commandRunner(argv) {
  const child = Bun.spawn(argv, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', timeout: 15000, killSignal: 'SIGKILL', env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', LANG: 'C' } });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { exitCode, stdout, stderr };
}

export function createFirewall({ runner = commandRunner } = {}) {
  async function readTable() {
    const result = await runner(['nft', '-j', 'list', 'table', 'inet', 'axstack_sandbox']);
    if (result.exitCode !== 0) throw hold(`Cannot read sandbox firewall: ${result.stderr}`);
    try { const data = JSON.parse(result.stdout); if (!Array.isArray(data.nftables)) throw Error(); return data.nftables; }
    catch { throw hold('Malformed firewall readback'); }
  }
  async function matches(wanted) {
    return (await readTable()).filter(item => item.rule?.chain === wanted.chain && item.rule?.comment === wanted.comment).map(item => item.rule);
  }
  // nft set ordering and object key ordering are not semantically significant.
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, key === 'counter' && (value[key] === null || Number.isSafeInteger(value[key]?.packets) && Number.isSafeInteger(value[key]?.bytes)) ? null : key === 'set' && Array.isArray(value[key]) ? value[key].map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : canonical(value[key])])) : value;
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  async function check(wanted, { allowAbsent = false } = {}) {
    const found = await matches(wanted);
    return allowAbsent && found.length === 0 || found.length === 1 && equal(found[0].expr, wanted.expr);
  }
  async function remove(wanted) {
    const found = await matches(wanted);
    if (found.some(rule => !equal(rule.expr, wanted.expr))) throw hold(`Changed firewall rule ${wanted.comment}`);
    for (const rule of found) {
      if (!Number.isSafeInteger(rule.handle) || rule.handle <= 0) throw hold('Missing rule handle');
      const result = await runner(['nft', 'delete', 'rule', 'inet', 'axstack_sandbox', wanted.chain, 'handle', String(rule.handle)]);
      // Another reaper may have removed this exact object. Readback decides.
      if (result.exitCode !== 0 && (await matches(wanted)).length) throw hold(`Rule deletion failed: ${wanted.comment}`);
    }
    if ((await matches(wanted)).length) throw hold(`Rule remains: ${wanted.comment}`);
    return true;
  }
  async function ensureTable() {
    const listed = await runner(['nft', '-j', 'list', 'tables']);
    if (listed.exitCode !== 0) throw hold('Cannot enumerate firewall tables');
    let tables;
    try { tables = JSON.parse(listed.stdout).nftables; if (!Array.isArray(tables)) throw Error(); } catch { throw hold('Malformed table enumeration'); }
    if (!tables.some(item => item.table?.family === 'inet' && item.table?.name === 'axstack_sandbox')) {
      await runner(['nft', 'add', 'table', 'inet', 'axstack_sandbox']);
    }
    for (const name of ['input', 'forward']) {
      let chain = (await readTable()).find(item => item.chain?.name === name)?.chain;
      if (!chain) {
        await runner(['nft', 'add', 'chain', 'inet', 'axstack_sandbox', name, `{ type filter hook ${name} priority -10; }`]);
        chain = (await readTable()).find(item => item.chain?.name === name)?.chain;
      }
      if (chain?.type !== 'filter' || chain.hook !== name || chain.prio !== -10 || chain.policy !== 'accept') throw hold(`Unexpected sandbox ${name} base chain; no policy changed`);
    }
  }
  async function checkChains({ allowAbsent = false } = {}) {
    const snapshot = await readTable();
    for (const name of ['input', 'forward']) {
      const chain = snapshot.find(item => item.chain?.name === name)?.chain;
      if (!chain && allowAbsent) continue;
      if (chain?.type !== 'filter' || chain.hook !== name || chain.prio !== -10 || chain.policy !== 'accept') throw hold(`Changed sandbox ${name} base chain; no policy changed`);
    }
    return snapshot;
  }
  return { readTable, check, remove, ensureTable, checkChains };
}

if (import.meta.main) {
  const [action, json] = process.argv.slice(2);
  if (action === '--help') console.log('Usage: network-firewall.js check|remove <rule JSON>\nSide effects: check reads only inet axstack_sandbox; remove deletes matching rule handles only. Never flushes a table or changes policy. Exit: 0 present/removed; 2 missing, changed or unknown; 1 malformed input.');
  else {
    try {
      const rule = JSON.parse(json);
      if (!['input', 'forward'].includes(rule.chain) || !/^axstack:[a-f0-9]{12}:\d+$/.test(rule.comment) || !Array.isArray(rule.expr)) throw Error('Invalid owned rule descriptor');
      const firewall = createFirewall();
      if (action === 'check') { if (!await firewall.check(rule)) throw hold(`Missing or changed rule ${rule.comment}`); }
      else if (action === 'remove') await firewall.remove(rule);
      else throw Error('Expected check or remove');
    } catch (error) { console.error(error.message); process.exitCode = error.sandboxHold ? 2 : 1; }
  }
}
