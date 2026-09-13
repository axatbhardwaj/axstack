import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');

test('scope identity: routing defines proportional substantial, small, and unclear paths', () => {
  const routing = read('skills/axstack/references/routing.md');
  expect(routing).toMatch(/proportional scope identity/i);
  expect(routing).toMatch(/substantial[^.]*feature[^.]*multi-PR[^.]*stacked/i);
  expect(routing).toMatch(/approved spec[^.]*ticket map[^.]*spec revision/i);
  expect(routing).toMatch(/ticket map[^.]*acceptance[^.]*dependencies/i);
  expect(routing).toMatch(/Markdown[^.]*Linear|Linear[^.]*Markdown/i);
  expect(routing).toMatch(/small-change intent/i);
  expect(routing).toMatch(/recorded request[^.]*existing issue[^.]*acceptance checks[^.]*exclusions[^.]*snapshot/i);
  expect(routing).toMatch(/unclear[^.]*clarif[^.]*then[^.]*classif[^.]*small[^.]*substantial/i);
  expect(routing).toMatch(/classif[^.]*brief reason/i);
  expect(routing).toMatch(/additional PR/i);
  expect(routing).toMatch(/new execution dependency[^.]*materially expands/i);
  expect(routing).toMatch(/unsettled material design question/i);
  expect(routing).toMatch(/security[^.]*infrastructure boundary/i);
  expect(routing).toMatch(/ordinary test[^.]*code[^.]*not[^.]*growth/i);
  expect(routing).toMatch(/minor file dependency[^.]*not[^.]*formal spec/i);
  expect(routing).toMatch(/later phase[^.]*own identity check/i);
  expect(routing).not.toMatch(/later phase invoked directly with its required inputs starts there/i);
  expect(routing).not.toMatch(/New work:[\s\S]*?axstack-align[\s\S]*?axstack-spec[\s\S]*?axstack-tickets[\s\S]*?axstack-implement/i);
});

test('scope identity: entry reports missing substantial prerequisites and launches nothing', () => {
  const entry = read('skills/axstack/SKILL.md');
  expect(entry).toMatch(/small-change intent/i);
  expect(entry).toMatch(/substantial[^.]*small[^.]*unclear/i);
  expect(entry).toMatch(/record[^.]*brief reason/i);
  expect(entry).toMatch(/report[^.]*exact gap/i);
  expect(entry).toMatch(/name[^.]*axstack-align/i);
  expect(entry).toMatch(/launch nothing/i);
  expect(entry).toMatch(/never\s+admit[^.]*deeper\s+phase[^.]*reject/i);
  expect(entry).not.toMatch(/starting at the earliest phase whose required inputs are missing/i);
  expect(entry).not.toMatch(/start at `axstack-align`/i);
});

test('scope identity: driver captures a current small-change intent without bouncing to alignment', () => {
  for (const [name, text] of [
    ['routing', read('skills/axstack/references/routing.md')],
    ['entry', read('skills/axstack/SKILL.md')],
  ]) {
    expect(text, `${name}: missing driver capture`).toMatch(
      /driver[^.]*captures[^.]*small-change intent[^.]*current request[^.]*user[^.]*existing issue[^.]*acceptance checks[^.]*exclusions[^.]*snapshots[^.]*proceeds/i,
    );
    expect(text, `${name}: missing no-bounce rule`).toMatch(
      /not[^.]*axstack-align[^.]*solely[^.]*not yet written/i,
    );
  }
});

test('scope identity: contracts, implement, and authored review accept the same two identities', () => {
  const contracts = read('skills/axstack/references/contracts.md');
  const implement = read('skills/axstack-implement/SKILL.md');
  const review = read('skills/axstack-review/SKILL.md');
  const authored = review.slice(review.indexOf('## Authored mode'), review.indexOf('## Two-reviewer contract'));
  for (const [name, text] of [
    ['contracts', contracts],
    ['implement', implement],
    ['authored review', authored],
  ]) {
    expect(text, `${name}: missing named small identity`).toMatch(/small-change intent/i);
    expect(text, `${name}: missing substantial identity`).toMatch(/approved spec/i);
    expect(text, `${name}: missing independent identity check`).toMatch(/confirm|check|verify/i);
  }
  expect(contracts).toMatch(/recorded\s+request[^.]*existing\s+issue[^.]*acceptance\s+checks[^.]*exclusions[^.]*snapshot/i);
});

test('scope identity: alignment stops with a handoff for both sizes and tickets carry dependencies', () => {
  const align = read('skills/axstack-align/SKILL.md');
  const tickets = read('skills/axstack-tickets/SKILL.md');
  expect(align).toMatch(/small-change intent[^.]*handoff/i);
  expect(align).toMatch(/approved spec[^.]*ticket map[^.]*handoff/i);
  expect(align).toMatch(/stop[^.]*both/i);
  expect(align).toMatch(/user[^.]*invokes[^.]*axstack[^.]*execute/i);
  expect(align).not.toMatch(/skip to that phase skill/i);
  expect(tickets).toMatch(/^Depends:/m);
  expect(tickets).toMatch(/still-valid approval[^.]*never repeated/i);
});

test('scope identity: public docs and local-record exemption describe the proportional rule', () => {
  const readme = read('README.md');
  const workflows = read('docs/workflows.md');
  const spec = read('docs/specs/v1.md');
  const record = read('skills/axstack/references/run-record.md');
  for (const [name, text] of [
    ['README', readme],
    ['workflow docs', workflows],
    ['spec', spec],
  ]) {
    expect(text, `${name}: missing substantial path`).toMatch(/substantial[^.]*approved\s+spec[^.]*ticket/i);
    expect(text, `${name}: missing small-change path`).toMatch(/small[^.]*request|small[^.]*issue/i);
  }
  expect(workflows).toMatch(/2026-09-13[^.]*user-requested/i);
  expect(spec).toMatch(/2026-09-13[^.]*user-requested/i);
  expect(record).toMatch(/tiny-task exemption[^.]*not[^.]*scope-identity exemption/i);
});
