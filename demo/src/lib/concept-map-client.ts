/** 地圖互動在頁面啟動後建立；正式關係與正文分層，閱讀狀態統一經 attempts 介面取得。 */
import cytoscape, { type StylesheetJson } from 'cytoscape';
import { getReadings } from './attempts';
import { relationColors, relationLabels, relationTypes, type ConceptMapData, type MapEdge } from './concept-map';

export function initConceptMap(): void {
  const root = document.querySelector<HTMLElement>('#concept-map');
  const canvas = document.querySelector<HTMLElement>('#map-canvas');
  const payload = document.querySelector('#concept-map-data');
  if (!root || !canvas || !payload) return;
  const data: ConceptMapData = JSON.parse(payload.textContent ?? '{}');
  const stageSelect = root.querySelector<HTMLSelectElement>('#map-stage')!;
  const focusSelect = root.querySelector<HTMLSelectElement>('#map-focus')!;
  const bodyToggle = root.querySelector<HTMLInputElement>('#map-body')!;
  const relationToggles = [...root.querySelectorAll<HTMLInputElement>('[data-map-relation]')];
  const tooltip = root.querySelector<HTMLElement>('#map-tooltip')!;
  const title = root.querySelector<HTMLElement>('#map-detail-title')!;
  const goal = root.querySelector<HTMLElement>('#map-detail-goal')!;
  const eyebrow = root.querySelector<HTMLElement>('#map-detail-eyebrow')!;
  const details = root.querySelector<HTMLElement>('#map-detail-relations')!;
  const open = root.querySelector<HTMLAnchorElement>('#map-open-concept')!;
  let selected = ''; let hovered = '';
  let read = new Set<string>();
  try { read = new Set(getReadings().map((item) => item.conceptId)); }
  catch { root.querySelector('.map-help')!.textContent += '（此瀏覽器暫時無法讀取閱讀紀錄）'; }
  const styles: StylesheetJson = [
    { selector: 'node', style: {
      'shape': 'round-rectangle', 'width': 146, 'height': 43, 'background-color': '#fffefa',
      'border-color': 'data(color)', 'border-width': 1.8, 'label': 'data(label)', 'color': '#30493f',
      'z-index-compare': 'manual', 'z-index': 10,
      'font-family': 'Segoe UI, Microsoft JhengHei, sans-serif', 'font-size': 13, 'font-weight': 500,
      'text-wrap': 'wrap', 'text-overflow-wrap': 'anywhere', 'text-max-width': '133px', 'text-valign': 'center', 'text-halign': 'center',
      'overlay-opacity': 0, 'min-zoomed-font-size': 0,
    } },
    { selector: 'node.read', style: { 'background-color': '#eef4e9' } },
    { selector: 'edge', style: { 'curve-style': 'bezier', 'width': 1.8, 'target-arrow-shape': 'triangle', 'arrow-scale': .85, 'opacity': .65, 'overlay-opacity': 0, 'events': 'no', 'z-index-compare': 'manual', 'z-index': 0 } },
    ...relationTypes.map((type) => ({ selector: `edge[type="${type}"]`, style: { 'line-color': relationColors[type], 'target-arrow-color': relationColors[type], 'source-arrow-color': relationColors[type] } })),
    { selector: 'edge[type="part_of"]', style: { 'line-style': 'dotted' } },
    { selector: 'edge[type="requires"]', style: { 'line-style': 'dashed' } },
    { selector: 'edge[type="contrasts"]', style: { 'source-arrow-shape': 'triangle', 'line-style': 'dashed' } },
    { selector: 'edge[type="body"]', style: { 'line-color': '#a2ada5', 'line-style': 'dotted', 'target-arrow-shape': 'none', 'width': .7, 'opacity': .22, 'events': 'no' } },
    { selector: '.faded', style: { 'opacity': .1 } },
    { selector: 'edge.neighbor', style: { 'opacity': 1, 'width': 2.8, 'z-index': 8 } },
    { selector: 'edge[type="body"].neighbor', style: { 'opacity': .22, 'width': .7, 'z-index': 0 } },
    { selector: 'node.neighbor', style: { 'z-index': 10 } },
    { selector: 'node.focused', style: { 'background-color': '#e5efdf', 'underlay-color': '#5b7b53', 'underlay-opacity': .12, 'underlay-padding': 6, 'z-index': 20 } },
    { selector: '.filtered', style: { 'display': 'none' } },
  ];
  const cy = cytoscape({ container: canvas,
    elements: [
      ...data.nodes.map((node) => ({ data: { ...node, label: `${read.has(node.id) ? '✓ ' : ''}${node.title}` }, position: { x: node.x, y: node.y }, classes: read.has(node.id) ? 'read' : '' })),
      ...data.edges.map((edge) => ({ data: { ...edge } })),
    ], style: styles, layout: { name: 'preset', padding: 38 }, minZoom: .22, maxZoom: 2.8,
    wheelSensitivity: .2, autoungrabify: true, boxSelectionEnabled: false, selectionType: 'single',
  });
  function fit(): void { const nodes = cy.nodes().not('.filtered'); if (nodes.length) cy.fit(nodes, window.innerWidth < 600 ? 22 : 38); }
  function highlight(): void {
    const id = hovered || selected;
    cy.batch(() => {
      cy.elements().removeClass('faded neighbor focused');
      if (!id) return;
      const node = cy.getElementById(id); if (node.hasClass('filtered')) return;
      const edges = node.connectedEdges().not('.filtered');
      const neighborhood = edges.connectedNodes().union(edges).union(node);
      cy.elements(':visible').not(neighborhood).addClass('faded');
      neighborhood.addClass('neighbor'); node.addClass('focused');
    });
  }
  function edgeLabel(edge: MapEdge): string {
    const source = data.nodes.find((node) => node.id === edge.source)?.title ?? edge.source;
    const target = data.nodes.find((node) => node.id === edge.target)?.title ?? edge.target;
    return edge.type === 'body' ? `${source} — ${target} · 正文提到（非正式關係，無方向）` : `${source} ${relationLabels[edge.type]} ${target}`;
  }
  function stageTitle(stageId: string): string {
    const index = data.stages.findIndex((stage) => stage.id === stageId);
    return index < 0 ? '' : `${['一', '二', '三', '四', '五', '六'][index] ?? index + 1}、${data.stages[index].title}`;
  }
  function relationCard(edge: MapEdge): HTMLElement {
    const article = document.createElement('article'); article.className = 'map-relation-card';
    const heading = document.createElement('strong'); heading.textContent = edgeLabel(edge); article.append(heading);
    if (edge.note) { const note = document.createElement('p'); note.textContent = edge.note; article.append(note); }
    if (edge.sources.length) {
      const sources = document.createElement('small'); sources.append('來源：');
      edge.sources.forEach((source, index) => {
        if (index) sources.append('、');
        if (data.questionIds?.includes(source)) {
          const link = document.createElement('a'); link.href = `/questions/${source}/`; link.textContent = source; sources.append(link);
        } else sources.append(source);
      }); article.append(sources);
    }
    return article;
  }
  function inspect(id: string): void {
    const node = data.nodes.find((item) => item.id === id);
    if (!node) {
      eyebrow.textContent = '從一個概念出發'; title.textContent = '每條連線，都有不同意思。';
      goal.textContent = '滑過方格看學習目標；點選方格或使用「聚焦概念」，在這裡查看完整關係、考點與來源。';
      open.href = '/codes/L23303/'; open.textContent = '依路線開始學習 ↗';
      details.textContent = '先選一個概念，這裡會列出它的關係與比較重點。'; return;
    }
    eyebrow.textContent = `${stageTitle(node.stage)}${read.has(id) ? ' · 已讀 ✓' : ''}`;
    title.textContent = node.title; goal.textContent = node.goal;
    open.href = `/concepts/${id}/`; open.textContent = '閱讀這個概念 ↗';
    // 圖上的篩選只控制視覺密度，面板仍完整保留此概念的正式關係與正文連結。
    const edges = data.edges.filter((edge) => edge.source === id || edge.target === id);
    details.replaceChildren(...edges.map(relationCard));
    if (!edges.length) details.textContent = '這個概念目前沒有相鄰關係。';
  }
  function applyFilters(): void {
    tooltip.hidden = true;
    const enabled = new Set(relationToggles.filter((input) => input.checked).map((input) => input.value));
    cy.batch(() => {
      cy.nodes().forEach((node) => { node.toggleClass('filtered', stageSelect.value !== 'all' && node.data('stage') !== stageSelect.value); });
    });
    cy.batch(() => {
      cy.edges().forEach((edge) => { edge.toggleClass('filtered', edge.source().hasClass('filtered') || edge.target().hasClass('filtered') || (edge.data('type') === 'body' ? !bodyToggle.checked : !enabled.has(edge.data('type')))); });
    });
    for (const option of focusSelect.options) option.disabled = Boolean(option.value) && cy.getElementById(option.value).hasClass('filtered');
    if (selected && cy.getElementById(selected).hasClass('filtered')) { selected = ''; focusSelect.value = ''; }
    hovered = ''; highlight(); inspect(selected);
    root!.querySelector('#map-count')!.textContent = `${cy.nodes().not('.filtered').length} 個概念 · ${cy.edges().not('.filtered').filter((edge) => edge.data('type') !== 'body').length} 條關係`;
    root!.dataset.visibleNodes = String(cy.nodes().not('.filtered').length); root!.dataset.visibleEdges = String(cy.edges().not('.filtered').length);
  }
  function nodeAt(position: { x: number; y: number }): string {
    // 不使用 Cytoscape 的事件 target：連線的命中容錯與圓角判定不能搶走方格內的 hover。
    // 排除文字與光暈，並保持各狀態的邊框寬度相同，讓命中範圍不會隨 hover 膨脹。
    return cy.nodes(':visible').filter((node) => {
      const box = node.renderedBoundingBox({ includeLabels: false, includeOverlays: false, includeUnderlays: false });
      return position.x >= box.x1 && position.x <= box.x2 && position.y >= box.y1 && position.y <= box.y2;
    })[0]?.id() ?? '';
  }
  function clearHover(): void {
    tooltip.hidden = true; canvas!.style.cursor = 'grab';
    if (hovered) { hovered = ''; highlight(); }
  }
  function showNode(id: string, position: { x: number; y: number }): void {
    const node = data.nodes.find((item) => item.id === id)!;
    if (hovered !== id || tooltip.hidden) {
      hovered = id; highlight();
      const heading = document.createElement('strong'); heading.textContent = node.title;
      const stage = document.createElement('small'); stage.textContent = stageTitle(node.stage);
      const objective = document.createElement('p'); objective.textContent = node.goal;
      const hint = document.createElement('small');
      hint.textContent = `${data.edges.filter((edge) => edge.source === id || edge.target === id).length} 條連結 · 點擊看關係`;
      tooltip.replaceChildren(stage, heading, objective, hint); tooltip.hidden = false;
    }
    canvas!.style.cursor = 'pointer';
    // 依實際提示高度定位，長目標也能留在畫布與目前視窗內。
    const surface = canvas!.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(position.x + 14, surface.width - tooltip.offsetWidth - 12))}px`;
    const top = Math.max(8, -surface.top + 8);
    const bottom = Math.min(surface.height, window.innerHeight - surface.top) - tooltip.offsetHeight - 8;
    tooltip.style.top = `${Math.max(top, Math.min(position.y + 18, bottom))}px`;
  }
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || event.buttons) { clearHover(); return; }
    const bounds = canvas!.getBoundingClientRect();
    const position = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    const id = nodeAt(position);
    if (id) showNode(id, position); else clearHover();
  });
  canvas.addEventListener('pointerleave', clearHover);
  canvas.addEventListener('pointerdown', clearHover);
  window.addEventListener('scroll', clearHover, { passive: true, capture: true });
  cy.on('tap', (event) => {
    selected = nodeAt(event.renderedPosition); focusSelect.value = selected;
    clearHover(); highlight(); inspect(selected);
    const original = event.originalEvent;
    if (selected && original instanceof MouseEvent) showNode(selected, event.renderedPosition);
  });
  cy.on('pan zoom', clearHover);
  focusSelect.addEventListener('change', () => { selected = focusSelect.value; hovered = ''; highlight(); inspect(selected); });
  stageSelect.addEventListener('change', () => { applyFilters(); requestAnimationFrame(fit); });
  for (const input of [...relationToggles, bodyToggle]) input.addEventListener('change', applyFilters);
  root.querySelector('#map-reset')!.addEventListener('click', () => {
    stageSelect.value = 'all'; focusSelect.value = ''; selected = ''; bodyToggle.checked = false;
    relationToggles.forEach((input) => { input.checked = true; }); applyFilters(); fit();
  });
  root.querySelector('#map-fit')!.addEventListener('click', fit);
  for (const [id, factor] of [['map-zoom-in', 1.3], ['map-zoom-out', 1 / 1.3]] as const) {
    root.querySelector(`#${id}`)!.addEventListener('click', () => cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)), renderedPosition: { x: canvas!.clientWidth / 2, y: canvas!.clientHeight / 2 } }));
  }
  let initialWidth = canvas.clientWidth;
  const observer = new ResizeObserver(() => { cy.resize(); if (Math.abs(canvas!.clientWidth - initialWidth) > 80) { initialWidth = canvas!.clientWidth; fit(); } }); observer.observe(canvas);
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) { observer.disconnect(); window.removeEventListener('scroll', clearHover, true); cy.destroy(); }
  });
  document.fonts.ready.then(() => {
    cy.resize(); fit();
    // 手機先提供可讀的起點，再用平移探索其餘群組；「顯示整張地圖」仍能回看全貌。
    if (window.innerWidth < 600) { cy.zoom(.8); cy.pan({ x: 82, y: 115 }); }
  });
  applyFilters(); root.dataset.ready = 'true';
}
