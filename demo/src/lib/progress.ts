/** 以已載入題目的目前版本統計進度；只讀取作答的既存判定，不處理儲存或錯題清單。 */
import type { Attempt } from './attempts';

export interface ProgressQuestion {
  id: string;
  rev: number;
  codes: readonly string[];
  source: 'exam' | 'guide' | 'mock';
}
export interface ProgressStats {
  totalQuestions: number;
  answeredQuestions: number;
  attemptCount: number;
  correctCount: number;
  /** 百分比取整數，沒有目前版本作答時保留空值，讓畫面顯示「—」。 */
  accuracy: number | null;
}
export interface CodeProgress extends ProgressStats { code: string; }
export interface ProgressSummary extends ProgressStats { byCode: CodeProgress[]; }

/** 首頁指定 exam；錯題本不指定來源。跨碼題的作答可計入各碼，但全站只計一次。 */
export function summarizeProgress(questions: readonly ProgressQuestion[], attempts: readonly Attempt[], source?: ProgressQuestion['source']): ProgressSummary {
  const byId = new Map<string, ProgressQuestion>();
  for (const question of questions) {
    if (!byId.has(question.id)) byId.set(question.id, question);
  }
  const selected = [...byId.values()].filter((question) => !source || question.source === source);
  const currentById = new Map(selected.map((question) => [question.id, question]));
  const currentAttempts = attempts.filter((attempt) => currentById.get(attempt.qid)?.rev === attempt.rev);
  function stats(group: readonly ProgressQuestion[], records: readonly Attempt[]): ProgressStats {
    const correctCount = records.filter((attempt) => attempt.correct).length;
    return {
      totalQuestions: group.length,
      answeredQuestions: new Set(records.map((attempt) => attempt.qid)).size,
      attemptCount: records.length,
      correctCount,
      accuracy: records.length ? Math.round(correctCount / records.length * 100) : null,
    };
  }
  const codes = [...new Set(selected.flatMap((question) => question.codes))].sort();
  return {
    ...stats(selected, currentAttempts),
    byCode: codes.map((code) => {
      const group = selected.filter((question) => question.codes.includes(code));
      const ids = new Set(group.map((question) => question.id));
      return { code, ...stats(group, currentAttempts.filter((attempt) => ids.has(attempt.qid))) };
    }),
  };
}
