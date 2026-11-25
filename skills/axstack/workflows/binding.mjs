export function bindingMatches(expected, actual) {
  return typeof expected === 'string' && /^[a-f0-9]{64}$/.test(expected) && expected === actual;
}
