// Isolated Executor read ported from POC-10. Emit coverage metadata only.
import { readFileSync } from 'node:fs';
import { validLinearEndpoint } from '../linear-endpoint.mjs';

const root = process.env.AXSTACK_CONFORMANCE_ROOT;
const { linear } = JSON.parse(readFileSync(root + '/client-binding.json', 'utf8'));

async function probe() {
  try {
    const { mcpServers } = JSON.parse(readFileSync(linear.clientFile, 'utf8'));
    const client = mcpServers?.executor;
    const headers = {
      Authorization: client?.headers?.Authorization ?? client?.headers?.authorization,
      'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
    };
    if (!headers.Authorization || client.url !== linear.endpoint || !validLinearEndpoint(linear)) {
      return { status: 'unknown' };
    }
    async function call(method, params, id) {
      const response = await fetch(linear.endpoint, {
        method: 'POST', redirect: 'error', headers, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({ jsonrpc: '2.0', method, params, ...(id === undefined ? {} : { id }) }),
      });
      if (!response.ok || id === undefined) return {};
      const body = await response.text();
      const message = response.headers.get('content-type')?.includes('text/event-stream')
        ? body.split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)))
          .find((part) => part.id === id)
        : JSON.parse(body);
      return { session: response.headers.get('mcp-session-id'), result: message?.result };
    }
    const init = await call('initialize', {
      protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'axstack-conformance', version: '1' },
    }, 1);
    if (!init.result?.protocolVersion) return { status: 'unknown' };
    headers['MCP-Protocol-Version'] = init.result.protocolVersion;
    if (init.session) headers['Mcp-Session-Id'] = init.session;
    await call('notifications/initialized', {});
    const code = `const r = await tools.${linear.tool}({limit:1,fields:["id","updatedAt"]});
if (!r.ok) return {ok:false};
const items = r.data.issues ?? r.data.nodes ?? r.data.results;
const p = r.data.pageInfo ?? r.data;
return {ok:true, count:Array.isArray(items)?items.length:null,
        hasNextPage:p.hasNextPage ?? null, hasCursor:Boolean(p.endCursor ?? p.nextCursor)};`;
    const { result } = await call('tools/call', { name: 'execute', arguments: { code } }, 2);
    const content = result?.content?.find((item) => item.type === 'text')?.text;
    const data = result?.structuredContent?.result ?? (content && !result.isError ? JSON.parse(content) : {});
    const coverage = (page) => page.hasNextPage === false && !page.hasCursor ? 'complete' : 'unknown';
    return data.ok && Number.isInteger(data.count) && data.count >= 0 && data.count <= 1
      ? { status: 'pass', coverage: coverage(data), failureCoverage: coverage({ hasNextPage: true, hasCursor: true }) }
      : { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  }
}

export default T3.workflow('ax-conf-linear', { version: 1, payload: Schema.Null }, () =>
  T3.step('executor-linear-read', { returns: Schema.Json }, Effect.promise(probe)));
