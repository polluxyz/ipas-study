/** 路線與頻率採純函式計算；階段重疊的題目只算一次，進度只認目前題目版本。 */
import type { Attempt } from './attempts';
export interface Stage { id: string; title: string; intro?: string; concepts: { id: string; goal: string }[]; }
export interface RouteQuestion { id: string; rev: number; source: string; session?: string; subject: number; concepts: string[]; }
export function flattenStages(stages: Stage[]): string[] { return stages.flatMap((stage) => stage.concepts.map((concept) => concept.id)); }
export function validateStages(concepts: string[], stages?: Stage[]): string[] {
  if (!stages) return [];
  const flat = flattenStages(stages);
  const warnings: string[] = [];
  if (flat.length !== concepts.length || flat.some((id, index) => id !== concepts[index])) warnings.push('stages 攤平後與 concepts 的 ID 或順序不一致');
  if (new Set(stages.map((stage) => stage.id)).size !== stages.length) warnings.push('stages 含重複的階段 ID');
  return warnings;
}
export function relatedQuestions<T extends RouteQuestion>(questions: T[], conceptIds: string[]): T[] {
  const ids = new Set(conceptIds);
  return [...new Map(questions.filter((question) => question.concepts.some((id) => ids.has(id))).map((question) => [question.id, question])).values()];
}
export function examFrequency(questions: RouteQuestion[], conceptIds: string[]) {
  const exam = relatedQuestions(questions, conceptIds).filter((question) => question.source === 'exam');
  const groups = new Map<string, { session: string; subject: number; count: number }>();
  for (const question of exam) {
    const session = question.session ?? '未標場次'; const key = `${session}-S${question.subject}`;
    const group = groups.get(key) ?? { session, subject: question.subject, count: 0 };
    group.count++; groups.set(key, group);
  }
  return { total: exam.length, groups: [...groups.values()].sort((a, b) => a.session.localeCompare(b.session) || a.subject - b.subject) };
}
export function stageProgress(questions: Pick<RouteQuestion, 'id' | 'rev'>[], attempts: Attempt[]) {
  let attempted = 0; let correct = 0;
  for (const question of questions) {
    const latest = attempts.filter((attempt) => attempt.qid === question.id && attempt.rev === question.rev).sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts) || b.id.localeCompare(a.id))[0];
    if (latest) { attempted++; if (latest.correct) correct++; }
  }
  return { attempted, correct, total: questions.length };
}
export function sampleQuestions<T>(questions: T[], limit: number, random = Math.random): T[] {
  const pool = [...questions];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, Math.max(0, limit));
}
