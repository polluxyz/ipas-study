/** 從內容集合組合閱讀與練習視圖；題數、閱讀順序與反向關係都從資料計算。 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { validateStages } from './learning-route';
export type Concept = CollectionEntry<'concepts'>;
export type Question = CollectionEntry<'questions'>['data'];
const warnedRoutes = new Set<string>();
export const conceptUrl = (id: string) => `/concepts/${id}/`;
export const questionUrl = (id: string) => `/questions/${id}/`;
export const sourceLabel = (q: Question) => q.source === 'exam' ? `${q.session} 科${q.subject} 第${q.number}題` : q.source === 'guide' ? `指引練習 第${q.number}題` : '模擬練習';
export async function getData() {
  const [concepts, codeEntries, questionEntries] = await Promise.all([getCollection('concepts'), getCollection('codes'), getCollection('questions')]);
  const questions = questionEntries.map((entry) => entry.data).sort((a, b) => a.id.localeCompare(b.id));
  for (const entry of codeEntries) for (const warning of validateStages(entry.data.concepts, entry.data.stages)) {
    const message = `[學習路線 ${entry.data.code}] ${warning}`;
    if (!warnedRoutes.has(message)) { console.warn(message); warnedRoutes.add(message); }
  }
  return { concepts, codes: codeEntries, questions, byId: new Map(concepts.map((c) => [c.data.id, c])) };
}
export function prerequisiteOrder(id: string, concepts: Concept[]): Concept[] {
  const byId = new Map(concepts.map((c) => [c.data.id, c]));
  const seen = new Set<string>([id]); const result: Concept[] = [];
  function visit(current: string) {
    for (const parent of byId.get(current)?.data.requires ?? []) {
      if (seen.has(parent)) continue;
      seen.add(parent); visit(parent);
      const entry = byId.get(parent); if (entry) result.push(entry);
    }
  }
  visit(id); return result;
}
export function categoryPaths(id: string, concepts: Concept[], visited = new Set<string>()): Concept[][] {
  if (visited.has(id)) throw new Error(`分類關係形成循環：${id}`);
  const current = concepts.find((c) => c.data.id === id);
  if (!current) throw new Error(`分類目標不存在：${id}`);
  const next = new Set([...visited, id]);
  return current.data.is_a.length ? current.data.is_a.flatMap((parent) => categoryPaths(parent, concepts, next).map((path) => [...path, current])) : [[current]];
}
