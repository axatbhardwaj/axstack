(() => {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalize = (text) => text.replace(/\s+/g, ' ').trim();

  function labelText(element) {
    if (!element.querySelector('br')) return normalize(element.textContent);
    const copy = element.cloneNode(true);
    for (const lineBreak of copy.querySelectorAll('br')) lineBreak.replaceWith(' ');
    return normalize(copy.textContent);
  }

  function enhance(figure) {
    const frame = figure.querySelector('.diagram-viewer__frame');
    const svg = frame.querySelector('svg');
    const { width, height } = svg.viewBox.baseVal;
    if (!(width > 0 && height > 0)) return;

    const toolbar = figure.querySelector('.diagram-viewer__tools');
    const query = toolbar.querySelector('input[type=search]');
    const level = toolbar.querySelector('output');
    const status = toolbar.querySelector('[role=status]');
    const labels = [...svg.querySelectorAll('text, foreignObject')]
      .map((element) => ({ element, label: labelText(element) }))
      .filter(({ element, label }) => label && element.getClientRects().length);
    const fitScale = () => Math.min(1, Math.max(1, frame.clientWidth - 24) / width,
      Math.max(1, frame.clientHeight - 24) / height);
    let scale = 1;
    let fitted = false;
    let match;

    function localPoint(x, y) {
      const rect = frame.getBoundingClientRect();
      return { x: x - rect.left - frame.clientLeft, y: y - rect.top - frame.clientTop };
    }

    function svgOrigin() {
      const { left, top } = svg.getBoundingClientRect();
      return localPoint(left, top);
    }

    function center() {
      return { x: frame.clientWidth / 2, y: frame.clientHeight / 2 };
    }

    function draw(next) {
      scale = next;
      svg.style.setProperty('--diagram-scaled-width', `${width * scale}px`);
      level.value = `${Math.round(100 * scale)}%`;
    }

    function zoom(next, from = center(), to = from) {
      const old = svgOrigin();
      const previous = scale;
      fitted = false;
      draw(clamp(next, Math.min(0.05, fitScale()), 4));
      const current = svgOrigin();
      const ratio = scale / previous;
      frame.scrollLeft += current.x + (from.x - old.x) * ratio - to.x;
      frame.scrollTop += current.y + (from.y - old.y) * ratio - to.y;
    }

    function fit() {
      draw(fitScale());
      frame.scrollTo(0, 0);
      fitted = true;
    }

    function reset() {
      draw(1);
      frame.scrollTo(0, 0);
      fitted = false;
    }

    function pan(x, y) {
      fitted = false;
      frame.scrollLeft -= x;
      frame.scrollTop -= y;
    }

    function clearMatch() {
      match?.classList.remove('diagram-viewer__match');
      match = undefined;
      status.textContent = '';
    }

    function find() {
      clearMatch();
      const term = normalize(query.value).toLowerCase();
      if (!term) return;
      const found = labels.filter(({ label }) => label.toLowerCase().includes(term));
      if (!found.length) {
        status.textContent = 'No matching label.';
        return;
      }
      const { element, label } = found.find(({ label }) => label.toLowerCase() === term) ?? found[0];
      const bounds = element.getBoundingClientRect();
      const readable = Math.min(Math.max(scale, 1), (frame.clientWidth - 24) * scale / bounds.width,
        (frame.clientHeight - 24) * scale / bounds.height);
      zoom(readable);
      match = element;
      match.classList.add('diagram-viewer__match');
      status.textContent = found.length > 1 ? `Found ${label} (1 of ${found.length})` : `Found ${label}`;
      match.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }

    const actions = { out: () => zoom(scale / 1.25), in: () => zoom(scale * 1.25), fit, reset, find };
    for (const button of toolbar.querySelectorAll('button')) {
      button.addEventListener('click', actions[button.dataset.diagramAction]);
    }
    query.addEventListener('input', clearMatch);
    query.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      find();
    });

    frame.addEventListener('wheel', (event) => {
      if (!event.deltaY) return;
      event.preventDefault();
      const unit = [1, 16, frame.clientHeight][event.deltaMode] ?? 1;
      zoom(scale * Math.exp(clamp(-event.deltaY * unit * 0.002, -1, 1)), localPoint(event.clientX, event.clientY));
    }, { passive: false });

    const pointers = new Map();
    function gesture() {
      const [first, second] = pointers.values();
      if (!second) return first;
      return {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
      };
    }

    frame.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointers.size >= 2) return;
      frame.focus({ preventScroll: true });
      frame.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));
      figure.setAttribute('data-diagram-dragging', '');
    });
    frame.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      const previous = gesture();
      pointers.set(event.pointerId, localPoint(event.clientX, event.clientY));
      const next = gesture();
      if (pointers.size === 2) zoom(scale * next.distance / previous.distance, previous, next);
      else pan(next.x - previous.x, next.y - previous.y);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      frame.addEventListener(type, ({ pointerId }) => {
        pointers.delete(pointerId);
        figure.toggleAttribute('data-diagram-dragging', pointers.size > 0);
      });
    }

    const keys = new Map([['+', actions.in], ['=', actions.in], ['-', actions.out], ['0', fit]]);
    frame.addEventListener('keydown', (event) => {
      const action = keys.get(event.key);
      if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      action();
    });

    figure.setAttribute('data-diagram-ready', '');
    toolbar.hidden = false;
    fit();
    new ResizeObserver(() => {
      if (fitted) fit();
    }).observe(frame);
  }

  function start() {
    if (!globalThis.PointerEvent || !globalThis.ResizeObserver) return;
    for (const figure of document.querySelectorAll('[data-diagram-viewer]')) enhance(figure);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
