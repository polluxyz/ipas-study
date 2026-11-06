/** 每日交卷的純狀態規則；資料來源、舊作答與題號狀態不依賴畫面或儲存。 */
import type { Attempt, DailyDraft, DailySet } from './attempts';
import { dailyMode, type DailyQuestion, type DailySubject } from './daily';

export function dailySource(draft: DailyDraft | undefined, todaySet: DailySet | undefined): 'draft' | 'legacy' | 'new' {
  return draft ? 'draft' : todaySet ? 'legacy' : 'new';
}
export function createDailyDraft(set: DailySet, attempts: readonly Attempt[], scanLegacy: boolean, id: string): DailyDraft {
  const questions = set.questions.map((q) => {
    const previous = scanLegacy ? attempts.filter((a) => a.mode === dailyMode(set.date, set.subject) && a.qid === q.id && a.rev === q.rev)
      .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts) || b.id.localeCompare(a.id))[0] : undefined;
    return { ...q, choice: previous?.choice ?? null, unsure: false, ms: previous?.ms ?? 0,
      ...(previous ? { legacyAttemptId: previous.id, correct: previous.correct } : {}) };
  });
  return { id, seq: 0, subject: set.subject, date: set.date, status: 'open', position: Math.max(0, questions.findIndex((q) => !q.choice)), questions };
}
export function availableDailyQuestion(q: { id: string; rev: number }, catalog: readonly DailyQuestion[], subject: DailySubject): boolean {
  return catalog.some((item) => item.id === q.id && item.rev === q.rev && item.subject === subject && item.source === 'mock' && item.review.status === 'verified');
}
export function reconcileDailyDraft(draft: DailyDraft, catalog: readonly DailyQuestion[]): { draft: DailyDraft; skipped: number } {
  if (draft.status !== 'open') return { draft, skipped: 0 };
  const questions = draft.questions.filter((q) => availableDailyQuestion(q, catalog, draft.subject));
  const previous = draft.questions[draft.position]?.id;
  return { draft: { ...draft, questions, position: Math.max(0, questions.findIndex((q) => q.id === previous)) }, skipped: draft.questions.length - questions.length };
}
export function dailyNumbers(draft: DailyDraft): number[] {
  const first = draft.questions.findIndex((q) => !q.choice);
  return draft.questions.flatMap((q, index) => draft.status === 'submitted' || q.choice || index === first ? [index] : []);
}
export function dailyPosition(draft: DailyDraft, requested: number): number {
  const numbers = dailyNumbers(draft);
  return numbers.includes(requested) ? requested : numbers.includes(draft.position) ? draft.position : Math.max(0, draft.questions.findIndex((q) => !q.choice));
}
export function dailyNext(draft: DailyDraft, position: number): number {
  if (!draft.questions[position]?.choice && draft.status !== 'submitted') return position;
  const next = position + 1;
  return next >= draft.questions.length ? position : dailyNumbers(draft).includes(next) ? next : draft.questions.findIndex((q) => !q.choice);
}
export function dailyCounts(draft: DailyDraft): { answered: number; unsure: number; total: number } {
  return { answered: draft.questions.filter((q) => q.choice).length, unsure: draft.questions.filter((q) => q.unsure).length, total: draft.questions.length };
}
export type DailyNumberState = 'unavailable' | 'correct' | 'wrong' | 'unsure' | 'answered' | 'unanswered';
export function dailyNumberState(draft: DailyDraft, position: number, available = true): DailyNumberState {
  const q = draft.questions[position];
  return draft.status === 'submitted' ? !available ? 'unavailable' : q.correct ? 'correct' : 'wrong' : q.unsure ? 'unsure' : q.choice ? 'answered' : 'unanswered';
}
export function prepareDailySubmission(draft: DailyDraft, answers: ReadonlyMap<string, string>, ts: string, randomId: () => string): DailyDraft {
  if (draft.status !== 'open' || !draft.questions.length || draft.questions.some((q) => !q.choice || !answers.has(q.id))) throw new Error('全部有效題目作答後才能交卷。');
  const questions = draft.questions.map((q) => ({ ...q, correct: q.legacyAttemptId ? Boolean(q.correct) : q.choice === answers.get(q.id) }));
  const attempts: Attempt[] = questions.filter((q) => !q.legacyAttemptId).map((q) => ({ id: randomId(), qid: q.id, rev: q.rev, choice: q.choice!, correct: q.correct,
    ts, mode: dailyMode(draft.date, draft.subject), ms: q.ms }));
  return { ...draft, status: 'submitting', questions, submission: { ts, attempts, total: questions.length, correct: questions.filter((q) => q.correct).length } };
}
