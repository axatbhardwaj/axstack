import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, prohibits, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const skill = 'skills/axstack-brainstorm/SKILL.md';
const arena = 'skills/axstack-brainstorm/references/arena.md';
const align = 'skills/axstack-align/SKILL.md';
const positive = (...concepts) => (text) => requires(text, ...concepts);
const negative = (ban, ...concepts) => (text) => prohibits(text, ban, ...concepts);

// Public instruction boundaries, not live model compliance. Each rule names a
// distinct accepted behavior missing from the extracted Rung-2-only procedure.
// Directional inversions and paraphrases guard against token-only assertions.
const rules = [
  ['standalone usage', skill, positive(/standalone/i, /axstack-brainstorm/i, /problem/i, /candidate approach/i),
    'Standalone usage is /axstack-brainstorm with the problem and candidate approach.',
    'Avoid standalone /axstack-brainstorm with the problem and candidate approach.'],
  ['inline driver', skill, positive(/inline/i, /(?:current )?T3 (?:driver thread|thread.*driver)/i),
    'Run inline in the current T3 driver thread.', 'Do not run inline in the T3 driver thread.'],
  ['no coordinator delegation', skill, negative(/never delegate|do not delegate/i, /coordinator/i),
    'Do not delegate a coordinator.', 'Delegate a coordinator for every brainstorm.'],
  ['every brief challenges the premise and compares minimal alternatives', arena,
    positive(/every brief/i, /premise/i, /smallest change/i, /do(?:ing)? nothing/i),
    'Every brief requires checking the premise and comparing the smallest change with doing nothing.',
    'Every brief may skip the premise, smallest change, and doing nothing.'],
  ['light arena on every invocation', arena, positive(/every brainstorm/i, /light arena/i),
    'Every brainstorm runs a light arena.', 'Every brainstorm may skip the light arena.'],
  ['unanchored recommendations', arena, negative(/drafts? no recommendation|never drafts? (?:a )?recommendation/i,
    /driver/i, /until/i, /every|all/i, /candidate/i, /return|complet/i),
    'The driver never drafts a recommendation until all candidates return.',
    'The driver drafts a recommendation before all candidates return.'],
  ['judges only at Rung 2', arena, positive(/only at Rung 2/i, /(?:run|invoke|dispatch)/i, /judge/i),
    'Only at Rung 2, invoke the judges.', 'At Rung 1 and Rung 2, invoke the judges.'],
  ['agent blind spots are evidence prompts', arena, positive(/rubric/i, /evidence prompts/i,
    /(?:opened|read) files/i, /nearest example/i, /shortest path/i, /compiles/i),
    'The rubric uses evidence prompts for reading only opened files, copying the nearest example, and choosing the shortest path that compiles.',
    'The rubric may skip evidence prompts about opened files, the nearest example, and the shortest path that compiles.'],
  ['verdict and sketch handoff', skill, positive(/return/i, /recommend/i, /revise/i, /reject/i, /unresolved/i, /sketch/i, /Rejected/i, /Open/i),
    'Return a sketch with Rejected and Open plus a verdict of recommend, revise, reject, or unresolved.',
    'Do not return a sketch with Rejected and Open or a recommend, revise, reject, unresolved verdict.'],
  ['proposed questions return to caller', skill, positive(/return/i, /proposed questions/i, /caller/i),
    'Return proposed questions to the caller.', 'Never return proposed questions to the caller.'],
  ['no interview or Align invocation', skill, negative(/never|do not/i, /interview/i, /invoke Align/i),
    'Never interview the user or invoke Align.', 'Interview the user and invoke Align.'],
  ['report-only boundary', skill, positive(/report.only/i),
    'This procedure is report-only.', 'This procedure is not report-only.'],
  ['no prototype or execution approval', skill, negative(/do not|never/i, /prototype/i, /execution/i, /spec approval/i),
    'Do not prototype or grant execution or spec approval.', 'Prototype and grant execution and spec approval.'],
  ['Align calls inline on unresolved design', align, positive(/load/i, /Brainstorm/i, /inline/i, /unresolved/i, /Rung 1 or 2/i),
    'For unresolved Rung 1 or 2 design, load Brainstorm inline.',
    'For unresolved Rung 1 or 2 design, do not load Brainstorm inline.'],
  ['Align reuses receipts without another consultation', align, positive(/reuse/i, /brainstorm/i, /receipts/i, /replace/i, /adviser consult/i),
    'Reuse valid brainstorm receipts to replace the adviser consult for that question.',
    'Ignore brainstorm receipts and repeat the adviser consult for that question.'],
  ['Align draft-first exception waits for independent results', align,
    positive(/driver/i, /draft/i, /frontier/i, /recommendations/i, /except/i, /brainstorm questions/i,
      /frames/i, /brief/i, /rubric/i, /assesses? after/i, /candidates/i, /required judge rounds/i, /return/i),
    'The driver drafts the frontier and recommendations, except for brainstorm questions, where it frames the brief and rubric and assesses after candidates and required judge rounds return.',
    'The driver drafts the frontier and recommendations, except for brainstorm questions, where it frames the brief and rubric and assesses before candidates and required judge rounds return.'],
  ['standalone synthesis without a run record', arena,
    positive(/record/i, /synthesis note/i, /caller.s run record/i, /when one exists/i, /otherwise/i, /returned verdict/i),
    'Record the synthesis note in the caller\'s run record when one exists, otherwise include it in the returned verdict.',
    'Record the synthesis note in the caller\'s run record regardless of whether one exists and omit it from the returned verdict.'],
  ['README describes every light arena', 'README.md', positive(/every brainstorm/i, /light arena/i, /configured families/i),
    'Every brainstorm runs a light arena across configured families.',
    'Every brainstorm may skip the light arena across configured families.'],
  ['README reserves judges for hard Rung 2 choices', 'README.md', positive(/judges/i, /only for Rung 2/i, /hard.to.reverse/i),
    'Use judges only for Rung 2 hard-to-reverse choices.',
    'Use judges for both Rung 1 and Rung 2 hard-to-reverse choices.'],
  ['installation describes every light arena', 'docs/installation.md', positive(/every brainstorm/i, /light arena/i, /configured families/i),
    'Every brainstorm runs a light arena across configured families.',
    'Every brainstorm may skip the light arena across configured families.'],
  ['installation reserves judges for hard Rung 2 choices', 'docs/installation.md', positive(/judges/i, /only for Rung 2/i, /hard.to.reverse/i),
    'Use judges only for Rung 2 hard-to-reverse choices.',
    'Use judges for both Rung 1 and Rung 2 hard-to-reverse choices.'],
  ['standing draft exception covers every brainstorm', 'skills/axstack/references/contracts.md',
    positive(/exception/i, /every brainstorm/i, /driver/i, /assess/i, /after/i, /candidate/i),
    'The exception covers every brainstorm: the driver assesses after the candidates return.',
    'The exception covers only hard choices: the driver assesses before the candidates return.'],
];

for (const [name, path, check, paraphrase, inversion] of rules) {
  test(`brainstorm: ${name} survives rewording and rejects removal/inversion`, () => {
    const units = sentences(readFileSync(`${root}/${path}`, 'utf8'));
    const matches = units.filter(check);
    expect(matches, `${name}: declared once at its owner boundary`).toHaveLength(1);
    const rest = units.filter((unit) => !matches.includes(unit));
    expect(check(rest.join('. ')), `${name}: removal`).toBe(false);
    expect(check([...rest, inversion].join('. ')), `${name}: directional inversion`).toBe(false);
    expect(check([...rest, paraphrase].join('. ')), `${name}: equivalent rewording`).toBe(true);
  });
}
