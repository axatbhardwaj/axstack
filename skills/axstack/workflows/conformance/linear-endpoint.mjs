export function validLinearEndpoint({ endpoint, loopback }) {
  if (typeof endpoint !== 'string') return false;
  try {
    const url = new URL(endpoint);
    if (url.username || url.password || url.hash) return false;
    if (loopback === undefined || loopback === false) return endpoint.startsWith('https://') && url.protocol === 'https:';
    return loopback === true && /^http:\/\/127\.0\.0\.1:\d+(?=\/|\?|$)/.test(endpoint) &&
      url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port !== '0';
  } catch {
    return false;
  }
}
