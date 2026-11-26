// The SVG and its identifier come from the checked export. Keep its bytes intact.
export function mermaidFigure({ id, svg, viewer }) {
  if (!viewer) return `<figure class="mermaid-scroll diagram-figure">\n${svg}\n</figure>\n`;
  return `<figure class="diagram-viewer diagram-figure" data-diagram-viewer>
  <input class="diagram-viewer__fallback" type="checkbox" id="${id}-fit">
  <label class="diagram-viewer__fallback" for="${id}-fit">Fit</label>
  <div class="diagram-viewer__tools" hidden>
    <div class="diagram-viewer__zoom" role="group" aria-label="Diagram zoom">
      <button type="button" data-diagram-action="out" aria-label="Zoom out">−</button>
      <output aria-label="Zoom level" aria-live="off"></output>
      <button type="button" data-diagram-action="in" aria-label="Zoom in">+</button>
      <button type="button" data-diagram-action="fit">Fit</button>
      <button type="button" data-diagram-action="reset" aria-label="Reset zoom and position">Reset</button>
    </div>
    <div class="diagram-viewer__find" role="search" aria-label="Find in diagram">
      <input type="search" aria-label="Diagram label" placeholder="Diagram label">
      <button type="button" data-diagram-action="find">Find</button>
    </div>
    <p class="diagram-viewer__status" role="status"></p>
  </div>
  <div class="diagram-viewer__frame" tabindex="0" role="region" aria-label="Diagram canvas">
    <div class="diagram-viewer__canvas">${svg}</div>
  </div>
</figure>
`;
}
