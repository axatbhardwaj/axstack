import { expect, test } from 'bun:test';
import { parsePermalink } from '../../skills/axstack-work-chat/scripts/read.js';
import { readViaPlaywright } from '../../skills/axstack-work-chat/scripts/mcp.js';

const slack = 'https://work.slack.com/archives/C12345678/p1795093200000000';
const teams = 'https://teams.microsoft.com/l/message/19%3Aexample%40thread.v2/1795093200000?tenantId=12345678-1234-4321-1234-123456789012';
const slackSelector = '[data-item-key="1795093200.000000"] [data-qa="message-text"]';
const teamsSelector = '[id="message-body-1795093200000"]';

function runFixture(permalink, scenario) {
  return readViaPlaywright([process.execPath, import.meta.filename, `--fixture-${scenario}`],
    parsePermalink(permalink), 1500, { env: {}, cwd: import.meta.dir });
}

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
}
