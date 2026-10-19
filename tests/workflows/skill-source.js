import { readFileSync } from 'node:fs';

// Read split instructions in their original order for existing contract checks.
// Other files, and raw byte reads, retain ordinary filesystem behavior.
export function readSkillFile(path, encoding) {
  const source = readFileSync(path, encoding);
  if (typeof source !== 'string' || !/\/axstack-(?:review|watch)\/SKILL\.md$/.test(path)) return source;
  const directory = path.slice(0, -'SKILL.md'.length);
  return source.replace(/^Load and follow \[[^\]]+\]\((references\/[^)]+)\)\.\n\n/gm, (_, reference) => {
    const body = readFileSync(`${directory}${reference}`, 'utf8')
      .replace(/^#{2,3} [^\n]+\n\n/, '');
    // Express relocated links relative to the entry point, as before the split.
    return body.replace(/(\[[^\]]*\]\()([^\s)]+)(\))/g, (link, open, target, close) => {
      if (target.startsWith('../../')) return `${open}${target.slice(3)}${close}`;
      if (target.startsWith('../SKILL.md#')) return `${open}${target.slice('../SKILL.md'.length)}${close}`;
      return link;
    });
  });
}
