// The pinned upstream payload only; owned front-door guidance and theme.js stay checked.
export const VENDORED_PATHS = [
  'skills/axstack-anatomy/kit/**',
  'skills/axstack-anatomy/scripts/**',
  'skills/axstack-anatomy/references/**',
  'skills/axstack-anatomy/examples/**',
  'skills/axstack-anatomy/ANATOMY.md',
  'skills/axstack-anatomy/README.md',
  'skills/axstack-anatomy/CHANGELOG.md',
  'skills/axstack-anatomy/LICENSE',
];

export const isVendored = (path) => VENDORED_PATHS.some((pattern) =>
  pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern);
