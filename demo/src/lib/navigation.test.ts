/** 用隔離的多路線 fixtures 驗證可用性與主責邊界；真實路線另讀正式 content，不把草稿當發布資料。 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { conceptNavigation, getRouteLinks, resolveRouteContext, routeReadingOrder, type NavigationConcept, type NavigationRoute } from './navigation';

// 三條路線刻意讓 concepts 與 stages 順序不同，抓出錯用總表、硬編 L23303 或跨碼接管的退化。
const routes = [
  { code: 'L21101', concepts: ['nlp-last', 'nlp-first', 'nlp-middle'], stages: [
    { id: 'nlp-basics', concepts: [{ id: 'nlp-first' }, { id: 'missing' }, { id: 'nlp-middle' }] },
    { id: 'nlp-applications', concepts: [{ id: 'nlp-last' }] },
  ] },
  { code: 'L23203', concepts: ['dl-last', 'dl-first', 'dl-middle'], stages: [
    { id: 'dl-basics', concepts: [{ id: 'dl-first' }] },
    { id: 'dl-frameworks', concepts: [{ id: 'dl-middle' }, { id: 'dl-last' }] },
  ] },
  { code: 'L23303', concepts: ['ml-first', 'ml-middle', 'ml-last'] },
] as const satisfies readonly NavigationRoute[];
const concepts: NavigationConcept[] = [
  ...['nlp-first', 'nlp-middle', 'nlp-last'].map((id) => ({ id, codes: ['L21101', 'L23303'] })),
  ...['dl-first', 'dl-middle', 'dl-last'].map((id) => ({ id, codes: ['L23203'] })),
  ...['ml-first', 'ml-middle', 'ml-last'].map((id) => ({ id, codes: ['L23303'] })),
  { id: 'unmerged', codes: ['L21201', 'L23303'] },
];
const ids = concepts.map(({ id }) => id);
const questions = [{ id: 'q-cross', codes: ['L23203', 'L23303'] }, { id: 'q-unmerged', codes: ['L21201', 'L21101'] }];

describe('可用路線與閱讀順序', () => {
  it('只對載入的代碼回傳學習與練習 href，空集合不假設 L23303 存在', () => {
    expect(getRouteLinks('L21101', new Set(['L21101']))).toEqual({ routeHref: '/codes/L21101/', practiceHref: '/practice/L21101/' });
    expect(getRouteLinks('L21101', ['L23303'])).toEqual({ routeHref: null, practiceHref: null });
    expect(getRouteLinks('L23303', [])).toEqual({ routeHref: null, practiceHref: null });
  });

  it.each([
    ['L21101', ['nlp-first', 'nlp-middle', 'nlp-last']],
    ['L23203', ['dl-first', 'dl-middle', 'dl-last']],
    ['L23303', ['ml-first', 'ml-middle', 'ml-last']],
  ])('%s 的首中尾沿自己的閱讀順序，階段中的缺頁不產生連結', (code, order) => {
    const route = routes.find((candidate) => candidate.code === code)!;
    expect(routeReadingOrder(route, ids)).toEqual(order);
    for (const [index, id] of order.entries()) {
      const concept = concepts.find((candidate) => candidate.id === id)!;
      expect(conceptNavigation(concept, routes, ids)).toMatchObject({
        ownerCode: code, routeHref: `/codes/${code}/`, readingOrder: order,
        previousId: order[index - 1], nextId: order[index + 1],
      });
    }
  });

  it('沒有 stages 沿 concepts；明列空 stages 不擅自補入另一個順序', () => {
    expect(routeReadingOrder(routes[2], ['ml-first', 'ml-last'])).toEqual(['ml-first', 'ml-last']);
    expect(routeReadingOrder({ ...routes[2], stages: [] }, ids)).toEqual([]);
  });

  it('其他路線收錄跨碼概念，也不改主責或借用其他路線的相鄰頁', () => {
    const foreignRoute = { code: 'L23303', concepts: ['ml-first', 'nlp-middle', 'ml-last', 'unmerged'] };
    const concept = concepts.find(({ id }) => id === 'nlp-middle')!;
    expect(conceptNavigation(concept, [foreignRoute, routes[0]], ids)).toMatchObject({ ownerCode: 'L21101', previousId: 'nlp-first', nextId: 'nlp-last' });
    expect(conceptNavigation(concept, [foreignRoute], ids)).toEqual({ ownerCode: 'L21101', routeHref: null, practiceHref: null, readingOrder: [], previousId: undefined, nextId: undefined });
    expect(conceptNavigation(concepts.at(-1)!, [foreignRoute], ids).routeHref).toBeNull();
  });

  it('目前概念缺頁、未列在主責路線或沒有代碼時不產生前後頁', () => {
    for (const concept of [{ id: 'missing', codes: ['L21101'] }, { id: 'unlisted', codes: ['L21101'] }, { id: 'nlp-middle', codes: [] }]) {
      const result = conceptNavigation(concept, routes, ids);
      expect(result.previousId).toBeUndefined();
      expect(result.nextId).toBeUndefined();
    }
    expect(routeReadingOrder(routes[0], [])).toEqual([]);
  });

  it('不改變凍結的路線、階段與概念清單，每次回傳新的閱讀陣列', () => {
    const stage = Object.freeze({ id: 'frozen', concepts: Object.freeze([Object.freeze({ id: 'a' }), Object.freeze({ id: 'b' })]) });
    const route = Object.freeze({ code: 'L21101', concepts: Object.freeze(['b', 'a']), stages: Object.freeze([stage]) });
    const existing = Object.freeze(['a', 'b']);
    routeReadingOrder(route, existing).reverse();
    expect(routeReadingOrder(route, existing)).toEqual(['a', 'b']);
    expect(route.concepts).toEqual(['b', 'a']);
  });

  it('正式已合併的 L23303 沿實際階段與實際概念主碼，缺少其他主責路線時不跨碼借路', () => {
    const file = readFileSync(new URL('../../../content/codes/L23303.md', import.meta.url), 'utf8');
    const route: NavigationRoute = parse(file.split(/^---\s*$/m)[1]);
    const existing = readdirSync(new URL('../../../content/concepts/', import.meta.url)).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3));
    const order = routeReadingOrder(route, existing);
    expect(order).toEqual(route.concepts);
    expect(order.length).toBeGreaterThan(2);
    for (const [index, id] of order.entries()) {
      const source = readFileSync(new URL(`../../../content/concepts/${id}.md`, import.meta.url), 'utf8');
      const concept: NavigationConcept = parse(source.split(/^---\s*$/m)[1]);
      const result = conceptNavigation(concept, [route], existing);
      expect(result.previousId).toBe(concept.codes[0] === route.code ? order[index - 1] : undefined);
      expect(result.nextId).toBe(concept.codes[0] === route.code ? order[index + 1] : undefined);
    }
  });
});

describe('目前路線上下文', () => {
  it('21 條已載入路線只選目前一條，保留超過六個階段的完整資料給既有數字 fallback', () => {
    const manyRoutes = Array.from({ length: 21 }, (_, index) => ({ code: `route-${index}`, concepts: [], stages: Array.from({ length: 8 }, (_, stageIndex) => ({ id: `stage-${stageIndex}`, title: `章節 ${stageIndex}`, concepts: [] })) }));
    const current = resolveRouteContext({ pathname: '/codes/route-19/' }, manyRoutes, []);
    expect(current).toBe(manyRoutes[19]);
    expect(current?.stages.map(({ title }) => title)).toHaveLength(8);
    expect(resolveRouteContext({ pathname: '/' }, manyRoutes, [])).toBeUndefined();
  });

  it.each(['/codes/L21101/', '/codes/L21101/cheatsheet/', '/practice/L21101', '/codes/%4C21101/'])('直接路徑 %s 辨認載入的路線', (pathname) => {
    expect(resolveRouteContext({ pathname }, routes, concepts)?.code).toBe('L21101');
  });

  it('概念與題目都使用主碼；跨碼次要碼不接管，未載入或缺頁則不選路線', () => {
    expect(resolveRouteContext({ pathname: '/concepts/nlp-middle/' }, routes, concepts)?.code).toBe('L21101');
    expect(resolveRouteContext({ pathname: '/questions/q-cross/' }, routes, concepts, questions)?.code).toBe('L23203');
    for (const pathname of ['/concepts/unmerged/', '/concepts/missing/', '/questions/q-unmerged/', '/questions/unknown/', '/codes/L21201/', '/codes/L21101/unknown/']) {
      expect(resolveRouteContext({ pathname }, routes, concepts, questions)).toBeUndefined();
    }
  });

  it.each(['/', '/catalog/', '/map/', '/wrong-book/', '/unknown/'])('%s 不因 query 或第一個已載入代碼硬選路線', (pathname) => {
    expect(resolveRouteContext({ pathname, search: '?code=L21101' }, routes, concepts)).toBeUndefined();
  });

  it.each(['/quiz/', '/self-check/'])('%s 只接受明確已載入的 code 及有效 stage', (pathname) => {
    expect(resolveRouteContext({ pathname, search: '?code=L21101&stage=nlp-basics' }, routes, concepts)?.code).toBe('L21101');
    expect(resolveRouteContext({ pathname, search: '?code=L23203' }, routes, concepts)?.code).toBe('L23203');
    for (const search of ['', '?stage=nlp-basics', '?code=L21201', '?code=', '?code=L21101&stage=unknown', '?code=L23303&stage=nlp-basics', '?code=L21101&code=L23203', '?code=L21101&stage=nlp-basics&stage=nlp-basics']) {
      expect(resolveRouteContext({ pathname, search }, routes, concepts)).toBeUndefined();
    }
  });

  it('空路線集合及壞的網址編碼安全回傳空上下文', () => {
    expect(resolveRouteContext({ pathname: '/concepts/nlp-middle/' }, [], concepts)).toBeUndefined();
    expect(resolveRouteContext({ pathname: '/concepts/%E0%A4/' }, routes, concepts)).toBeUndefined();
  });
});
