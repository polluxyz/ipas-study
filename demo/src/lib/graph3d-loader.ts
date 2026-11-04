/** 同文件同版只發出一份請求；收合保留訂閱，最後卸載者取消請求。 */
import { TYPES, type GraphData, type GraphVersion } from './graph3d-types';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');
const origin = (v: unknown) => object(v) && typeof v.path === 'string' && typeof v.line === 'number' && Number.isInteger(v.line) && v.line > 0 && typeof v.sha256 === 'string' && /^[a-f0-9]{64}$/.test(v.sha256);
export function validateGraph(value: unknown, expected: GraphVersion): GraphData {
  const bad = () => { throw new Error('圖資料格式或版本不符，請使用文字入口。'); };
  if (!object(value) || value.format !== expected.format || value.head !== expected.head || value.sourceHash !== expected.sourceHash) return bad();
  if (!Array.isArray(value.concepts) || !value.concepts.length || !Array.isArray(value.units) || !value.units.length || !Array.isArray(value.formalEdges) || !Array.isArray(value.bodyEdges) || !Array.isArray(value.unitAggregation) || !Array.isArray(value.sources)) return bad();
  const ids = new Set<string>(), unitIds = new Set<string>(), owners = new Map<string, string>(), edgeIds = new Set<string>(), ownedCounts = new Map<string, number>(), memberCounts = new Map<string, number>();
  for (const unit of value.units) {
    if (!object(unit) || typeof unit.id !== 'string' || unitIds.has(unit.id) || typeof unit.title !== 'string' || ![1, 3].includes(Number(unit.subject)) || !strings(unit.concepts) || !Array.isArray(unit.stages) || !origin(unit.source) || !Number.isInteger(unit.ownedCount) || !Number.isInteger(unit.memberCount)) return bad();
    for (const stage of unit.stages) if (!object(stage) || typeof stage.id !== 'string' || typeof stage.title !== 'string' || !Array.isArray(stage.concepts) || !stage.concepts.every((c: unknown) => object(c) && typeof c.id === 'string' && typeof c.goal === 'string')) return bad();
    unitIds.add(unit.id);
  }
  for (const node of value.concepts) {
    if (!object(node) || typeof node.id !== 'string' || ids.has(node.id) || typeof node.title !== 'string' || typeof node.summary !== 'string' || typeof node.kind !== 'string' || !strings(node.aliases) || !strings(node.codes) || !node.codes.length || !node.codes.every((code) => unitIds.has(code)) || node.owner !== node.codes[0] || !Array.isArray(node.subjects) || !node.subjects.every((s: unknown) => s === 1 || s === 3) || !strings(node.guideRefs) || !origin(node.source) || !Number.isInteger(node.typedDegree) || typeof node.exception !== 'boolean') return bad();
    ids.add(node.id); owners.set(node.id, String(node.owner));
    ownedCounts.set(String(node.owner), (ownedCounts.get(String(node.owner)) ?? 0) + 1);
    for (const code of node.codes) memberCounts.set(code, (memberCounts.get(code) ?? 0) + 1);
  }
  const degree = new Map<string, number>(), rows = new Map<string, string[]>(), formalPairs = new Set<string>();
  for (const edge of value.formalEdges) {
    if (!object(edge) || typeof edge.id !== 'string' || edgeIds.has(edge.id) || !ids.has(String(edge.source)) || !ids.has(String(edge.target)) || !TYPES.includes(edge.type as typeof TYPES[number]) || (edge.note !== undefined && typeof edge.note !== 'string') || !strings(edge.sources) || !origin(edge.origin) || edge.directed !== (edge.type !== 'contrasts') || edge.id !== `${edge.type}:${edge.source}:${edge.target}`) return bad();
    edgeIds.add(edge.id); for (const id of [String(edge.source), String(edge.target)]) degree.set(id, (degree.get(id) ?? 0) + 1);
    formalPairs.add([edge.source, edge.target].sort().join('|'));
    const key = `${edge.type}:${owners.get(String(edge.source))}:${owners.get(String(edge.target))}`; const list = rows.get(key) ?? []; list.push(edge.id); rows.set(key, list);
  }
  for (const node of value.concepts) if (node.typedDegree !== (degree.get(node.id) ?? 0) || (node.exception && node.typedDegree !== 0)) return bad();
  const pairs = new Set<string>();
  for (const edge of value.bodyEdges) {
    if (!object(edge) || edge.type !== 'body' || typeof edge.id !== 'string' || edgeIds.has(edge.id) || !ids.has(String(edge.source)) || !ids.has(String(edge.target)) || edge.source === edge.target || !Array.isArray(edge.origins) || !edge.origins.length) return bad();
    const pair = [edge.source, edge.target].sort().join('|'); if (pairs.has(pair)) return bad(); pairs.add(pair); edgeIds.add(edge.id);
    for (const mention of edge.origins) if (!object(mention) || !ids.has(String(mention.source)) || !ids.has(String(mention.target)) || [mention.source, mention.target].sort().join('|') !== pair || !origin(mention.origin)) return bad();
    if (formalPairs.has(pair)) return bad();
  }
  if (value.unitAggregation.length !== rows.size) return bad();
  for (const row of value.unitAggregation) {
    if (!object(row) || !strings(row.edgeIds) || row.count !== row.edgeIds.length || row.id !== `${row.type}:${row.source}:${row.target}`) return bad();
    const expectedIds = rows.get(String(row.id)); if (!expectedIds || expectedIds.length !== row.edgeIds.length || [...expectedIds].sort().join('|') !== [...row.edgeIds].sort().join('|')) return bad(); rows.delete(String(row.id));
  }
  for (const unit of value.units) if (unit.ownedCount !== (ownedCounts.get(unit.id) ?? 0) || unit.memberCount !== (memberCounts.get(unit.id) ?? 0) || !unit.concepts.every((id: string) => ids.has(id))) return bad();
  if (!value.sources.every(origin)) return bad();
  const sourceIndex = new Map(value.sources.map((s) => [s.path, s.sha256]));
  if (sourceIndex.size !== value.sources.length) return bad();
  const origins = [...value.concepts.map((n) => n.source), ...value.units.map((u) => u.source), ...value.formalEdges.map((e) => e.origin), ...value.bodyEdges.flatMap((e) => e.origins.map((m: { origin: { path: string; sha256: string } }) => m.origin))];
  if (origins.some((s) => sourceIndex.get(s.path) !== s.sha256)) return bad();
  return value as unknown as GraphData;
}
export type FetchGraph = (url: string, init: { signal: AbortSignal }) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
interface RecordState { expected: GraphVersion; subscribers: Set<symbol>; ready?: GraphData; pending?: Promise<GraphData>; abort?: AbortController; generation: number; error?: Error; cancelled: boolean; }
export function createGraphStore(fetcher: FetchGraph = (url, init) => fetch(url, init)) {
  const records = new Map<string, RecordState>();
  return {
    subscribe(url: string, expected: GraphVersion) {
      const key = `${url}|${expected.format}|${expected.head}|${expected.sourceHash}`;
      let record = records.get(key);
      if (!record) { record = { expected, subscribers: new Set(), generation: 0, cancelled: false }; records.set(key, record); }
      const current = record, token = Symbol(); current.subscribers.add(token); let released = false;
      // 新元件有自己的首次請求；BFCache同元件的禁止自動重試由控制器保存。
      if (current.subscribers.size === 1 && !current.pending && !current.ready) { current.cancelled = false; current.error = undefined; }
      return {
        ready() { return current.ready ? validateGraph(current.ready, expected) : undefined; },
        get cancelled() { return current.cancelled; },
        load(retry = false): Promise<GraphData> {
          if (released) return Promise.reject(new Error('圖元件已卸載。'));
          if (current.ready) return Promise.resolve(current.ready);
          if (current.pending) return current.pending;
          if ((current.error || current.cancelled) && !retry) return Promise.reject(current.error ?? new Error('圖載入已取消。'));
          const abort = new AbortController(), generation = ++current.generation; current.abort = abort; current.error = undefined; current.cancelled = false;
          const request = (async () => {
            try {
              const response = await fetcher(url, { signal: abort.signal });
              if (!response.ok) throw new Error(`圖資料載入失敗（${response.status}）。`);
              const data = validateGraph(await response.json(), expected);
              if (generation !== current.generation || abort.signal.aborted) throw new DOMException('載入已取消', 'AbortError');
              current.ready = data; return data;
            } catch (cause) {
              const error = cause instanceof Error ? cause : new Error('圖資料載入失敗。');
              if (generation === current.generation) { current.cancelled = abort.signal.aborted; if (!current.cancelled) current.error = error; }
              throw error;
            } finally { if (generation === current.generation) { current.pending = undefined; current.abort = undefined; } }
          })(); current.pending = request; return request;
        },
        release() {
          if (released) return; released = true; current.subscribers.delete(token);
          if (!current.subscribers.size && current.pending) { current.generation++; current.cancelled = true; current.abort?.abort(); current.pending = undefined; current.abort = undefined; }
        },
      };
    },
  };
}
let store: ReturnType<typeof createGraphStore> | undefined;
export function graphStore() { return store ??= createGraphStore(); }
