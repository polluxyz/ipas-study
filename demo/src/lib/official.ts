/** 官方題組依來源分組；排序、進度與分數都不依賴瀏覽器儲存。 */
import type { Attempt } from './attempts';

export interface OfficialQuestion {
  id: string; subject: number; source: string; session?: string; number?: number;
}
export function officialMode(session: string, subject: number): string { return `official:${session}:S${subject}`; }

/** 指引 ID 含印刷章節與頁碼，以數值比較避免第 10 題排在第 2 題之前。 */
export function compareOfficialQuestions(a: OfficialQuestion, b: OfficialQuestion): number {
  if (a.source === 'guide' && b.source === 'guide') return a.id.localeCompare(b.id, 'en', { numeric: true });
  const number = (q: OfficialQuestion) => q.number ?? Number(q.id.match(/-Q(\d+)$/)?.[1] ?? 0);
  return number(a) - number(b) || a.id.localeCompare(b.id, 'en', { numeric: true });
}

export function officialSets<T extends OfficialQuestion>(catalog: readonly T[]) {
  return ['114-2', '115-1', 'guide'].flatMap((session) => ([1, 3] as const).map((subject) => ({
    id: `${session}-S${subject}`, session, subject, mode: officialMode(session, subject),
    title: `${session === 'guide' ? '指引練習題' : session + ' 考古題'}・科目 ${subject}`,
    questions: catalog.filter((q) => q.subject === subject && (session === 'guide' ? q.source === 'guide' : q.source === 'exam' && q.session === session)).sort(compareOfficialQuestions),
  })));
}

/** 同模式每題取最新紀錄；同時刻以 ID 排序，避免匯入順序改變進度。 */
export function officialProgress(questions: readonly Pick<OfficialQuestion, 'id'>[], attempts: readonly Attempt[], mode: string) {
  const ids = new Set(questions.map((q) => q.id));
  const answered = new Map<string, Attempt>();
  const relevant = attempts.filter((a) => a.mode === mode && ids.has(a.qid));
  for (const attempt of relevant) {
    const previous = answered.get(attempt.qid);
    if (!previous || Date.parse(attempt.ts) > Date.parse(previous.ts) || (attempt.ts === previous.ts && attempt.id > previous.id)) answered.set(attempt.qid, attempt);
  }
  const correct = [...answered.values()].filter((a) => a.correct).length;
  return { answered, total: questions.length, done: answered.size, correct, score: correct * 2, elapsed: relevant.reduce((sum, a) => sum + a.ms, 0) };
}
