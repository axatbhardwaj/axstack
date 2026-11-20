const protocolVersion = '2024-11-05';
const maxReplyLength = 256 * 1024;
const maxThreadRows = 25;

// Playwright MCP executes this fixed function privately over stdio. Only the
// validated permalink and its derived selector are inserted as JSON.
async function inspectMessage(page, scope, maxLength, maxRows) {
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

    const slack = scope.service === 'slack';
    const pane = slack ? '[data-qa="thread_flexpane"]' : '[data-tid="thread-pane"]';
    const target = page.locator(scope.window ? pane : scope.selector);
    await target.waitFor({ state: 'visible', timeout: 7_000 });
    const href = page.url();
    if (!inScope(href) || page.context().pages().length !== 1) return null;
    return await target.evaluate((element, { href, scope, pane, slack, maxLength, maxRows }) => {
      // Catch SPA navigation between the URL check and DOM evaluation.
      if (location.href !== href) return null;
      function excerpt(node) {
        const text = node.innerText?.trim();
        return text ? { text: text.slice(0, maxLength),
          ...(text.length > maxLength ? { truncated: true } : {}) } : null;
      }
      if (!scope.window) return excerpt(element);
      const roots = element.querySelectorAll(scope.selector);
      const visible = (node) => node.checkVisibility({ visibilityProperty: true, opacityProperty: true });
      if (roots.length !== 1 || !visible(roots[0])) return null;
      const rows = element.querySelectorAll(slack ? '[data-item-key]' : '[id^="message-body-"]');
      const messages = [];
      const seen = new Set();
      let truncated = false;
      for (const row of rows) {
        if (row.closest(pane) !== element) continue;
        const id = slack ? row.getAttribute('data-item-key') : row.id.slice('message-body-'.length);
        if (!(slack ? /^\d{10}\.\d{6}$/ : /^\d{13}$/).test(id) || seen.has(id)) continue;
        seen.add(id);
        const time = slack ? Number(id.replace('.', '').slice(0, 13)) : Number(id);
        if (time < scope.window.start || time >= scope.window.end) continue;
        const bodies = slack ? row.querySelectorAll('[data-qa="message-text"]') : [row];
        if (bodies.length !== 1 || !visible(bodies[0])) continue;
        if (messages.length === maxRows) {
          truncated = true;
          break;
        }
        const value = excerpt(bodies[0]);
        if (value) messages.push({ timestamp: new Date(time).toISOString(), ...value });
      }
      messages.sort((first, second) => first.timestamp.localeCompare(second.timestamp));
      return { coverage: 'visible-thread', messages, ...(truncated ? { truncated: true } : {}) };
    }, { href, scope, pane, slack, maxLength, maxRows }, { timeout: 2_000 });
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
    const code = `async (page) => (${inspectMessage.toString()})(page, ${JSON.stringify(scope)}, ${maxLength}, ${maxThreadRows})`;
    const reply = await request(2, 'tools/call', { name: 'browser_run_code_unsafe', arguments: { code } });
    if (reply?.isError || reply?.content?.length !== 1 || reply.content[0].type !== 'text') return null;
    // Even with snapshots disabled, Playwright may append page metadata. Emit
    // only the fixed function's JSON result, never the raw response or errors.
    const row = reply.content[0].text.match(/^### Result\n([^\n]+)(?:\n|$)/)?.[1];
    const result = row && JSON.parse(row);
    const clean = (value) => typeof value?.text === 'string' && value.text.length > 0 && value.text.length <= maxLength
      ? { text: value.text, ...(value.truncated === true ? { truncated: true } : {}) } : null;
    if (!scope.window) excerpt = clean(result);
    if (scope.window && result?.coverage === 'visible-thread' && Array.isArray(result.messages) &&
      result.messages.length <= maxThreadRows) {
      const messages = result.messages.map((message) => {
        const time = Date.parse(message?.timestamp);
        const value = clean(message);
        return value && time >= scope.window.start && time < scope.window.end
          ? { timestamp: new Date(time).toISOString(), ...value } : null;
      });
      if (messages.every(Boolean)) {
        excerpt = { coverage: 'visible-thread', messages, ...(result.truncated === true ? { truncated: true } : {}) };
      }
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
