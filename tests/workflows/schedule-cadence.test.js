import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
function shipped(dir) {
  return readdirSync(`${root}/${dir}`, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? shipped(path) : /\.md$/.test(path) ? [path] : [];
  });
}
const hourly = /hourly|every (?:one |1 )?hour|60[ -]minutes?|everyMs\s*:\s*3600000/i;
function hourlyManager(text) {
  const manager = /review[ -]manager|lane thread/i;
  return text.split(/\n\s*\n/).flatMap((block) => block.split(/[.!?;]\s+/).filter((statement) => {
    if (!manager.test(block) || !hourly.test(statement)) return false;
    const owner = statement.search(manager);
    const watch = statement.search(/\bwatch\b/i);
    return watch < 0 || owner >= 0 && owner < watch;
  }));
}
test('shipped instructions contain no hourly review-manager schedule', () => {
  const files = ['README.md', ...shipped('docs').filter((p) => !p.includes('/specs/') && !p.includes('/plans/')), ...shipped('skills')];
  const violations = files.flatMap((path) => hourlyManager(readFileSync(`${root}/${path}`, 'utf8')).map(() => path));
  expect(violations).toEqual([]);
});
test('hourly detector rejects cadence drift while preserving watch backstops', () => {
  for (const value of ['hourly', 'every hour', 'every 60 minutes', '60-minute', 'everyMs:3600000']) {
    expect(hourlyManager(`The review manager runs ${value}.`)).toHaveLength(1);
  }
  expect(hourlyManager('The review manager runs every 30 minutes.')).toEqual([]);
  expect(hourlyManager('The run watch uses a 60-minute backstop.')).toEqual([]);
});
test('a watch statement naming the review manager does not inherit its cadence', () => {
  expect(hourlyManager('The review manager runs every 30 minutes. The run watch keeps an hourly backstop.')).toEqual([]);
  expect(hourlyManager('The run watch observes the review manager on a 60-minute backstop.')).toEqual([]);
  expect(hourlyManager('The lane thread uses its recorded binding. Then schedule_task uses the packaged prompt hourly.')).toHaveLength(1);
});
test('manager context carries across sentences when the schedule statement omits its name', () => {
  expect(hourlyManager('The review manager uses the host clone. Configure its binding, then create an unbound hourly T3 schedule.')).toHaveLength(1);
});
