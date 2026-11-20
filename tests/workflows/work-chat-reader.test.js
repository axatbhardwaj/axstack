import { expect, test } from 'bun:test';
import { parsePermalink } from '../../skills/axstack-work-chat/scripts/read.js';
import { readViaPlaywright } from '../../skills/axstack-work-chat/scripts/mcp.js';

const slack = 'https://work.slack.com/archives/C12345678/p1795093200000000';
const teams = 'https://teams.microsoft.com/l/message/19%3Aexample%40thread.v2/1795093200000?tenantId=12345678-1234-4321-1234-123456789012';
const slackSelector = '[data-item-key="1795093200.000000"] [data-qa="message-text"]';
const teamsSelector = '[id="message-body-1795093200000"]';

function runFixture(permalink, scenario, thread = {}) {
  return readViaPlaywright([process.execPath, import.meta.filename, `--fixture-${scenario}`],
    { ...parsePermalink(permalink), ...thread }, 1500, { env: {}, cwd: import.meta.dir });
}

const start = 1795093201000;
const end = 1795093203000;
const window = { start, end };
const panes = { slack: '[data-qa="thread_flexpane"]', teams: '[data-tid="thread-pane"]' };

if (process.argv[2]?.startsWith('--fixture-')) {
  const scenario = process.argv[2].slice('--fixture-'.length);
  let initialized = false;
  let called = false;

  async function processRequest(line) {
    const { id, method, params } = JSON.parse(line);
    if (method === 'initialize') {
      if (params.protocolVersion !== '2024-11-05') throw new Error('wrong protocol');
      console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} } } }));
      return;
    }
    if (method === 'notifications/initialized') {
      initialized = true;
      return;
    }
    if (method !== 'tools/call' || params.name !== 'browser_run_code_unsafe' || !initialized || called) {
      throw new Error('only one fixed read tool call is permitted');
    }
    called = true;
    let href = 'about:blank';
    let routed;
    const mainFrame = {};
    const page = {
      mainFrame: () => mainFrame,
      context: () => ({ pages: () => scenario === 'restored' ? [page, {}] : [page] }),
      url: () => href,
      route: async (_, callback) => { routed = callback; },
      on: () => {},
      goto: async (url) => {
        if ((scenario === 'slack' && url !== slack) || (scenario === 'teams' && url !== teams)) throw new Error('unexpected link');
        let allowed = false;
        const route = (target) => ({
          request: () => ({ isNavigationRequest: () => true, frame: () => mainFrame, url: () => target }),
          abort: async () => {},
          continue: async () => { allowed = true; },
        });
        await routed(route('https://example.com/another-conversation'));
        if (allowed) throw new Error('unexpected navigation was allowed');
        await routed(route(url));
        if (!allowed) throw new Error('scoped navigation was blocked');
        href = scenario === 'redirect' ? 'https://work.slack.com/archives/C87654321/p1795093200000000'
          : scenario === 'slack' ? 'https://app.slack.com/client/T12345678/C12345678/thread/C12345678-1795093200.000000' : url;
        return { ok: () => true };
      },
      locator: (selector) => {
        if (scenario.startsWith('thread-') && Object.values(panes).includes(selector)) {
          const service = href === teams ? 'teams' : 'slack';
          const textSelector = '[data-qa="message-text"]';
          const pane = {
            checkVisibility: () => true,
            querySelectorAll: (query) => {
              if (query === (service === 'slack' ? slackSelector : teamsSelector)) {
                return scenario === 'thread-wrong-root' ? [] : [pane];
              }
              if (query !== (service === 'slack' ? '[data-item-key]' : '[id^="message-body-"]')) return [];
              return [0, 1000, 2000, 2001, 3000].map((offset) => {
                const time = 1795093200000 + offset;
                const body = {
                  checkVisibility: () => offset !== 2001,
                  innerText: `synthetic row ${offset / 1000}`,
                };
                return {
                  ...body,
                  id: 'message-body-' + time,
                  getAttribute: (name) => name === 'data-item-key' ? (time / 1000).toFixed(6) : null,
                  closest: () => offset === 2000 ? {} : pane,
                  querySelectorAll: (selector) => selector === textSelector ? [body] : [],
                };
              });
            },
          };
          return {
            waitFor: async () => {},
            evaluate: async (fn, args) => {
              Object.defineProperty(globalThis, 'location', { value: { href } });
              return fn(pane, args);
            },
          };
        }
        if (selector !== (href === teams ? teamsSelector : slackSelector)) throw new Error('unexpected selector');
        return {
          waitFor: async () => {
            if (scenario === 'nonunique') throw new Error('strict mode: two matches');
          },
          evaluate: async (fn, args) => {
            Object.defineProperty(globalThis, 'location', { value: { href: scenario === 'changed' ? 'https://example.com' : href } });
            return fn({ innerText: 'fixture message evidence' }, args);
          },
        };
      },
    };
    const read = new Function(`return (${params.arguments.code});`)();
    console.error('uncaptured fixture server diagnostic');
    const result = await read(page);
    console.log(JSON.stringify({
      jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text: `### Result\n${JSON.stringify(result)}\n\n### Page\nuncaptured fixture page metadata` }],
      },
    }));
  }

  let pending = '';
  for await (const part of Bun.stdin.stream().pipeThrough(new TextDecoderStream())) {
    pending += part;
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) await processRequest(line);
  }
} else {
  test('bounded stdio returns only the exact Slack and Teams message excerpts', async () => {
    for (const [link, scenario] of [[slack, 'slack'], [teams, 'teams']]) {
      expect(await runFixture(link, scenario)).toEqual({ text: 'fixture message evidence' });
    }
  });

  test('bounded stdio yields no evidence from restored tabs, redirects, ambiguous rows or SPA navigation', async () => {
    for (const scenario of ['restored', 'redirect', 'nonunique', 'changed']) {
      expect(await runFixture(slack, scenario)).toBeNull();
    }
  });

  test('thread reads only visible in-window rows from a pane with the exact root', async () => {
    const expected = {
      coverage: 'visible-thread',
      messages: [{ timestamp: new Date(start).toISOString(), text: 'synthetic row 1' }],
    };
    for (const [link, service] of [[slack, 'slack'], [teams, 'teams']]) {
      expect(await runFixture(link, `thread-${service}`, { window })).toEqual(expected);
    }
    expect(await runFixture(slack, 'thread-wrong-root', { window })).toBeNull();
  });
}
