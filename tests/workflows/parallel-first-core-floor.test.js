import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');
const shared = 'skills/axstack/references/';

for (const file of ['role-roster.md', 'routing.md']) {
  test(`M3 ${file}: every other mixed fanout retains its provider floor`, () => {
    const source = read(`${shared}${file}`);
    const concepts = [/every other|all other/i, /mixed fan.out/i,
      /(?:except|apart from) (?:precisely|only) same.binding writers and distinct.brief nonwriter packages,/i,
      /retains|must retain/i, /at least one/i, /Codex/i, /Claude/i];
    const accepts = (text) => requires(text, ...concepts);
    checkRule(source, accepts,
      'All other mixed fan-outs, apart from only same-binding writers and distinct-brief nonwriter packages, must retain at least one Claude and one Codex seat.',
      [[/retains|must retain/i, 'drops'], [/every other|all other/i, 'only corroborating']], concepts);
    const floor = sentences(source).find(accepts);
    expect(accepts(source.replace(floor, floor.replace(/nonwriter packages,/i,
      'nonwriter packages and unnamed ad hoc teams,')))).toBe(false);
    const consequence = source.split(/[.!?]\s+/).find((sentence) => accepts(sentence)).split(';')[1];
    checkRule(consequence, (text) => requires(text, /otherwise|else/i, /hold|block/i, /fan.out/i),
      'Else block that fan-out.',
      [[/hold|block/i, 'advance']], [/otherwise|else/i, /hold|block/i, /fan.out/i]);
  });
}
