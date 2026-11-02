/** 教材視圖只組合學習欄位與檢核題；以概念 ID 隔開同名小題，不混入考古題或作答紀錄。 */
export interface Goal { id: string; text: string; }
export type SelfCheck = { id: string; goal: string; prompt: string } & (
  { type: 'choice'; options: Record<string, string>; answer: string; explain: Record<string, string> } |
  { type: 'short'; key_points: string[] }
);
export interface TextbookConcept { id: string; title: string; summary?: string; goals?: Goal[]; self_check?: SelfCheck[]; }
/** 僅排列顯示順序，保留題目物件與 ID，並維持各類型原本的先後。 */
export function orderSelfChecks<T extends SelfCheck>(checks: readonly T[]): T[] {
  return [...checks.filter((check) => check.type === 'choice'), ...checks.filter((check) => check.type === 'short')];
}
export function conceptLearning(data: TextbookConcept) {
  return { summary: data.summary, goals: data.goals ?? [], checks: orderSelfChecks(data.self_check ?? []) };
}
export function stageChecks(ids: string[], concepts: TextbookConcept[]) {
  return orderSelfChecks([...new Set(ids)].flatMap((id) => {
    const concept = concepts.find((item) => item.id === id);
    return (concept?.self_check ?? []).map((check) => ({ ...check, id: `${id}:${check.id}`, conceptId: id, conceptTitle: concept!.title }));
  }));
}
export function optionFeedback(check: Extract<SelfCheck, { type: 'choice' }>, selected?: string) {
  return selected && selected in check.options ? Object.entries(check.options).map(([id]) => ({ id, correct: id === check.answer, text: check.explain[id] ?? '' })) : [];
}
