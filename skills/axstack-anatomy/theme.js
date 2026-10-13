// Inject these exact bytes after the anatomy build's inline kit script.
function installAnatomyTheme({ doc = document, view = window, resolveColor } = {}) {
  const body = doc.body;
  const media = view.matchMedia('(prefers-color-scheme: dark)');
  // Canvas delegates every supported CSS color syntax to the browser, in sRGB.
  const color = resolveColor ?? ((value) => {
    const canvas = doc.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data;
  });
  if (!doc.getElementById('axstack-anatomy-theme')) {
    const style = doc.createElement('style');
    style.id = 'axstack-anatomy-theme';
    style.textContent = `
body.iso[data-axstack-t3] { margin:0; padding:0; background:transparent;
  --anatomy-page:transparent; --anatomy-mono:var(--font-mono);
  color:var(--foreground); font-family:var(--font-sans); }
body.iso[data-axstack-t3] .iso-page { margin:0; padding:0; width:100%; max-width:none; min-height:0; background:none; }
body.iso[data-axstack-t3] .iso-plate { padding:16px; border-radius:var(--radius); }
`;
    doc.head.appendChild(style);
  }
  const update = () => {
    const background = view.getComputedStyle(doc.documentElement).getPropertyValue('--background').trim();
    const marker = body.getAttribute('data-axstack-theme');
    let dark = media.matches;
    if (background) {
      const rgba = color(background);
      const alpha = rgba[3] / 255;
      const channel = (index) => {
        const value = (rgba[index] * alpha + 255 * (1 - alpha)) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      dark = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2) < 0.5;
      if (body.getAttribute('data-axstack-t3') === null) body.setAttribute('data-axstack-t3', '');
    } else body.removeAttribute('data-axstack-t3');
    const theme = marker === 'dark' || marker === 'light' ? marker : dark ? 'dark' : 'light';
    if (body.getAttribute('data-theme') !== theme) body.setAttribute('data-theme', theme);
  };
  update();
  media.addEventListener('change', update);
  const observer = new view.MutationObserver(update);
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'style', 'data-axstack-theme'] });
  return () => { media.removeEventListener('change', update); observer.disconnect(); };
}

if (typeof document !== 'undefined') installAnatomyTheme();
