import { appendFileSync } from 'node:fs';

export async function fake(binary, dir) {
  const fixture = await Bun.file(dir + '/fixture.json').json();
  const { scenario, row, observed, worktrees, ownerThread, projectId } = fixture;
  const args = Bun.argv.slice(2);
  appendFileSync(dir + '/calls', JSON.stringify({ binary, args, leaked: Bun.env.AXSTACK_PRIVATE_TEST !== undefined }) + '\n');
  const remote = binary === 'ssh';
  if (remote && scenario.offline && args.includes('xzat@iobox')) process.exit(255);
  if (binary === 't3' && args[1] === 'show') {
    const briefs = await Bun.file(dir + '/briefs').json();
    console.log(JSON.stringify({
      thread: {
        threadId: ownerThread, projectId: scenario.ownerProjectId ?? projectId,
        createdBy: 'system', creationSource: 'server', status: 'completed',
        archived: false, pinned: false, worktreePath: null, providerInstanceId: 'codex', model: 'gpt-6.2-sol',
        runtimeMode: 'full-access',
      },
      messages: [...briefs.map((text) => ({ role: 'system', text })),
        ...(scenario.takenOver ? [{ role: 'user', text: 'private' }] : [])],
    }));
    return;
  }
  if (args.some((arg) => arg.includes("'thread' 'list'")) || args[1] === 'list') {
    const briefs = await Bun.file(dir + '/briefs').json();
    const cleaned = briefs.length === 2 && !scenario.missingReadback;
    const threads = remote ? [] : row.map((thread) => cleaned
      ? { ...thread, settled: true, archived: briefs[1].includes('/archive') }
      : thread);
    const list = { complete: true, includesDescendants: true, nextCursor: null, threads };
    const result = scenario.legacy ? threads :
      scenario.bare && !remote ? observed :
      scenario.partial && !remote ? { ...list, nextCursor: 'more' } :
      scenario.descendantGap && !remote ? { ...list, includesDescendants: false } : list;
    console.log(JSON.stringify(result));
    return;
  }
  if (args.some((arg) => arg.includes("'worktree' 'list'")) || args.includes('worktree')) {
    if (scenario.gitGap && !remote) process.exit(1);
    process.stdout.write(worktrees);
    return;
  }
  if (args.includes('rev-parse')) {
    console.log((scenario.movedHead ? 'd' : 'f').repeat(40));
    return;
  }
  if (args.includes('config')) {
    if (scenario.filterGap) process.exit(1);
    for (const key of scenario.configKeys ?? []) process.stdout.write(key + '\0');
    return;
  }
  if (args.includes('ls-files')) {
    if (scenario.submodule) process.stdout.write('160000 ' + 'f'.repeat(40) + ' 0\tnested\0');
    return;
  }
  if (args.includes('status')) {
    if (scenario.statusGap) process.exit(1);
    if (scenario.dirty) process.stdout.write('?? uncommitted.txt\0');
    return;
  }
  if (args.includes('rev-list')) {
    if (scenario.pushGap) process.exit(1);
    console.log(scenario.unpushed ? '1' : '0');
    return;
  }
  process.exit(91);
}
