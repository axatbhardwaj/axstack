const protocolVersion = '2024-11-05';
const maxReplyLength = 64 * 1024;

// Playwright MCP executes this fixed function privately over stdio. Only the
// validated permalink and its derived selector are inserted as JSON.
async function inspectMessage(page, scope, maxLength) {
  function inScope(href) {
    if (href === scope.url) return true;
    if (scope.service !== 'slack') return false;
    const url = new URL(href);
    if (url.origin !== 'https://app.slack.com' || url.search || url.hash) return false;
    const parts = url.pathname.split('/');
    if (parts[1] !== 'client' || !/^T[A-Z0-9]{8,}$/.test(parts[2]) || parts[3] !== scope.conversation) return false;
    return parts.length === 4 ||
      (parts.length === 6 && parts[4] === 'thread' && parts[5] === scope.conversation + '-' + scope.thread);
  }

  if (page.context().pages().length !== 1 || page.url() !== 'about:blank') return null;
  try {
    await page.route('**/*', (route) => {
      const request = route.request();
      if (request.isNavigationRequest() && (request.frame() !== page.mainFrame() || !inScope(request.url()))) {
        return route.abort();
      }
      return route.continue();
    });
    page.on('popup', (popup) => { void popup.close().catch(() => {}); });
    const response = await page.goto(scope.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    if (!response?.ok() || !inScope(page.url())) return null;

    const message = page.locator(scope.selector);
    await message.waitFor({ state: 'visible', timeout: 7_000 });
    const href = page.url();
    if (!inScope(href) || page.context().pages().length !== 1) return null;
    return await message.evaluate((element, scope) => {
      // Catch SPA navigation between the URL check and DOM evaluation.
      if (location.href !== scope.href) return null;
      const text = element.innerText?.trim();
      if (!text) return null;
      return {
        text: text.slice(0, scope.maxLength),
        ...(text.length > scope.maxLength ? { truncated: true } : {}),
      };
    }, { href, maxLength }, { timeout: 2_000 });
  } catch {
    return null;
  }
}

export async function readViaPlaywright(command, scope, maxLength, { env, cwd }) {
  const child = Bun.spawn(command, {
    env, cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore', timeout: 35_000,
  });
  const stream = child.stdout.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';

  async function request(id, method, params) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...(id ? { id } : {}), method, params }) + '\n');
    await child.stdin.flush();
    if (!id) return;

    while (true) {
      const newline = pending.indexOf('\n');
      if (newline >= 0) {
        const frame = JSON.parse(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        if (frame.jsonrpc !== '2.0') throw new Error();
        if (frame.id === id) {
          if (frame.error) throw new Error();
          return frame.result;
        }
        continue;
      }
      const part = await stream.read();
      if (part.done || pending.length + part.value.length > maxReplyLength) throw new Error();
      pending += part.value;
    }
  }

  let excerpt = null;
  try {
    const server = await request(1, 'initialize', {
      protocolVersion, capabilities: {}, clientInfo: { name: 'axstack-work-chat', version: '1' },
    });
    if (server?.protocolVersion !== protocolVersion || !server.capabilities?.tools) return null;
    await request(undefined, 'notifications/initialized', {});
    const code = `async (page) => (${inspectMessage.toString()})(page, ${JSON.stringify(scope)}, ${maxLength})`;
    const reply = await request(2, 'tools/call', { name: 'browser_run_code_unsafe', arguments: { code } });
    if (reply?.isError || reply?.content?.length !== 1 || reply.content[0].type !== 'text') return null;
    // Even with snapshots disabled, Playwright may append page metadata. Emit
    // only the fixed function's JSON result, never the raw response or errors.
    const row = reply.content[0].text.match(/^### Result\n([^\n]+)(?:\n|$)/)?.[1];
    const result = row && JSON.parse(row);
    if (typeof result?.text === 'string' && result.text.length > 0 && result.text.length <= maxLength) {
      excerpt = { text: result.text, ...(result.truncated === true ? { truncated: true } : {}) };
    }
  } catch {
    // Protocol, launch and page diagnostics may contain private page data.
  } finally {
    try {
      await child.stdin.end();
    } finally {
      await stream.cancel().catch(() => {});
      await child.exited;
    }
  }
  return child.exitCode === 0 ? excerpt : null;
}
