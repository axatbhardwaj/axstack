export async function githubObject(request, route) {
  const reply = await request(route);
  return reply?.status === 200 ? reply.body : null;
}

// GitHub's Link header is the coverage proof for arrays. Counted envelopes
// additionally need the same total on every page and all reported rows.
export async function githubPages(request, route, query, key, identity) {
  const rows = [];
  const seen = new Set();
  let total;
  let last;
  for (let page = 1; page <= 50; page++) {
    const params = new URLSearchParams({ ...query, per_page: '100', page: String(page) });
    const reply = await request(route + '?' + params);
    const body = reply?.body;
    const batch = key ? body?.[key] : body;
    if (reply?.status !== 200 || !Array.isArray(batch) || batch.length > 100 || (page > 1 && !batch.length)) return null;
    if (key) {
      if (!Number.isSafeInteger(body.total_count) || body.total_count < 0 ||
          (total !== undefined && body.total_count !== total)) return null;
      total = body.total_count;
    }
    for (const row of batch) {
      const id = identity(row);
      if (id == null || seen.has(id)) return null;
      seen.add(id);
      rows.push(row);
    }
    const links = pageLinks(reply.link);
    if (!links || (links.last !== undefined && (links.last < page ||
        (last !== undefined && last !== links.last)))) return null;
    last ??= links.last;
    if (links.prev !== undefined && links.prev !== page - 1) return null;
    if (links.next === undefined) return (last === undefined || page === last) &&
      (total === undefined || total === rows.length) ? rows : null;
    if (links.next !== page + 1 || (last !== undefined && links.next > last) || !batch.length) return null;
  }
  return null;
}

function pageLinks(header) {
  const links = {};
  for (const part of header ? header.split(/,\s*(?=<)/) : []) {
    const [, href, kind] = /^\s*<([^>]+)>;\s*rel="(next|prev|first|last)"\s*$/.exec(part) ?? [];
    if (!href || Object.hasOwn(links, kind) || !URL.canParse(href)) return null;
    const url = new URL(href);
    const page = Number(url.searchParams.get('page'));
    if (url.origin !== 'https://api.github.com' || !Number.isSafeInteger(page) || page < 1) return null;
    links[kind] = page;
  }
  return links;
}
