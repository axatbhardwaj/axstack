import { prohibits, sentences } from './prose-contract.js';

// Closed-world theme check for Publish and standalone guidance, not live
// rendering proof. Every sentence using theme vocabulary is a conflict unless it
// is inline-only (names inline/T3/html_preview/anatomy and no Publish, published,
// article or standalone subject) or a conditional light ban. Mentioning an
// explicit user theme alone never exempts a demand.
// Limit: the check is bound to this vocabulary. Synonyms such as "bright" or
// "daytime", and negation games such as "never capture fewer than a light theme",
// are not detected.
const themeWord = /\blight\b|\b(?:both|two|either|each|all|multiple) (?:colou?r[- ])?(?:themes?|schemes?|modes?)\b|\btwo-theme\b/i;
const inlineScope = /\binline\b|\bT3\b|html_preview|anatomy/i;
const publishSubject = /\bPublish\b|\bpublished\b|\barticles?\b|\bstandalone\b/;
const ban = /never (?:capture|add|get|take|render|record|request|produce|include)\w*|(?<!never |not |n't )(?:omit|skip|drop|exclude)\w*(?: all| any| every)?/i;
const condition = /(?:without|unless|absent)\b.*explicit (?:user )?theme/i;

// Conditional light ban: skip/omit/drop or never capture/add/get light output,
// only without an explicit user theme.
export const bansLight = (text) => prohibits(text, ban, condition, /light/i);

export const themeConflicts = (text) => sentences(text).filter((sentence) => themeWord.test(sentence)
  && !(inlineScope.test(sentence) && !publishSubject.test(sentence)) && !bansLight(sentence));
