import { prohibits, sentences } from './prose-contract.js';

// Semantic theme-conflict check for Publish and standalone guidance, not live
// rendering proof. Two-theme or light output belongs only to inline T3 pages or
// anatomy kits; elsewhere it must be scoped to an explicit user theme.
const lightOutput = /\blight[- ](?:mode|theme|pass|captures?|page|palette)\b|\blight at \d|\bboth themes\b|\blight and dark\b|\blight\/dark\b/i;
const explicitScope = /explicit (?:user )?theme/i;
const inlineScope = /\binline\b|\bT3\b|html_preview|anatomy/i;

export const themeConflicts = (text) => sentences(text).filter((sentence) =>
  lightOutput.test(sentence) && !explicitScope.test(sentence) && !inlineScope.test(sentence));

// Shared conditional light ban: never/omit-all light capture, scoped to the
// absence of an explicit user theme.
export const bansLight = (text) => prohibits(text, /never capture|omit all/i,
  /(?:without|unless)\b.*explicit (?:user )?theme/i, /light/i);
