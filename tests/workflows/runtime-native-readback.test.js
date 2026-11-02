import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';

const read = (file) => sentences(readFileSync(`${import.meta.dir}/../../skills/axstack/references/${file}`, 'utf8').replace(/`/g, '')).join('. ');
for (const file of ['t3-runtime.md', 'fleet-dispatch.md', 'automations.md']) {
  test(`native settings readback in ${file}`, () => {
    const text = read(file);
    // The identifier is retired: no positive requirement or competing fallback can reappear.
    const supportedReads = (source) => !source.includes('t3_thread_configuration');
    expect(supportedReads(text)).toBe(true);
    expect(supportedReads(`${text} Require t3_thread_configuration.`)).toBe(false);
    checkRule(text, (source) => requires(source, /(?:task_status|native task status)/i, /(?:t3_thread_read|thread reads)/i, /read.?back/i),
      'Settings readback must use native task status and thread reads.',
      [[/read.?back/i, 'unrelated telemetry']], [/read.?back/i]);
    checkRule(text, (source) => requires(source, /(?:unreturned|unavailable|missing) (?:effective )?fields/i, /unknown/i),
      'Unreturned effective fields must stay unknown.', [[/unknown/i, 'satisfied']], [/unknown/i]);
  });
}

test('configure is a read-only child read with an explicit thread ID', () => {
  checkRule(read('t3-runtime.md'), (source) => requires(source, /t3_thread_configure/, /read.only/i, /explicit child thread ID/i),
    'Use t3_thread_configure only as a read-only call with an explicit child thread ID.',
    [[/read.only/i, 'mutating'], [/explicit child thread ID/i, 'implicit current thread']],
    [/read.only/i, /explicit child thread ID/i]);
});
