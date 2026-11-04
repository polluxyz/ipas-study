/** Canvas只處理繪圖與指標；節點與連線共用深度排序，不持續自轉。 */
import { COLORS, type Aggregate, type Camera, type GraphData, type GraphEdge, type GraphNode, type GraphState, type Vec3 } from './graph3d-types';
import { aggregateEdges, fitCamera, makeLayout, project } from './graph3d-model';
interface Point { id: string; title: string; owner: string; summary: string; degree: number; exception: boolean; subjects: number[]; unit: boolean; world: Vec3; x: number; y: number; z: number; radius: number; alpha: number; }
type DrawEdge = GraphEdge | Aggregate;
export function edgeAppearance(edge: DrawEdge, inspected: string, hovered: string, adjacent: boolean, output = { line: 0, arrow: 0, width: 0 }) {
  const focused = edge.source === inspected || edge.target === inspected, faded = !!hovered && !adjacent;
  output.line = faded ? .035 : adjacent ? 1 : focused ? .4 : edge.type === 'body' ? .18 : .22; output.arrow = faded ? .04 : adjacent ? 1 : .35; output.width = adjacent ? 2.5 : 'count' in edge ? Math.min(4, .7 + Math.log2(1 + edge.count) * .55) : focused ? 1.7 : 1.1; return output;
}
export function frontHit<T extends { x: number; y: number; z: number; radius: number }>(points: readonly T[], x: number, y: number): T | undefined {
  return [...points].sort((a, b) => a.z - b.z).find((p) => Math.hypot(p.x - x, p.y - y) <= Math.max(9, p.radius + 3));
}
export class GraphRenderer {
  readonly camera: Camera = { yaw: .3, pitch: -.13, zoom: 1, center: [0, 0, 0], extent: 960 };
  private readonly layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly events = new AbortController();
  private readonly observer: ResizeObserver;
  private readonly unitDegrees = new Map<string, number>();
  private frame = 0;
  private active = true;
  private points: Point[] = [];
  private unitIds: string[] = [];
  private renderedEdges: DrawEdge[] = [];
  private primitives: { z: number; node?: Point; edge?: DrawEdge; a?: Point; b?: Point }[] = [];
  private arrowBoxes: { x: number; y: number; w: number; h: number }[] = [];
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private state: GraphState;
  private hovered = '';
  private touch = false;
  private pointers = new Map<number, { x: number; y: number; startX: number; startY: number; moved: boolean }>();
  private pinch = 0;
  private pinched = false;
  constructor(private canvas: HTMLCanvasElement, private tooltip: HTMLElement, private data: GraphData, state: GraphState, private onSelect: (id: string, unit: boolean) => void, private onReset: () => void, private readings: Set<string>) {
    this.state = state; this.layout = makeLayout(data);
    this.ctx = (() => { try { return canvas.getContext('2d'); } catch { return null; } })();
    const owners = new Map(data.concepts.map((node) => [node.id, node.owner]));
    for (const edge of data.formalEdges) for (const owner of new Set([owners.get(edge.source)!, owners.get(edge.target)!])) this.unitDegrees.set(owner, (this.unitDegrees.get(owner) ?? 0) + 1);
    const signal = this.events.signal;
    this.observer = new ResizeObserver(() => { this.clearHover(); this.schedule(); });
    if (!this.ctx) return;
    this.observer.observe(canvas);
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType !== 'touch') return;
      if (!this.pointers.size) this.pinched = false;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false });
      if (e.pointerType !== 'touch' || this.touch) canvas.setPointerCapture(e.pointerId);
      if (this.pointers.size === 2) { this.pinched = true; const p = [...this.pointers.values()]; this.pinch = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
      this.clearHover();
    }, { signal });
    canvas.addEventListener('pointermove', (e) => {
      const previous = this.pointers.get(e.pointerId), box = canvas.getBoundingClientRect();
      if (previous) {
        this.clearHover();
        const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
        previous.x = e.clientX; previous.y = e.clientY;
        if (Math.hypot(e.clientX - previous.startX, e.clientY - previous.startY) > 5) previous.moved = true;
        if (e.pointerType === 'touch' && !this.touch) return;
        if (this.pointers.size === 2) {
          const p = [...this.pointers.values()], distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
          if (this.pinch) this.zoom(distance / this.pinch); this.pinch = distance;
        } else { this.camera.yaw -= dx * .008; this.camera.pitch = Math.max(-1.45, Math.min(1.45, this.camera.pitch + dy * .008)); this.schedule(); }
        return;
      }
      if (e.pointerType === 'touch') return;
      const point = frontHit(this.points, e.clientX - box.left, e.clientY - box.top);
      if (point) this.hover(point, e.clientX - box.left, e.clientY - box.top); else this.clearHover();
    }, { signal });
    const finish = (e: PointerEvent, cancelled: boolean) => {
      const pointer = this.pointers.get(e.pointerId); this.pointers.delete(e.pointerId);
      if (!cancelled && !this.pinched && pointer && !pointer.moved && !this.pointers.size) {
        const box = canvas.getBoundingClientRect(), point = frontHit(this.points, e.clientX - box.left, e.clientY - box.top);
        if (point) this.onSelect(point.id, point.unit);
      }
      if (!this.pointers.size) this.pinch = 0;
    };
    canvas.addEventListener('pointerup', (e) => finish(e, false), { signal });
    canvas.addEventListener('pointercancel', (e) => finish(e, true), { signal });
    canvas.addEventListener('lostpointercapture', (e) => { this.pointers.delete(e.pointerId); }, { signal });
    canvas.addEventListener('pointerleave', () => this.clearHover(), { signal });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(-e.deltaY * .0012)); }, { signal, passive: false });
    canvas.addEventListener('keydown', (e) => {
      const actions: Record<string, () => void> = { ArrowLeft: () => { this.camera.yaw += .12; }, ArrowRight: () => { this.camera.yaw -= .12; }, ArrowUp: () => { this.camera.pitch = Math.max(-1.45, this.camera.pitch - .12); }, ArrowDown: () => { this.camera.pitch = Math.min(1.45, this.camera.pitch + .12); }, '+': () => this.zoom(1.2), '=': () => this.zoom(1.2), '-': () => this.zoom(1 / 1.2), Home: () => this.onReset() };
      if (actions[e.key]) { e.preventDefault(); this.clearHover(); actions[e.key](); this.schedule(); }
    }, { signal });
    window.addEventListener('scroll', () => this.clearHover(), { capture: true, passive: true, signal });
    window.addEventListener('blur', () => this.clearHover(), { signal });
  }
  get available() { return !!this.ctx; }
  setReadings(ids: Set<string>) { this.readings = ids; this.schedule(); }
  setTouch(enabled: boolean) { this.touch = enabled; this.canvas.style.touchAction = enabled ? 'none' : 'pan-y'; this.pointers.clear(); this.clearHover(); }
  setActive(value: boolean) { this.active = value; if (!value) { cancelAnimationFrame(this.frame); this.frame = 0; this.clearHover(); this.pointers.clear(); } else this.schedule(); }
  update(nodes: GraphNode[], edges: GraphEdge[], state: GraphState, fit = false) {
    this.nodes = nodes; this.edges = edges; this.state = state; this.clearHover();
    const unitMode = state.mode === 'unit'; this.unitIds = [...new Set(nodes.map((node) => node.owner))];
    const seeds = unitMode ? this.unitIds.map((id) => { const u = this.data.units.find((unit) => unit.id === id)!; return { id, title: u.title, owner: id, summary: `${u.ownedCount} 個負責概念；${u.memberCount} 個成員概念`, degree: this.unitDegrees.get(id) ?? 0, exception: false, subjects: [u.subject] }; }) : nodes.map((n) => ({ id: n.id, title: n.title, owner: n.owner, summary: n.summary, degree: n.typedDegree, exception: n.exception, subjects: n.subjects }));
    this.points = seeds.map((node) => ({ ...node, unit: unitMode, world: (unitMode ? this.layout.units : this.layout.points).get(node.id)!, x: 0, y: 0, z: 0, radius: 0, alpha: 1 }));
    this.renderedEdges = unitMode ? aggregateEdges(edges.filter((e): e is Extract<GraphEdge, { directed: boolean }> => e.type !== 'body'), new Map(this.data.concepts.map((n) => [n.id, n.owner]))) : edges;
    const lookup = new Map(this.points.map((p) => [p.id, p])); this.primitives = this.points.map((node) => ({ z: 0, node }));
    for (const edge of this.renderedEdges) { const a = lookup.get(edge.source), b = lookup.get(edge.target); if (a && b) this.primitives.push({ z: 0, edge, a, b }); }
    if (fit) this.fit(); this.schedule();
  }
  fit() { fitCamera(this.camera, this.state.mode === 'unit' ? [...new Set(this.nodes.map((node) => node.owner))].map((id) => this.layout.units.get(id)!) : this.nodes.map((node) => this.layout.points.get(node.id)!)); this.clearHover(); this.schedule(); }
  reset() { this.camera.yaw = .3; this.camera.pitch = -.13; this.fit(); }
  zoom(factor: number) { this.camera.zoom = Math.max(.35, Math.min(5, this.camera.zoom * factor)); this.clearHover(); this.schedule(); }
  destroy() { this.active = false; cancelAnimationFrame(this.frame); this.frame = 0; this.observer.disconnect(); this.events.abort(); this.pointers.clear(); this.tooltip.hidden = true; }
  private schedule() { if (!this.active || this.frame || !this.ctx) return; this.frame = requestAnimationFrame(() => { this.frame = 0; if (this.active) this.draw(); }); }
  private clearHover() { const had = !!this.hovered; this.hovered = ''; this.tooltip.hidden = true; this.canvas.style.cursor = ''; if (had) this.schedule(); }
  private hover(point: Point, x: number, y: number) {
    const changed = this.hovered !== point.id; this.hovered = point.id;
    const unit = this.data.units.find((u) => u.id === point.owner);
    this.tooltip.replaceChildren();
    for (const [tag, text] of [['strong', point.title], ['small', `${point.owner} · ${unit?.title ?? ''} · ${point.degree} 條直接正式關係`], ['span', point.summary]]) { const el = document.createElement(tag); el.textContent = text; this.tooltip.append(el); }
    this.tooltip.hidden = false; this.canvas.style.cursor = 'pointer';
    const box = this.canvas.getBoundingClientRect(), tw = this.tooltip.offsetWidth, th = this.tooltip.offsetHeight;
    this.tooltip.style.left = `${Math.max(8, Math.min(x + 14, box.width - tw - 8))}px`;
    this.tooltip.style.top = `${Math.max(8, Math.min(y + 14, box.height - th - 8))}px`;
    if (changed) this.schedule();
  }
  private draw() {
    const start = performance.now(), ctx = this.ctx!, box = this.canvas.getBoundingClientRect(), w = box.width, h = box.height;
    if (w <= 0 || h <= 0) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) { this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const unitMode = this.state.mode === 'unit', unitIds = this.unitIds, edges = this.renderedEdges;
    const cy = Math.cos(this.camera.yaw), sy = Math.sin(this.camera.yaw), cp = Math.cos(this.camera.pitch), sp = Math.sin(this.camera.pitch), distance = this.camera.extent * 2.5, scale = Math.min(w, h) * .84 / this.camera.extent * this.camera.zoom;
    for (const p of this.points) { const x = p.world[0] - this.camera.center[0], y = p.world[1] - this.camera.center[1], z = p.world[2] - this.camera.center[2], a = x * cy + z * sy, b = -x * sy + z * cy, c = y * cp - b * sp, d = y * sp + b * cp, perspective = distance / (distance + d); p.x = w / 2 + a * scale * perspective; p.y = h / 2 + c * scale * perspective; p.z = d; p.alpha = Math.max(.28, Math.min(1, 1 - d / this.camera.extent)); p.radius = unitMode ? 12 : p.id === this.state.inspected ? 7 : Math.max(3, 4.1 * perspective); }
    this.points.sort((a, b) => b.z - a.z);
    const neighbors = new Set([this.hovered]), hoverEdges = new Set<string>();
    if (this.hovered) for (const e of edges) if (e.source === this.hovered || e.target === this.hovered) { neighbors.add(e.source); neighbors.add(e.target); hoverEdges.add(e.id); }
    const arrowBoxes = this.arrowBoxes, appearanceBuffer = { line: 0, arrow: 0, width: 0 }; let arrowCount = 0;
    const line = (edge: DrawEdge, a: Point, b: Point) => {
      const appearance = edgeAppearance(edge, this.state.inspected, this.hovered, hoverEdges.has(edge.id), appearanceBuffer);
      // 每筆圖元明確設定繪圖狀態，避免逐邊save/restore及大量短命物件。
      ctx.globalAlpha = appearance.line; ctx.lineWidth = appearance.width; ctx.strokeStyle = COLORS[edge.type]; ctx.fillStyle = COLORS[edge.type];
      ctx.setLineDash(edge.type === 'requires' ? [4, 3] : edge.type === 'contrasts' ? [6, 3] : edge.type === 'body' || edge.type === 'part_of' ? [1, 3] : []);
      const arrow = (fromX: number, fromY: number, toX: number, toY: number) => {
        const dx = toX - fromX, dy = toY - fromY, distance = Math.sqrt(dx * dx + dy * dy); if (distance < .001) return;
        const ux = dx / distance, uy = dy / distance, length = Math.min(9, Math.max(4, distance * .35)), half = length * .48;
        const lx = toX - ux * length - uy * half, ly = toY - uy * length + ux * half, rx = toX - ux * length + uy * half, ry = toY - uy * length - ux * half;
        const box = arrowBoxes[arrowCount] ?? (arrowBoxes[arrowCount] = { x: 0, y: 0, w: 0, h: 0 }); arrowCount++; box.x = Math.min(toX, lx, rx) - 3; box.y = Math.min(toY, ly, ry) - 3; box.w = Math.max(toX, lx, rx) - box.x + 3; box.h = Math.max(toY, ly, ry) - box.y + 3;
        ctx.setLineDash([]); ctx.globalAlpha = appearance.arrow; ctx.beginPath(); ctx.moveTo(toX, toY); ctx.lineTo(lx, ly); ctx.lineTo(rx, ry); ctx.closePath(); ctx.strokeStyle = '#fffefa'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fill();
      };
      if (a.id === b.id) {
        const r = a.radius + 4, first = { x: a.x + r * .7, y: a.y - r * .72 }, end = { x: a.x + r * .7, y: a.y + r * .72 }, c1 = { x: a.x + r + 45, y: a.y - r - 25 }, c2 = { x: a.x + r + 45, y: a.y + r + 25 };
        ctx.beginPath(); ctx.moveTo(first.x, first.y); ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y); ctx.stroke(); if (edge.type !== 'body') { arrow(c2.x, c2.y, end.x, end.y); if (edge.type === 'contrasts') arrow(c1.x, c1.y, first.x, first.y); }
      } else {
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.sqrt(dx * dx + dy * dy), ra = a.radius + 4, rb = b.radius + 4;
        if (distance > ra + rb + 2) { const sx = a.x + dx / distance * ra, sy = a.y + dy / distance * ra, tx = b.x - dx / distance * rb, ty = b.y - dy / distance * rb; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke(); if (edge.type !== 'body') { arrow(sx, sy, tx, ty); if (edge.type === 'contrasts') arrow(tx, ty, sx, sy); } }
      }
    };
    const node = (p: Point) => {
      ctx.setLineDash([]); ctx.globalAlpha = this.hovered ? neighbors.has(p.id) ? 1 : .12 : p.alpha;
      ctx.fillStyle = p.id === this.state.inspected ? '#1d5543' : p.subjects.includes(1) ? '#a36b3b' : '#367563'; ctx.strokeStyle = p.subjects.length > 1 ? '#397db2' : p.exception ? '#956035' : '#fffef9'; ctx.lineWidth = p.subjects.length > 1 ? 2 : 1;
      ctx.beginPath(); if (p.exception) { ctx.moveTo(p.x, p.y - p.radius - 1); ctx.lineTo(p.x + p.radius + 1, p.y); ctx.lineTo(p.x, p.y + p.radius + 1); ctx.lineTo(p.x - p.radius - 1, p.y); ctx.closePath(); } else ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if ((this.hovered && neighbors.has(p.id)) || p.id === this.state.inspected || this.readings.has(p.id)) { ctx.globalAlpha = this.hovered && !neighbors.has(p.id) ? .12 : 1; ctx.strokeStyle = p.id === this.hovered ? '#a47738' : '#286653'; ctx.lineWidth = p.id === this.hovered ? 3 : 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2); ctx.stroke(); }
    };
    for (const item of this.primitives) item.z = item.node ? item.node.z : (item.a!.z + item.b!.z) / 2;
    this.primitives.sort((a, b) => b.z - a.z); for (const item of this.primitives) { if (item.node) node(item.node); else line(item.edge!, item.a!, item.b!); }
    const labels: { x: number; y: number; w: number; h: number }[] = [];
    const label = (p: { x: number; y: number; radius: number; id?: string }, text: string, major = false) => {
      if (this.hovered && p.id !== this.hovered) return;
      ctx.font = `${major ? '600 ' : ''}11px system-ui, sans-serif`;
      const width = ctx.measureText(text).width + 12, rect = { x: p.x - width / 2, y: p.y - p.radius - 27, w: width, h: 22 };
      const overlaps = (r: { x: number; y: number; w: number; h: number }) => rect.x < r.x + r.w + 4 && rect.x + rect.w + 4 > r.x && rect.y < r.y + r.h + 3 && rect.y + rect.h + 3 > r.y;
      let arrowOverlap = false; for (let i = 0; i < arrowCount; i++) if (overlaps(arrowBoxes[i])) { arrowOverlap = true; break; }
      if (rect.x < 3 || rect.x + width > w - 3 || rect.y < 5 || rect.y + 22 > h - 10 || labels.some(overlaps) || arrowOverlap) return;
      labels.push(rect); ctx.globalAlpha = 1; ctx.fillStyle = '#fffef9ed'; ctx.fillRect(rect.x, rect.y, width, 22); ctx.fillStyle = '#294939'; ctx.fillText(text, rect.x + 6, rect.y + 15);
    };
    if (unitMode || this.state.center || this.nodes.length < 75 || this.hovered) {
      // 首圖先標中心及靠近前方的名稱；完整名稱始終由文字清單與hover提供。
      const candidates = [...this.points].sort((a, b) => a.id === this.hovered ? -1 : b.id === this.hovered ? 1 : a.id === this.state.inspected ? -1 : b.id === this.state.inspected ? 1 : a.z - b.z);
      for (const p of candidates.slice(0, unitMode ? candidates.length : this.nodes.length > 24 ? 1 : 24)) label(p, unitMode ? p.id : p.title, p.id === this.state.inspected);
    }
    else for (const id of unitIds) label({ ...project(this.layout.units.get(id) as Vec3, this.camera, w, h), radius: 38 }, id);
    ctx.globalAlpha = 1;
    performance.measure('graph3d-draw', { start, duration: performance.now() - start });
    performance.clearMeasures('graph3d-draw');
  }
}
