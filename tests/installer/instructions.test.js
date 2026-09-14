import { describe, expect, test } from 'bun:test';
import { hashContent } from '../../src/manifest.js';
import {
  applyInstructionPlan,
  planInstruction,
  renderInstructionBlock,
  stripInstructionBlock,
} from '../../src/instructions.js';

const skillsDir = '/tmp/ax skills';

describe('owned instruction block primitives', () => {
  test('renders deterministic v1 routing prose with only the actual entry pointer', () => {
    const block = renderInstructionBlock(skillsDir);
    expect(block).toBe(
      '<!-- axstack:begin v1 -->\n' +
        'Use Axstack for engineering work. Load `/tmp/ax skills/axstack/SKILL.md` to route the request.\n' +
        '<!-- axstack:end -->',
    );
    expect(block).not.toMatch(/model|opus|claude|codex/i);
  });

  test('creates, appends once, and records exact recoverable separation', () => {
    const block = renderInstructionBlock(skillsDir);
    const missing = planInstruction({ text: null, block, ownership: null });
    expect(missing).toEqual({ action: 'created', block, separation: '' });
    expect(applyInstructionPlan(null, missing)).toBe(block);

    const existing = 'personal text';
    const append = planInstruction({ text: existing, block, ownership: null });
    expect(append.action).toBe('updated');
    expect(append.separation).toBe('\n\n');
    const installed = applyInstructionPlan(existing, append);
    expect(installed).toBe(`${existing}\n\n${block}`);
    expect(planInstruction({
      text: installed,
      block,
      ownership: { hash: hashContent(block), separation: '\n\n' },
    }).action).toBe('unchanged');
  });

  test('upgrades pristine ownership but preserves edited and unowned blocks', () => {
    const old = renderInstructionBlock('/tmp/old');
    const current = renderInstructionBlock('/tmp/current');
    expect(planInstruction({
      text: old,
      block: current,
      ownership: { hash: hashContent(old), separation: '' },
    }).action).toBe('updated');

    const edited = old.replace('engineering work', 'all work');
    expect(planInstruction({
      text: edited,
      block: current,
      ownership: { hash: hashContent(old), separation: '' },
    }).action).toBe('conflict');
    expect(planInstruction({ text: old, block: current, ownership: null }).action).toBe('conflict');
    expect(planInstruction({ text: old, block: current, ownership: null, force: true }).action).toBe('conflict');
    expect(planInstruction({
      text: edited,
      block: current,
      ownership: { hash: hashContent(old), separation: '' },
      force: true,
    }).action).toBe('updated');
  });

  test('rejects duplicate, nested, and incomplete marker structures', () => {
    const block = renderInstructionBlock(skillsDir);
    for (const text of [
      `${block}\n${block}`,
      `<!-- axstack:begin v1 -->\n${block}\n<!-- axstack:end -->`,
      '<!-- axstack:begin v1 -->\nunfinished',
      'orphan\n<!-- axstack:end -->',
    ]) {
      expect(() => planInstruction({ text, block, ownership: null })).toThrow(/marker/i);
    }
  });

  test('uninstall strips only the exact owned block and recorded separator', () => {
    const original = 'personal text';
    const block = renderInstructionBlock(skillsDir);
    const installed = `${original}\n\n${block}`;
    expect(stripInstructionBlock(installed, {
      hash: hashContent(block),
      separation: '\n\n',
    })).toEqual({ text: original, removed: true, block });
    const edited = installed.replace('engineering work', 'all work');
    expect(stripInstructionBlock(edited, {
      hash: hashContent(block),
      separation: '\n\n',
    })).toEqual({ text: edited, removed: false, conflict: true });
  });
});
