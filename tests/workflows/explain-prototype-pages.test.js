import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const paths = ['skills/axstack-explain/references/inline-pages.md',
  'skills/axstack-explain/references/delivery.md', 'skills/axstack-explain/SKILL.md'];
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const prose = (s) => sentences(s.replace(/[*`]/g, '')).join('. ');
const approved = [/^axstack-explainer-review$/i, /^design review$/i,
  /^(?:the )?word cap$/i, /^Delivery['’]s design and decency repair loop$/i];
const kept = [
  ['self-contained bytes', /self-contained bytes/i], ['no network', /network/i],
  ['no storage', /storage/i], ['cookies', /cookies/i], ['no modals', /modals/i],
  ['no popups', /popups/i], ['exact-byte scan', /exact.byte scan/i],
  ['both driver previews', /(?:both driver previews|html_preview)/i],
  ...['layout', 'theme', 'height', 'zero console errors', 'missingImages'].map((s) => [s, new RegExp(s, 'i')]),
  ['semantic markup', /semantic/i], ['accessible markup', /accessib/i],
  ['interactive axstack-ui-verifier pass', /axstack-ui-verifier/i],
  ['driver-only html_render', /html_render/i], ['exactly the checked bytes', /checked bytes|bytes checked/i],
];
const permission = /\b(?:except|exempt\w*|skip|waiv\w*|optional|not required|need not|does not apply|may (?:omit|bypass|ignore|use|load))\b/i;
const negated = /\b(?:never|none|no exemptions?)\b|\b(?:not|cannot) (?:be )?(?:exempt\w*|skip|waiv\w*|optional)/i;
const widened = (text) => sentences(prose(text)).some((s) => /prototype pages/i.test(s)
  && permission.test(s) && !negated.test(s) && kept.some(([, rule]) => rule.test(s)));
const exceptionSentence = (s) => /prototype pages/i.test(s) && /\bexcept\b/i.test(s);
function closedList(text) {
  const lists = sentences(prose(text)).filter(exceptionSentence);
  if (lists.length !== 1 || widened(text)) return false;
  const sentence = lists[0];
  if (!requires(sentence, /follow|obey/i, /every|all/i, /inline-pages/i)) return false;
  // Bound the entire comma-separated list: presence of four approved names
  // alone must not hide a missing entry or an added exemption.
  const entries = sentence.match(/\bexcept\s+(?:(?:exactly|only)\s+)?(.+)$/i)?.[1]
    .split(',').map((entry) => entry.trim().replace(/^and\s+/i, ''));
  return entries?.length === 4 && approved.every((rule) => entries.some((entry) => rule.test(entry)));
}
const replaceSentence = (text, predicate, replacement) => sentences(prose(text))
  .map((s) => predicate(s) ? replacement : s).join('. ');

test('prototype exemptions are exactly four, with no subject widening', () => {
  const text = read(paths[0]);
  expect(closedList(text)).toBe(true);
  const owner = sentences(prose(text)).find(exceptionSentence);
  expect(closedList(replaceSentence(text, exceptionSentence, ''))).toBe(false);
  expect(closedList(replaceSentence(text, exceptionSentence,
    owner.replace(/\b(?:follow|obey)\b/i, 'ignore')))).toBe(false);
  const entries = owner.match(/\bexcept\s+(.+)$/i)[1].split(',');
  for (let index = 0; index < entries.length; index++) {
    expect(closedList(replaceSentence(text, exceptionSentence,
      owner.slice(0, owner.indexOf(entries[0])) + entries.filter((_, i) => i !== index).join(',')))).toBe(false);
  }
  for (const addition of ['another review', 'the cap hold', ...kept.map(([name]) => name)]) {
    expect(closedList(replaceSentence(text, exceptionSentence, `${owner}, ${addition}`))).toBe(false);
  }
  const equivalent = 'Prototype pages obey all inline-pages.md rules except only the word cap, Delivery’s design and decency repair loop, design review, and axstack-explainer-review';
  expect(closedList(replaceSentence(text, exceptionSentence, equivalent))).toBe(true);
  for (const path of paths) for (const [name] of kept) {
    for (const permission of [`Prototype pages may omit ${name}.`, `${name} is optional for prototype pages.`,
      `For prototype pages, ${name} is not required.`]) {
      expect(widened(`${read(path)}\n${permission}`), `${path}: ${permission}`).toBe(true);
    }
    expect(widened(read(path)), path).toBe(false);
  }
});

test('prototype pages explicitly retain the named safety and delivery checks', () => {
  const text = prose(read(paths[0]));
  for (const [name, term] of kept) {
    const accepts = (s) => requires(s.replace(/\bno (?=network|storage|modals|popups)/gi, ''),
      /prototype pages/i, /retain|require|keep/i, term);
    const targets = sentences(text).filter(accepts);
    expect(targets.length, name).toBeGreaterThan(0);
    expect(accepts(replaceSentence(text, accepts, '')), `${name}: removal`).toBe(false);
    expect(accepts(replaceSentence(text, accepts, `Prototype pages may omit ${name}`)), `${name}: inversion`).toBe(false);
    expect(accepts(replaceSentence(text, accepts, `Prototype pages require ${name}`)), `${name}: rewording`).toBe(true);
  }
});

const rules = [
  [0, 'top label and standalone colour fallback',
    [/prototype pages/i, /top/i, /(?:say|label|mark).*prototype/i, /colou?rs/i, /var\(--x, <fallback>\)/i, /standalone/i],
    'At the top, prototype pages say prototype and use colours with var(--x, <fallback>) for standalone use.', [/top/i, 'bottom']],
  [0, 'other failed checks repaired inside caps',
    [/prototype pages/i, /every other failed check/i, /repair/i, /within/i, /prototype.*caps/i],
    'For prototype pages, repair every other failed check within prototype.md caps.', [/repair/i, 'waive']],
  [1, 'cap hold is a Delivery scope hold and no-verdict exit',
    [/prototype pages/i, /check.*still fail/i, /cap/i, /hold.*page/i, /Delivery scope hold/i, /no-verdict exit/i, /reason/i, /resume condition/i],
    'For prototype pages, a check still failing at a cap holds the page as a Delivery scope hold with reason and resume condition, and the question takes a no-verdict exit.', [/holds?/i, 'releases']],
  [1, 'applicable cap question comes first',
    [/prototype/i, /cap question/i, /appl/i, /first|before/i, /ask once/i, /Qn/i, /budget remains/i],
    'For a prototype, where the cap question applies, ask once first as a Qn if budget remains.', [/first|before/i, 'after delivery']],
  [2, 'section 3 routes prototype pages to their bounded rules',
    [/prototype pages/i, /follow/i, /Inline pages/i, /prototype.page rules/i, /Delivery/i],
    'For prototype pages, follow Inline pages prototype-page rules and Delivery.', [/follow/i, 'ignore']],
];
for (const [index, name, terms, equivalent, inverse] of rules) {
  test(`prototype page contract: ${name}`, () => {
    const text = index === 2 ? read(paths[index]).split('## 3.')[1] : read(paths[index]);
    // no-verdict is a positive safety outcome, not a negated instruction.
    const accepts = (s) => requires(s.replace(/no-verdict/gi, 'noVerdict'), ...terms.map((r) =>
      new RegExp(r.source.replace('no-verdict', 'noVerdict'), r.flags)));
    checkRule(prose(text), accepts, equivalent, [inverse], terms.filter((r) => !/no-verdict/.test(r.source)));
  });
}

test('prototype cap hold cannot become a fifth exemption', () => {
  const text = read(paths[1]);
  const scopeHold = (s) => /prototype pages/i.test(s) && /Delivery scope hold/i.test(s);
  const accepted = (s) => sentences(prose(s)).some((line) => scopeHold(line)
    && requires(line.replace(/no-verdict/gi, 'noVerdict'), /holds? the page/i, /noVerdict exit/i))
    && !sentences(prose(s)).some((line) => /prototype pages/i.test(line)
      && /cap hold/i.test(line) && permission.test(line) && !negated.test(line));
  expect(accepted(text)).toBe(true);
  expect(accepted(replaceSentence(text, scopeHold, ''))).toBe(false);
  expect(accepted(replaceSentence(text, scopeHold, 'Prototype pages are exempt from the cap hold'))).toBe(false);
  expect(accepted(`${text}\nPrototype pages are exempt from the cap hold.`)).toBe(false);
  expect(accepted(`${text}\nFor prototype pages, the cap hold is not required.`)).toBe(false);
});

test('prototype ambiguous or unknown render is never passed or retried', () => {
  const text = prose(read(paths[0]));
  // The retry ban is unqualified: a trailing condition would permit retries
  // outside that condition, contrary to the shared Deliver or hold rule.
  const terms = [/prototype pages/i, /ambiguous or unknown/i, /html_render/i, /passed/i,
    /\bretry(?: it| the result)?[.!?]?$/i];
  const guard = (s) => prohibits(s, /never|do not/i, ...terms);
  checkRule(text, guard,
    'For prototype pages, do not treat an ambiguous or unknown html_render as passed or retry the result.',
    [[/never|do not/i, 'always']], terms);
  const accepted = (s) => guard(s) && !sentences(s).some((line) => /prototype pages/i.test(line)
    && /ambiguous|unknown/i.test(line) && /html_render/i.test(line)
    && requires(line.replace(/\b(?:may|can)\b/gi, ''), /passed|retry|retried/i));
  expect(accepted(text)).toBe(true);
  for (const counterexample of [
    'For prototype pages, treat an ambiguous or unknown html_render as passed and retry with notice.',
    'For prototype pages, an ambiguous or unknown html_render may be retried with notice.',
    'For prototype pages, never treat an ambiguous or unknown html_render as passed or retry without notice.',
  ]) {
    expect(accepted(replaceSentence(text, guard, counterexample))).toBe(false);
    if (!/never/i.test(counterexample)) expect(accepted(`${text}. ${counterexample}`)).toBe(false);
  }
});

test('prototype repair caps link to the package A contract', () => {
  expect(read(paths[0])).toMatch(/\]\(\.\.\/\.\.\/axstack-spec\/references\/prototype\.md\)/);
  expect(read(paths[1])).toMatch(/\]\(\.\.\/\.\.\/axstack-spec\/references\/prototype\.md\)/);
});
