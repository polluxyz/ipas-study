/** 純函式統一網址、鄰接、聚合與三維座標；畫面距離不表示語意。 */
import { TYPES, type Aggregate, type Camera, type FormalEdge, type GraphData, type GraphEdge, type GraphState, type SharedState, type Vec3 } from './graph3d-types';
export function parseShared(url: URL, ids: ReadonlySet<string>): SharedState | null {
  const selected = url.searchParams.getAll('selected');
  if (selected.length !== 1 || !ids.has(selected[0])) return null;
  const hops = url.searchParams.getAll('hops'), body = url.searchParams.getAll('body');
  return { selected: selected[0], hops: hops.length === 1 && hops[0] === '2' ? 2 : 1, body: body.length === 1 && body[0] === '1' };
}
export function sharedUrl(url: URL, value: SharedState | null, pathname = url.pathname): URL {
  const result = new URL(url); result.pathname = pathname;
  for (const key of ['selected', 'hops', 'body']) result.searchParams.delete(key);
  if (value) { result.searchParams.set('selected', value.selected); result.searchParams.set('hops', String(value.hops)); if (value.body) result.searchParams.set('body', '1'); }
  return result;
}
export function initialState(localId = '', shared: SharedState | null = null): GraphState {
  return { center: shared?.selected ?? localId, inspected: shared?.selected ?? localId, hops: shared?.hops ?? (localId ? 1 : 0), body: shared?.body ?? false, subject: 'all', unit: 'all', outside: true, mode: 'concept', enabled: new Set(TYPES) };
}
export function neighborhood(id: string, hops: number, edges: readonly GraphEdge[], allowed?: ReadonlySet<string>): Set<string> {
  const found = new Set<string>(!allowed || allowed.has(id) ? [id] : []); let frontier = new Set(found);
  for (let level = 0; level < hops; level++) {
    const next = new Set<string>();
    for (const edge of edges) for (const [a, b] of [[edge.source, edge.target], [edge.target, edge.source]]) {
      if (frontier.has(a) && !found.has(b) && (!allowed || allowed.has(b))) next.add(b);
    }
    for (const nextId of next) found.add(nextId); frontier = next;
  }
  return found;
}
export function aggregateEdges(edges: readonly FormalEdge[], owner: ReadonlyMap<string, string>): Aggregate[] {
  const result = new Map<string, Aggregate>();
  for (const edge of edges) {
    const source = owner.get(edge.source), target = owner.get(edge.target);
    if (!source || !target) throw new Error('關係缺少負責單元');
    const id = `${edge.type}:${source}:${target}`;
    const row = result.get(id) ?? { id, source, target, type: edge.type, count: 0, edgeIds: [] };
    row.count++; row.edgeIds.push(edge.id); result.set(id, row);
  }
  return [...result.values()];
}
export function visibleGraph(data: GraphData, state: GraphState) {
  const base = data.concepts.filter((node) => (state.subject === 'all' || node.subjects.includes(Number(state.subject))) && (state.unit === 'all' || node.codes.includes(state.unit)));
  const baseIds = new Set(base.map((node) => node.id));
  const active: GraphEdge[] = [...data.formalEdges.filter((edge) => state.enabled.has(edge.type)), ...(state.body && state.mode === 'concept' ? data.bodyEdges : [])];
  const ids = state.center && state.hops ? neighborhood(state.center, state.hops, active, state.outside ? undefined : baseIds) : baseIds;
  return { nodes: data.concepts.filter((node) => ids.has(node.id)), edges: active.filter((edge) => ids.has(edge.source) && ids.has(edge.target)), outside: [...ids].filter((id) => !baseIds.has(id)).length };
}
export function makeLayout(data: GraphData): { points: Map<string, Vec3>; units: Map<string, Vec3> } {
  const units = new Map<string, Vec3>(), points = new Map<string, Vec3>();
  for (const subject of [1, 3]) {
    const list = data.units.filter((unit) => unit.subject === subject);
    list.forEach((unit, index) => { const a = index / list.length * Math.PI * 2 - .9; units.set(unit.id, [(subject === 1 ? -355 : 355) + Math.cos(a * 2) * 90, Math.sin(a) * 360, Math.cos(a) * 360]); });
  }
  for (const unit of data.units) {
    const nodes = data.concepts.filter((node) => node.owner === unit.id).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    nodes.forEach((node, index) => {
      const z = 1 - 2 * ((index + .5) / nodes.length), r = Math.sqrt(1 - z * z), a = index * 2.399963229728653, radius = 70 + Math.sqrt(nodes.length) * 5, c = units.get(unit.id)!;
      points.set(node.id, [c[0] + radius * r * Math.cos(a), c[1] + radius * r * Math.sin(a), c[2] + radius * z]);
    });
  }
  return { points, units };
}
export function fitCamera(camera: Camera, points: Vec3[]): void {
  if (!points.length) return;
  const min = [0, 1, 2].map((i) => Math.min(...points.map((point) => point[i]))), max = [0, 1, 2].map((i) => Math.max(...points.map((point) => point[i])));
  camera.center = min.map((v, i) => (v + max[i]) / 2) as Vec3; camera.extent = Math.max(220, ...max.map((v, i) => v - min[i])) * 1.26; camera.zoom = 1;
}
export function project(point: Vec3, camera: Camera, width: number, height: number) {
  const [x, y, z] = point.map((v, i) => v - camera.center[i]);
  const a = x * Math.cos(camera.yaw) + z * Math.sin(camera.yaw), b = -x * Math.sin(camera.yaw) + z * Math.cos(camera.yaw);
  const c = y * Math.cos(camera.pitch) - b * Math.sin(camera.pitch), d = y * Math.sin(camera.pitch) + b * Math.cos(camera.pitch);
  const distance = camera.extent * 2.5, perspective = distance / (distance + d), scale = Math.min(width, height) * .84 / camera.extent * camera.zoom;
  return { x: width / 2 + a * scale * perspective, y: height / 2 + c * scale * perspective, z: d, scale: perspective, alpha: Math.max(.28, Math.min(1, 1 - d / camera.extent)) };
}
