/** 圖資料、網址與持有人測試使用反例，避免只證明實作能自行回讀。 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
vi.mock('astro:content', () => ({ getCollection: vi.fn() }));
import { buildGraphData, relationLine } from './graph3d-build';
import { createGraphStore, validateGraph } from './graph3d-loader';
import { aggregateEdges, initialState, makeLayout, neighborhood, parseShared, project, sharedUrl, visibleGraph } from './graph3d-model';
import { edgeAppearance, frontHit } from './graph3d-renderer';
import { TYPES, type GraphData, type GraphEdge } from './graph3d-types';
import * as loaderModule from './graph3d-loader';
import * as rendererModule from './graph3d-renderer';
import { mountGraph } from './graph3d-client';
const signature = { format: 1, head: 'test-head', sourceHash: 'a'.repeat(64) };
const origin = { path: 'content/concepts/a.md', line: 2, sha256: 'b'.repeat(64) };
function fixture(): GraphData {
  const origin = { path: 'content/concepts/a.md', line: 2, sha256: 'b'.repeat(64) };
  return { ...signature, concepts: ['a', 'b', 'c'].map((id) => ({ id, title: id, aliases: [], kind: 'theory', codes: [id === 'c' ? 'L23101' : 'L21101'], owner: id === 'c' ? 'L23101' : 'L21101', summary: id, subjects: [id === 'c' ? 3 : 1], guideRefs: [], source: origin, typedDegree: id === 'b' ? 2 : 1, exception: false })), units: ['L21101', 'L23101'].map((id, i) => ({ id, title: id, subject: i ? 3 : 1, concepts: i ? ['c'] : ['a', 'b'], stages: [], source: origin, ownedCount: i ? 1 : 2, memberCount: i ? 1 : 2 })), formalEdges: [{ id: 'requires:a:b', source: 'a', target: 'b', type: 'requires', sources: [], origin, directed: true }, { id: 'contrasts:b:c', source: 'b', target: 'c', type: 'contrasts', note: '保留原文', sources: ['guide-3:3-1'], origin, directed: false }], bodyEdges: [], unitAggregation: [{ id: 'requires:L21101:L21101', source: 'L21101', target: 'L21101', type: 'requires', count: 1, edgeIds: ['requires:a:b'] }, { id: 'contrasts:L21101:L23101', source: 'L21101', target: 'L23101', type: 'contrasts', count: 1, edgeIds: ['contrasts:b:c'] }], sources: [origin] };
}
describe('共享網址與真xyz', () => {
  const ids = new Set(['a', 'b']);
  it.each(['?hops=2&body=1', '?selected=', '?selected=unknown', '?selected=a&selected=a'])('非法中心整組不套用 %s', (q) => { expect(parseShared(new URL(`https://local/map/${q}`), ids)).toBeNull(); });
  it.each(['?selected=a', '?selected=a&hops=3&body=2', '?selected=a&hops=2&hops=2&body=1&body=1'])('重複或非法值回缺省 %s', (q) => { expect(parseShared(new URL(`https://local/map/${q}`), ids)).toEqual({ selected: 'a', hops: 1, body: false }); });
  it('編碼保留其他重複query及hash，正文關閉省略', () => {
    const url = new URL('https://local/concepts/a/?x=1&x=2&selected=b&hops=2&body=1#connections');
    const next = sharedUrl(url, { selected: 'a', hops: 1, body: false }, '/map/'); expect(next.pathname).toBe('/map/'); expect(next.searchParams.getAll('x')).toEqual(['1', '2']); expect(next.hash).toBe('#connections'); expect(next.searchParams.has('body')).toBe(false);
    expect(sharedUrl(next, null).search).toBe('?x=1&x=2');
  });
  it('深度及前方點右拖方向，座標切跳不變', () => {
    const data = fixture(), before = makeLayout(data), after = makeLayout(data); expect(before).toEqual(after);
    const camera = { yaw: 0, pitch: 0, zoom: 1, center: [0, 0, 0] as [number, number, number], extent: 960 };
    const first = project([0, 0, -100], camera, 500, 400); camera.yaw -= 50 * .008;
    expect(project([0, 0, -100], camera, 500, 400).x).toBeGreaterThan(first.x);
    expect(new Set([...before.points.values()].map((p) => p[2])).size).toBeGreaterThan(1);
  });
  it('命中優先前方，線與箭頭符合透明度', () => {
    const points = [{ id: 'back', z: 8, x: 20, y: 20, radius: 4 }, { id: 'front', z: -8, x: 20, y: 20, radius: 4 }];
    expect(frontHit(points, 20, 20)?.id).toBe('front');
    const edge = fixture().formalEdges[0]; expect(edgeAppearance(edge, '', '', false)).toMatchObject({ line: .22, arrow: .35 }); expect(edgeAppearance(edge, 'a', '', false).line).toBe(.4); expect(edgeAppearance(edge, '', 'a', true)).toMatchObject({ line: 1, arrow: 1 }); expect(edgeAppearance(edge, 'a', 'c', false).line).toBe(.035);
  });
  it('鄰接忽略方向，保留集合內全部邊及範圍外控制', () => {
    const data = fixture(); expect([...neighborhood('c', 2, data.formalEdges)].sort()).toEqual(['a', 'b', 'c']);
    const state = initialState('', { selected: 'b', hops: 1, body: false }); state.subject = '1'; expect(visibleGraph(data, state).outside).toBe(1); state.outside = false; expect(visibleGraph(data, state).nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(aggregateEdges(data.formalEdges, new Map(data.concepts.map((n) => [n.id, n.owner])))).toEqual(data.unitAggregation);
  });
});
describe('格式與版本拒絕', () => {
  it('接受實際完整必要欄位', () => expect(validateGraph(fixture(), signature)).toEqual(fixture()));
  it.each(['head', 'sourceHash', 'format'] as const)('任一版本欄錯誤皆失敗 %s', (key) => { const bad = fixture(); Object.assign(bad, { [key]: key === 'format' ? 2 : 'wrong' }); expect(() => validateGraph(bad, signature)).toThrow(); });
  it.each([
    (d: GraphData) => { d.concepts.push(d.concepts[0]); },
    (d: GraphData) => { d.formalEdges[0].target = 'unknown'; },
    (d: GraphData) => { d.formalEdges[1].directed = true; },
    (d: GraphData) => { d.unitAggregation[0].count++; },
    (d: GraphData) => { d.unitAggregation[0].edgeIds = ['other']; },
    (d: GraphData) => { d.concepts[0].typedDegree++; },
    (d: GraphData) => { d.formalEdges[0].origin.line = 0; },
    (d: GraphData) => { d.concepts[0].owner = 'unknown'; },
    (d: GraphData) => { d.bodyEdges.push({ id: 'body:a|b', source: 'a', target: 'b', type: 'body', origins: [{ source: 'a', target: 'b', origin }] }); },
  ])('結構/方向/聚合反例拒絕 %#', (mutate) => { const d = fixture(); mutate(d); expect(() => validateGraph(d, signature)).toThrow(); });
});
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const ok = (data: unknown = fixture()) => ({ ok: true, status: 200, json: async () => data });
// 控制項只提供仍存在的介面，讓缺少尾部區域時的完整操作路徑實際執行。
class Control extends EventTarget {
  dataset: Record<string, string> = {};
  children: Control[] = [];
  hidden = false; disabled = false; checked = false; open = true;
  value = ''; textContent = ''; href = ''; type = '';
  focus = vi.fn();
  append(...nodes: Control[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Control[]) { this.children = nodes; }
  querySelector(selector: string): Control | null { return selector === 'button' ? this.children.find((node) => node.type === 'button') ?? null : null; }
  querySelectorAll(): Control[] { return []; }
  closest(selector: string) { return selector === '[data-action]' && this.dataset.action ? this : null; }
  setAttribute() {}
}
function clientFixture(localId = '', query = '', canvasAvailable = true) {
  const data = fixture(), root = new Control();
  root.dataset = { local: localId, url: '/graph/test.json', format: '1', head: signature.head, hash: signature.sourceHash };
  const controls = Object.fromEntries(['status', 'interactive', 'fallback', 'retry', 'reload', 'hops', 'body', 'subject', 'unit', 'mode', 'outside', 'search', 'results', 'center', 'count', 'map-link', 'chart', 'canvas', 'tooltip'].map((name) => [name, new Control()]));
  root.querySelector = (selector) => controls[selector.match(/^\[data-role="(.+)"\]$/)?.[1] ?? ''] ?? null;
  const location = { href: `https://local/${localId ? `concepts/${localId}/` : 'map/'}${query}` }, browserWindow = new EventTarget();
  vi.stubGlobal('window', browserWindow); vi.stubGlobal('location', location);
  vi.stubGlobal('history', { state: null, replaceState: (_state: unknown, _unused: string, url: URL) => { location.href = url.href; } });
  vi.stubGlobal('document', Object.assign(new EventTarget(), { createElement: () => new Control() }));
  const store = createGraphStore(async () => ok(data)); vi.spyOn(loaderModule, 'graphStore').mockReturnValue(store);
  let select!: (id: string, unit: boolean) => void;
  const updates: { ids: string[]; inspected: string; center: string; mode: string }[] = [];
  const methods = { setTouch: vi.fn(), setActive: vi.fn(), reset: vi.fn(), destroy: vi.fn(), setReadings: vi.fn(), zoom: vi.fn(), fit: vi.fn() };
  vi.spyOn(rendererModule, 'GraphRenderer').mockImplementation(class {
    available = canvasAvailable;
    constructor(...args: ConstructorParameters<typeof rendererModule.GraphRenderer>) { select = args[4]; Object.assign(this, methods); }
    update(nodes: GraphData['concepts'], _edges: GraphEdge[], state: Parameters<typeof visibleGraph>[1]) { updates.push({ ids: nodes.map((node) => node.id), inspected: state.inspected, center: state.center, mode: state.mode }); }
  } as unknown as typeof rendererModule.GraphRenderer);
  const client = mountGraph(root as unknown as HTMLDetailsElement);
  const change = (name: string, value: string) => { controls[name].value = value; controls[name].dispatchEvent(new Event('change')); };
  const action = (name: string) => { const target = new Control(); target.dataset.action = name; const event = new Event('click'); Object.defineProperty(event, 'target', { value: target }); root.dispatchEvent(event); };
  return { client, controls, root, updates, methods, location, browserWindow, change, action, select: (id: string, unit = false) => select(id, unit) };
}
describe('圖譜控制不依賴尾部面板', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  it('點選保留中心，切跳可共享，單元選取及重設仍更新圖', async () => {
    const f = clientFixture(); f.client.open(); await vi.waitFor(() => expect(f.updates.length).toBeGreaterThan(0));
    f.select('b'); expect(f.updates.at(-1)).toMatchObject({ inspected: 'b', center: '' });
    f.change('hops', '2'); expect(f.updates.at(-1)).toMatchObject({ inspected: 'b', center: 'b' }); expect(new URL(f.location.href).search).toBe('?selected=b&hops=2');
    f.change('mode', 'unit'); f.select('L23101', true); expect(f.updates.at(-1)).toMatchObject({ inspected: 'L23101', mode: 'unit' });
    f.controls.body.checked = true; f.controls.body.dispatchEvent(new Event('change')); expect(f.controls.body.disabled).toBe(true);
    f.action('reset'); expect(f.updates.at(-1)).toMatchObject({ ids: ['a', 'b', 'c'], inspected: '', center: '', mode: 'concept' }); expect(f.location.href).toBe('https://local/map/'); expect(f.methods.reset).toHaveBeenCalledOnce(); f.client.destroy();
  });
  it('搜尋範圍外概念後可用鍵盤操作畫布，歷史網址與篩選仍有效', async () => {
    const f = clientFixture(); f.client.open(); await vi.waitFor(() => expect(f.updates.length).toBeGreaterThan(0));
    f.change('subject', '1'); expect(f.updates.at(-1)?.ids).toEqual(['a', 'b']);
    f.controls.search.value = 'c'; f.controls.search.dispatchEvent(new Event('input')); f.controls.results.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(f.updates.at(-1)).toMatchObject({ ids: ['a', 'b', 'c'], inspected: 'c', center: 'c' }); expect(f.controls.canvas.focus).toHaveBeenCalledWith({ preventScroll: true }); expect(f.controls.results.hidden).toBe(true);
    f.location.href = 'https://local/map/?selected=a&hops=1&body=1#connections'; f.browserWindow.dispatchEvent(new Event('popstate')); expect(f.updates.at(-1)).toMatchObject({ ids: ['a', 'b'], center: 'a', inspected: 'a' }); expect(f.controls.body.checked).toBe(true);
    f.change('unit', 'L23101'); expect(new URL(f.location.href).searchParams.has('selected')).toBe(false); f.client.destroy();
  });
  it('局部圖收合、重開、暫停恢復及回本頁中心保留選取', async () => {
    const f = clientFixture('a', '?selected=b&hops=2'); f.client.open(); await vi.waitFor(() => expect(f.updates.length).toBeGreaterThan(0));
    expect(f.updates.at(-1)?.center).toBe('b'); f.select('c'); f.client.close(); f.client.open(); expect(f.methods.setActive).toHaveBeenLastCalledWith(true);
    f.client.pause(); f.client.resume(); expect(f.updates.at(-1)).toMatchObject({ center: 'b', inspected: 'c' });
    f.action('home'); expect(f.updates.at(-1)).toMatchObject({ center: 'a', inspected: 'a' }); expect(new URL(f.controls['map-link'].href).searchParams.get('selected')).toBe('a');
    f.action('reset'); expect(f.updates.at(-1)).toMatchObject({ center: 'a', inspected: 'a' }); expect(f.controls.hops.value).toBe('1'); f.client.destroy();
  });
  it('無畫布仍開放原文字入口，重設不存取不存在的區域', async () => {
    const f = clientFixture('a', '', false); f.client.open(); await vi.waitFor(() => expect(f.updates.length).toBeGreaterThan(0));
    expect(f.controls.chart.hidden).toBe(true); expect(f.controls.fallback.hidden).toBe(false); expect(f.controls.status.textContent).toContain('文字入口與原關係表'); f.action('reset'); expect(f.updates.at(-1)?.inspected).toBe('a'); f.client.destroy();
  });
});
describe('共用請求與取消', () => {
  it('收合不release；同版pending及ready不重發', async () => {
    const wait = deferred<ReturnType<typeof ok>>(), fetcher = vi.fn(() => wait.promise), store = createGraphStore(fetcher), a = store.subscribe('/graph/a.json', signature);
    const pending = a.load(), reopen = a.load(); expect(reopen).toBe(pending); expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0]?.length).toBe(2);
    wait.resolve(ok()); await pending; await a.load(); expect(fetcher).toHaveBeenCalledTimes(1); a.release();
  });
  it('卸載1個消費者不取消另1個，最後卸載會取消', async () => {
    const wait = deferred<ReturnType<typeof ok>>(); let signal!: AbortSignal; const fetcher = vi.fn((_url: string, init: { signal: AbortSignal }) => { signal = init.signal; return wait.promise; });
    const store = createGraphStore(fetcher), a = store.subscribe('/same', signature), b = store.subscribe('/same', signature);
    const one = a.load(), two = b.load(); a.release(); expect(signal.aborted).toBe(false); wait.resolve(ok()); expect(await two).toEqual(fixture()); await one; b.release();
    const pending = deferred<ReturnType<typeof ok>>(); let lastSignal!: AbortSignal;
    const cancelStore = createGraphStore((_url, init) => { lastSignal = init.signal; return pending.promise; }), last = cancelStore.subscribe('/last', signature);
    const old = last.load(); const check = expect(old).rejects.toMatchObject({ name: 'AbortError' }); last.release(); expect(lastSignal.aborted).toBe(true); pending.resolve(ok()); await check;
  });
  it('取消後新消費者取得新代次，晚回應不污染快取', async () => {
    const waits = [deferred<ReturnType<typeof ok>>(), deferred<ReturnType<typeof ok>>()]; let index = 0;
    const store = createGraphStore(() => waits[index++].promise), a = store.subscribe('/same', signature); const old = a.load(); const cancelled = expect(old).rejects.toMatchObject({ name: 'AbortError' }); a.release();
    const b = store.subscribe('/same', signature); expect(b.cancelled).toBe(false); const next = b.load(); waits[0].resolve(ok()); await cancelled; expect(b.ready()).toBeUndefined(); waits[1].resolve(ok()); await next; expect(b.ready()).toEqual(fixture()); expect(index).toBe(2);
  });
  it.each(['404', 'offline', 'invalid-json', 'invalid-format', 'wrong-version'])('失敗不自動重試 %s', async (kind) => {
    const fetcher = vi.fn(async () => { if (kind === 'offline') throw new TypeError('offline'); if (kind === 'invalid-json') return { ok: true, status: 200, json: async () => { throw new SyntaxError('JSON'); } }; if (kind === '404') return { ...ok(), ok: false, status: 404 }; return ok(kind === 'invalid-format' ? {} : { ...fixture(), head: 'wrong' }); });
    const a = createGraphStore(fetcher).subscribe('/graph', signature); await expect(a.load()).rejects.toThrow(); await expect(a.load()).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1); await expect(a.load(true)).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
describe('當版來源逐條核對', () => {
  it('來源行精確匹配完整ID，保留行內陣列與註記關係', () => { expect(relationLine(['requires:', '- cnn-architectures', '- cnn'], 0, 3, 'cnn')).toBe(3); expect(relationLine(['requires: [cnn-architectures, cnn]'], 0, 1, 'cnn')).toBe(1); expect(relationLine(['contrasts:', '- target: cnn-architectures', '- target: cnn'], 0, 3, 'cnn')).toBe(3); });
  it('getData入口衍生資料符合原MD、來源與例外清單', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const readEntries = async (folder: string) => Promise.all((await readdir(resolve(root, 'content', folder))).filter((name) => name.endsWith('.md')).map(async (name) => { const raw = await readFile(resolve(root, 'content', folder, name), 'utf8'), front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)!; return { data: parse(front[1]), body: raw.slice(front[0].length), raw }; }));
    const concepts = await readEntries('concepts'), codes = await readEntries('codes');
    for (const c of concepts) { c.data.aliases ??= []; c.data.guide_refs ??= []; for (const type of TYPES) c.data[type] ??= []; }
    const input = { concepts, codes, questions: [], byId: new Map() } as unknown as Parameters<typeof buildGraphData>[0];
    const actual = await buildGraphData(input, root, signature.head); expect(actual.concepts).toHaveLength(concepts.length); expect(new Set(actual.concepts.map((n) => n.id)).size).toBe(concepts.length); expect(actual.units).toHaveLength(codes.length);
    const expected = concepts.sort((a, b) => a.data.id.localeCompare(b.data.id)).flatMap((c) => TYPES.flatMap((type) => c.data[type].map((r: string | { target: string; note?: string; source: string[] }) => ({ id: `${type}:${c.data.id}:${typeof r === 'string' ? r : r.target}`, source: c.data.id, target: typeof r === 'string' ? r : r.target, type, note: typeof r === 'string' ? undefined : r.note, sources: typeof r === 'string' ? [] : r.source }))));
    expect(actual.formalEdges.map(({ origin: _origin, directed: _directed, ...e }) => ({ ...e, note: e.note }))).toEqual(expected);
    for (const edge of actual.formalEdges) { const c = concepts.find((c) => c.data.id === edge.source)!; expect(c.raw.split('\n')[edge.origin.line - 1]).toContain(edge.target); }
    expect(validateGraph(actual, { ...signature, sourceHash: actual.sourceHash })).toBe(actual);
    expect(actual.unitAggregation.flatMap((r) => r.edgeIds).sort()).toEqual(actual.formalEdges.map((e) => e.id).sort());
    const exceptions = JSON.parse(await readFile(resolve(root, 'docs/acceptance/concept-entry-exceptions.json'), 'utf8')) as { entries: { id: string }[] };
    expect(actual.concepts.filter((n) => n.exception).map((n) => n.id).sort()).toEqual(exceptions.entries.filter((e) => actual.concepts.some((n) => n.id === e.id && n.typedDegree === 0)).map((e) => e.id).sort());
    const max = actual.concepts.reduce((m, node) => Math.max(m, neighborhood(node.id, 2, [...actual.formalEdges, ...actual.bodyEdges] as GraphEdge[]).size), 0); expect(max).toBeGreaterThan(2);
  }, 30000);
});
