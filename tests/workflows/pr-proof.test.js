import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const shape = 'skills/axstack/references/pr-shape.md';
const ui = 'skills/axstack/references/ui-verification.md';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');

// Protect the publication contract, not agent compliance. Existing shape/UI
// checks cover sizing and capture quality, but not proof in PR descriptions.
const rules = [
  ['default Proof section', shape,
    [/every|each/i, /own PR description/i, /include|contain/i, /short|brief/i, /Proof.*section/i, /by default|default behavior/i,
      /what was verified|verified behavior/i, /how|method/i, /commands/i, /observed results|observations/i, /CI/i, /evidence links|links to evidence/i],
    'By default, each own PR description must contain a brief Proof section with verified behavior, method, commands, observations and CI or links to evidence.',
    [/include|contain/i, 'may include']],
  ['UI screenshots in description', shape,
    [/UI.related changes|UI changes/i, /embed|include/i, /screenshots/i, /PR description/i, /before\/after|before and after/i, /where meaningful|when useful/i],
    'For UI changes, include screenshots in the PR description, with before and after when useful.',
    [/embed|include/i, 'may include']],
  ['record interactions and motion', shape,
    [/when/i, /interaction/i, /motion/i, /matters|relevant/i, /embed|include/i, /short|brief/i, /screen recording/i, /GIF/i, /MP4/i, /PR description/i],
    'When interaction or motion is relevant, include a brief screen recording (MP4 or GIF) in the PR description.',
    [/embed|include/i, 'may include']],
  ['driver hosts proof on one orphan branch', shape,
    [/driver/i, /sole forge writer/i, /commits?|stores?/i, /proof assets/i, /dedicated orphan branch/i, /axstack-proof/i, /same repository/i, /<pr-number>\/<file>/i],
    'As sole forge writer, the driver stores proof assets in the same repository on the dedicated orphan branch `axstack-proof` under `<pr-number>/<file>`.',
    [/commits?|stores?/i, 'may store']],
  ['assets never enter PR branch', shape,
    [/commit|store/i, /proof assets/i, /PR branch/i],
    'Never store proof assets on the PR branch.',
    [/never/i, 'Always'], /never/i],
  ['embed GitHub blob URLs', shape,
    [/embed|include/i, /proof assets/i, /GitHub blob URLs/i, /\?raw=true/i],
    'Include proof assets using GitHub blob URLs ending in `?raw=true`.',
    [/embed|include/i, 'may include']],
  ['refresh affected proof after head changes', shape,
    [/refresh|update/i, /proof/i, /head changes|head revision changes/i, /affect/i],
    'Update proof whenever the head revision changes in a way that affects it.',
    [/refresh|update/i, 'skip updating']],
  ['redact sensitive data before posting', shape,
    [/before posting|before publication/i, /redact|mask/i, /secrets/i, /keys/i, /seed\/recovery phrases|seed and recovery phrases/i,
      /invite codes/i, /personal data/i, /private account details/i],
    'Before publication, mask secrets, keys, seed and recovery phrases, invite codes, personal data and private account details.',
    [/redact|mask/i, 'do not redact']],
  ['unsafe redaction uses explained text proof', shape,
    [/if|when/i, /safe redaction/i, /impossible|cannot/i, /describe|explain/i, /proof in text/i, /state|explain/i, /why/i, /image/i, /omitted|withheld/i],
    'When safe redaction is impossible, explain the proof in text and state why the image is withheld.',
    [/describe|explain/i, 'skip describing']],
  ['verifier returns private assets for PR proof', ui,
    [/return|save/i, /screenshots/i, /recordings/i, /private evidence folder/i, /PR Proof section/i],
    'Save screenshots and recordings in the private evidence folder for the PR Proof section.',
    [/return|save/i, 'do not return']],
];

for (const [name, path, concepts, rewording, inversion, prohibition] of rules) {
  test(`PR proof: ${name}; removal/inversion red, rewording green`, () => {
    const source = path === shape
      ? read(path).split('## PR body')[1]?.split('\n## ')[0] ?? '' : read(path);
    const accepts = (text) => prohibition
      ? prohibits(text, prohibition, ...concepts) : requires(text, ...concepts);
    checkRule(sentences(source).join('. '), accepts, rewording,
      [inversion, [/^/, 'Do not ']], concepts);
  });
}

test('UI verifier points to the shared PR body proof contract', () => {
  expect(read(ui)).toMatch(/\[[^\]]*PR Proof section[^\]]*\]\(pr-shape\.md#pr-body\)/i);
});
