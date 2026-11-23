import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const skill = readFileSync(`${import.meta.dir}/../../skills/axstack-implement/SKILL.md`, 'utf8');
const section = skill.split(/^## 4\. /m)[1].split(/^## 5\. /m)[0]
  .replace(/--no-verify/g, 'noverifyflag').replace(/--no-env-file/g, 'noenvfileflag');
const prohibition = /\b(?:never|do not) (?:pass|use|override)\b/i;
const no = /\b(?:never|must not|do not)\b/i;
const nonzero = /\b(?:non[- ]?zero .*exit|exit (?:1 or 2|2 or 1))\b/i;
const trusted = /trusted (?:cwd|working directory)/i;
const envFlag = /noenvfileflag/;
const rules = [
  ['check before each commit',
    (text) => requires(text, /before (?:each|every) commit/i, /author|writer/i, /runs?|executes?/i,
      /hooks-check/i, trusted, /bun\s+noenvfileflag/i, /--repo/i),
    'The writer executes hooks-check before every commit from a trusted working directory using bun noenvfileflag <helper> --repo <checkout>.',
    [[/before/i, 'after'], [/runs?|executes?/i, 'skips'], [trusted, 'the target checkout']],
    [trusted, envFlag, /--repo/i]],
  ['nonzero exits hold the commit and cite JSON',
    (text) => requires(text, nonzero, /hooks-check/i, /hold|stop/i, /commit/i, /AXSTACK-QUESTION/, /JSON/),
    'If a non-zero exit comes from hooks-check, stop the commit and return AXSTACK-QUESTION citing the JSON.',
    [[nonzero, 'exit 0'], [/hold|stop/i, 'proceed with']], [/AXSTACK-QUESTION/, /JSON/]],
  ['authors cannot install hooks or write shared metadata',
    (text) => prohibits(text, no, /authors?|writers?/i, /install|set up/i, /hooks/i,
      /writ\w*|modif\w*/i, /shared Git metadata/i),
    'Writers must not set up hooks or modify shared Git metadata.',
    [[no, 'may']], [/install|set up/i, /shared Git metadata/i]],
  ['driver owns documented hook setup and resumes the author',
    (text) => requires(text, /driver/i, /appl\w*|performs?/i, /documented/i, /hook setup/i, /resum\w*/i, /author|writer/i),
    'The driver performs the documented hook setup before resuming the writer.',
    [[/driver/i, 'author'], [/resum\w*/i, 'canceling']]],
  ['author reruns the check and requires exit zero',
    (text) => requires(text, /author|writer/i, /reruns?|checks? again/i, /hooks-check/i, /commit/i, /only/i, /exit 0/i),
    'The writer reruns hooks-check and commits only after exit 0.',
    [[/exit 0/i, 'exit 2'], [/reruns?|checks? again/i, 'skips']]],
  ['commit flags cannot bypass hooks',
    (text) => prohibits(text, prohibition, /commit/i, /noverifyflag/, /-n\b/),
    'For commits, do not pass -n or noverifyflag.',
    [[prohibition, 'may use']], [/noverifyflag/, /-n\b/]],
  ['hooks path cannot be overridden on commit',
    (text) => prohibits(text, prohibition, /commit/i, /core\.hooksPath/, /override/i),
    'Do not override core.hooksPath when committing.',
    [[/\b(?:never|do not) /i, 'always ']]],
];

for (const [name, accepts, rewording, inversions, concepts] of rules) {
  test(`implement hooks check: ${name}`, () => {
    checkRule(section, accepts, rewording, inversions, concepts);
  });
}
