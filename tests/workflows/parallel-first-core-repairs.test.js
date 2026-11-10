import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');
const shared = 'skills/axstack/references/';
const owner = /responsible package or integration author/i;
const continuation = [/existing session/i, /worktree/i];
const routes = [
  ['candidate-publication.md', 'publication evidence mismatch', [/missing or mismatched evidence/i, /holds publication/i, /returns/i],
    'Missing or mismatched evidence holds publication and returns to the responsible package or integration author in its existing session and worktree.'],
  ['candidate-publication.md', 'prepublication diligence findings', [/resolve/i, /FINDINGS/i, /before publishing/i],
    'Resolve FINDINGS with the responsible package or integration author in its existing session and worktree before publishing.'],
  ['diligence.md', 'combined findings same round', [/Scope: FINDINGS/i, /returns/i, /same round/i, /blocks merge.ready/i],
    'Scope: FINDINGS returns to the responsible package or integration author in the same round and existing session and worktree and blocks merge-ready.'],
  ['workspace-hygiene.md', 'retained author repair resources', [/repairs return/i],
    'Repairs return to the responsible package or integration author in its existing session and worktree.'],
  ['docs/workflows.md', 'public same-session repair contract', [/repairs return/i],
    'Repairs return to the responsible package or integration author in its existing session and worktree.'],
];

for (const [file, name, triggers, rewording] of routes) {
  test(`M2 ${name}: responsible writer, removal/inversion/rewording`, () => {
    const path = file.startsWith('docs/') ? file : `${shared}${file}`;
    const concepts = [...triggers, owner, ...continuation];
    checkRule(read(path), (text) => requires(text, ...concepts), rewording,
      [[/responsible package or integration author/i, 'a replacement author'], [/^/, 'Never ']], concepts);
  });
}
