import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => existsSync(`${import.meta.dir}/../../${path}`)
  ? readFileSync(`${import.meta.dir}/../../${path}`, 'utf8') : '';
const reference = 'skills/axstack-publish/references/review-briefs.md';
const brief = sentences(read(reference)).join('. ');
const publish = sentences(read('skills/axstack-publish/SKILL.md')).join('. ');
const inline = sentences(read('skills/axstack-explain/references/inline-pages.md')).join('. ');
const explain = sentences(read('skills/axstack-explain/SKILL.md')).join('. ');
function rule(name, source, concepts, rewording, inversions, prohibition) {
  test(name, () => checkRule(source,
    (text) => prohibition ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts),
    rewording, inversions, concepts));
}

rule('high severity protects reader truth, privacy and working pages', brief,
  [/high/i, /reader/i, /believe something false/i, /privacy leak/i, /broken page/i],
  'High covers a broken page, a privacy leak, or making a reader believe something false.',
  [[/high/i, 'low'], [/believe something false/i, 'prefer other wording']]);
rule('medium severity identifies a concrete fidelity error', brief,
  [/medium/i, /specific overstated label/i, /misquote/i, /wrong number/i],
  'A misquote, wrong number or specific overstated label is medium severity.',
  [[/medium/i, 'low']]);
rule('phrasing preferences never exceed low severity', brief,
  [/phrasing preferences/i, /low severity/i, /above low/i],
  'Phrasing preferences never rise above low and receive low severity.',
  [[/never/i, 'sometimes']], /never/i);
rule('headings cannot overstate their body', brief,
  [/headings/i, /stronger/i, /body/i],
  'Headings must never make a stronger claim than the body.',
  [[/never/i, 'always']], /never/i);
rule('context and comparators cannot support or refute a hypothesis', brief,
  [/place/i, /context/i, /comparators/i, /evidence/i, /for or against/i, /hypothesis/i],
  'Never place comparators or context as evidence for or against a hypothesis.',
  [[/never/i, 'always']], /never/i);
rule('absence claims are bounded by the actual search', brief.replace(/we found no/g, 'bounded search'),
  [/bound absence claims/i, /bounded search/i, /searched sources/i, /timeframe/i],
  'Bound absence claims to the searched sources and timeframe using “bounded search…”.',
  [[/bound absence claims/i, 'generalize absence claims']]);
rule('each repair finding binds claim, label and permitted placement', brief,
  [/every repair finding/i, /require/i, /claim ID/i, /research label/i,
    /allowed location/i, /heading/i, /body/i, /table column/i],
  'For every repair finding, require an allowed location (table column, body or heading), research label and claim ID.',
  [[/require/i, 'skip'], [/every repair finding/i, 'some findings']]);
rule('the author receipt records each actual text repair', brief,
  [/require/i, /before→after line/i, /every finding/i, /author receipt/i],
  'For every finding, require a before→after line in the author receipt.',
  [[/require/i, 'skip'], [/every finding/i, 'selected findings']]);
rule('Publish articles have no word cap', publish, [/Publish articles/i],
  'Publish articles carry no word cap.', [[/no word cap/i, 'a 700-word cap']], /no word cap/i);
rule('Publish shows reading time by the headline', publish,
  [/show/i, /reading.time line/i, /near the headline/i],
  'Near the headline, show a reading-time line.', [[/show/i, 'omit']]);
rule('the 700-word page and reply cap is inline-only', inline,
  [/count/i, /page and reply together/i, /700-word cap/i, /inline T3 pages only/i],
  'For inline T3 pages only, count page and reply together under the 700-word cap.',
  [[/inline T3 pages only/i, 'all published articles']]);
rule('Explain caps chat, HTML and every other format except Publish articles', explain,
  [/maximum of 700 words/i, /\bchat\b/i, /\bHTML\b/i, /every other requested format/i,
    /except Publish articles/i, /\bfollow\b/i, /Publish.s length rule/i, /reading.time line/i, /near the headline/i],
  "Keep a maximum of 700 words for chat, HTML and every other requested format, except Publish articles, which follow Publish's length rule with a reading-time line near the headline and no word cap.",
  [[/except Publish articles/i, 'including Publish articles'],
    [/every other requested format/i, 'inline T3 pages only'],
    [/\bfollow\b/i, 'ignore'], [/no word cap/i, 'a 700-word cap']], /no word cap/i);

test('Publish preparation and Explain delivery load the shared brief templates', () => {
  const preparation = read('skills/axstack-publish/SKILL.md').split('## 2.')[1].split('## 3.')[0];
  for (const [source, link] of [
    [preparation, 'references/review-briefs.md'],
    [read('skills/axstack-explain/references/delivery.md'), '../../axstack-publish/references/review-briefs.md'],
  ]) {
    expect(source).toContain(link);
    checkRule(sentences(source).join('. '), (text) => requires(text, /\b(?:use|follow)\b/i, /review and repair briefs/i),
      'Follow the shared review and repair briefs for article work.',
      [[/\b(?:use|follow)\b/i, 'ignore'], [/\b(?:use|follow)\b/i, 'because'], [/\b(?:use|follow)\b/i, 'reuse']]);
  }
});
