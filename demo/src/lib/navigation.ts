/** 只根據呼叫端已載入的路線與頁面決定導覽，不讀檔、不選預設代碼，也不變更內容或作答資料。 */
export interface NavigationStage {
  id: string;
  concepts: readonly { id: string }[];
}
export interface NavigationRoute {
  code: string;
  concepts: readonly string[];
  stages?: readonly NavigationStage[];
}
export interface NavigationConcept { id: string; codes: readonly string[]; }
export interface NavigationQuestion { id: string; codes: readonly string[]; }
export interface RouteLinks { routeHref: string | null; practiceHref: string | null; }
export interface ConceptNavigation extends RouteLinks {
  ownerCode: string | undefined;
  readingOrder: string[];
  previousId: string | undefined;
  nextId: string | undefined;
}
export interface NavigationLocation { pathname: string; search?: string; }

/** 路線與練習頁都由 codes 集合產生；只拿正式載入的代碼來判斷，不能用概念提及或草稿推測。 */
export function getRouteLinks(code: string, loadedRouteCodes: Iterable<string>): RouteLinks {
  const available = new Set(loadedRouteCodes).has(code);
  return {
    routeHref: available ? `/codes/${code}/` : null,
    practiceHref: available ? `/practice/${code}/` : null,
  };
}

/** 有階段就沿階段攤平，沒有階段才沿 concepts；缺頁略過，避免上一節／下一節連到不存在的概念。 */
export function routeReadingOrder(route: NavigationRoute, existingConceptIds: Iterable<string>): string[] {
  const existing = new Set(existingConceptIds);
  const order = route.stages ? route.stages.flatMap((stage) => stage.concepts.map(({ id }) => id)) : route.concepts;
  return order.filter((id) => existing.has(id));
}

/** 跨碼提及不改變主責：即使其他路線列出本概念，仍只從 codes[0] 的路線取得相鄰頁。 */
export function conceptNavigation(concept: NavigationConcept, routes: readonly NavigationRoute[], existingConceptIds: Iterable<string>): ConceptNavigation {
  const ownerCode = concept.codes[0];
  const route = routes.find((candidate) => candidate.code === ownerCode);
  const readingOrder = route ? routeReadingOrder(route, existingConceptIds) : [];
  const index = readingOrder.indexOf(concept.id);
  return {
    ownerCode,
    ...(ownerCode ? getRouteLinks(ownerCode, routes.map(({ code }) => code)) : { routeHref: null, practiceHref: null }),
    readingOrder,
    previousId: index > 0 ? readingOrder[index - 1] : undefined,
    nextId: index >= 0 ? readingOrder[index + 1] : undefined,
  };
}

/** 靜態頁面拿不到瀏覽器 query 時保留空上下文；未知或歧義 query 也不借用第一條路線。 */
export function resolveRouteContext<T extends NavigationRoute>(location: NavigationLocation, routes: readonly T[], concepts: readonly NavigationConcept[], questions: readonly NavigationQuestion[] = []): T | undefined {
  let pathname: string;
  try { pathname = decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/'; }
  catch { return undefined; }
  const direct = pathname.match(/^\/codes\/([^/]+)(?:\/cheatsheet)?$|^\/practice\/([^/]+)$/);
  if (direct) return routes.find(({ code }) => code === (direct[1] ?? direct[2]));
  const conceptId = pathname.match(/^\/concepts\/([^/]+)$/)?.[1];
  if (conceptId) return routes.find(({ code }) => code === concepts.find(({ id }) => id === conceptId)?.codes[0]);
  const questionId = pathname.match(/^\/questions\/([^/]+)$/)?.[1];
  if (questionId) return routes.find(({ code }) => code === questions.find(({ id }) => id === questionId)?.codes[0]);
  if (pathname !== '/quiz' && pathname !== '/self-check') return undefined;
  const params = new URLSearchParams(location.search);
  if (params.getAll('code').length !== 1 || params.getAll('stage').length > 1) return undefined;
  const route = routes.find(({ code }) => code === params.get('code'));
  if (params.has('stage') && !route?.stages?.some(({ id }) => id === params.get('stage'))) return undefined;
  return route;
}
