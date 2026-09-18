// Pure planning and byte-preserving edits for the Axstack-owned routing block.
import { hashContent } from './manifest.js';

const BEGIN = '<!-- axstack:begin v1 -->';
const END = '<!-- axstack:end -->';

export function renderInstructionBlock(skillsDir) {
  return [
    BEGIN,
    'Use Axstack for engineering work: invoke the matching `axstack-*` skill directly.',
    'Route every subagent, delegated worker, reviewer, and cross-harness dispatch through Orca orchestration via the `orca` CLI and its `orca-cli` / `orchestration` skills so the work stays visible.',
    'Do not use a harness native subagent tool for delegated work.',
    END,
  ].join('\n');
}

export function locateInstructionBlock(text) {
  const begins = [...text.matchAll(/<!--\s*axstack:begin\b[^>]*-->/g)];
  const ends = [...text.matchAll(/<!--\s*axstack:end\s*-->/g)];
  if (begins.length === 0 && ends.length === 0) return null;
  if (begins.length !== 1 || ends.length !== 1) {
    throw new Error('invalid Axstack instruction markers: duplicate or incomplete marker');
  }
  if (!/^<!-- axstack:begin v\d+ -->$/.test(begins[0][0])) {
    throw new Error('invalid Axstack instruction begin marker');
  }
  const start = begins[0].index;
  const end = ends[0].index + ends[0][0].length;
  if (begins[0].index >= ends[0].index) {
    throw new Error('invalid Axstack instruction markers: nested or reversed marker');
  }
  const body = text.slice(start, end);
  if (/<!--\s*axstack:(?:begin|end)\b/.test(body.slice(begins[0][0].length, -ends[0][0].length))) {
    throw new Error('invalid Axstack instruction markers: nested marker');
  }
  return { start, end, block: body };
}

export function planInstruction({ text, block, ownership, force = false }) {
  if (text === null) {
    if (ownership) return { action: 'conflict', reason: 'owned instruction file is missing' };
    return { action: 'created', block, separation: '' };
  }
  const located = locateInstructionBlock(text);
  if (!located) {
    if (ownership) return { action: 'conflict', reason: 'owned instruction block is missing' };
    const separation = text.length === 0 ? '' : text.endsWith('\n') ? '\n' : '\n\n';
    return { action: 'updated', block, separation, append: true };
  }
  if (!ownership) {
    return { action: 'conflict', reason: 'instruction block is present but unowned' };
  }
  if (hashContent(located.block) !== ownership.hash) {
    if (!force) return { action: 'conflict', reason: 'owned instruction block was edited' };
  }
  if (located.block === block) return { action: 'unchanged', block, separation: ownership.separation ?? '' };
  return {
    action: 'updated',
    block,
    separation: ownership.separation ?? '',
    start: located.start,
    end: located.end,
    forced: hashContent(located.block) !== ownership.hash,
  };
}

export function applyInstructionPlan(text, plan) {
  if (plan.action === 'created') return plan.block;
  if (plan.action !== 'updated') return text;
  if (plan.append) return `${text}${plan.separation}${plan.block}`;
  return `${text.slice(0, plan.start)}${plan.block}${text.slice(plan.end)}`;
}

export function stripInstructionBlock(text, ownership, { force = false } = {}) {
  const located = locateInstructionBlock(text);
  if (!located || (!force && hashContent(located.block) !== ownership.hash)) {
    return { text, removed: false, conflict: true };
  }
  const separation = ownership.separation ?? '';
  const prefix = text.slice(0, located.start);
  if (separation && !prefix.endsWith(separation)) {
    return { text, removed: false, conflict: true };
  }
  return {
    text: prefix.slice(0, prefix.length - separation.length) + text.slice(located.end),
    removed: true,
    block: located.block,
  };
}

export function findLegacyRoutingLines(text) {
  const located = locateInstructionBlock(text);
  const outside = located
    ? text.slice(0, located.start) + text.slice(located.end)
    : text;
  return outside.split('\n').filter((line) =>
    /\bhaoshoku\b.*\b(?:rout\w*|skills?)\b|\b(?:planning-advisor|review-code|paseo-pr-review|paseo-pr-babysit)\b/i.test(line),
  );
}
