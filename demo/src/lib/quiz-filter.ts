/** 測驗條件採交集；階段沿用概念題庫，錯題只認目前版本的最後一次作答。 */
import type { Attempt } from './attempts';
import { sampleQuestions, type Stage } from './learning-route';

export interface QuizQuestion { id: string; rev: number; subject: number; source: string; codes: string[]; concepts: string[]; }
export interface QuizCatalog {
  codes: { code: string; title: string; stages: Stage[] }[];
  concepts: { id: string; title: string }[];
  questions: QuizQuestion[];
}
export interface QuizFilters { subject: string; code: string; concept: string; source: string; wrong: boolean; stage: string; }
export const quizSourceLabels: Record<string, string> = { exam: '考古題', guide: '指引練習題', mock: '模擬題' };

// 保留字面 JSON 跳脫，避免概念標題提前結束 application/json 的 script 元素。
export function serializeQuizCatalog(catalog: QuizCatalog): string {
  return JSON.stringify(catalog).replace(/</g, '\\u003c');
}

export function readQuizFilters(params: URLSearchParams, catalog: QuizCatalog) {
  const errors: string[] = [];
  const read = (key: string, label: string) => {
    if (params.getAll(key).length > 1) errors.push(`${label}重複，請只選 1 個值。`);
    return params.get(key) ?? '';
  };
  const subject = read('subject', '科目'); const code = read('code', '代碼');
  const concept = read('concept', '概念'); const source = read('source', '來源');
  const wrong = read('wrong', '只練錯題'); const stage = read('stage', '學習階段');
  if (subject && !['1', '3'].includes(subject)) errors.push(`科目「${subject}」無效，請選科目 1 或科目 3。`);
  const unit = catalog.codes.find((entry) => entry.code === code);
  if (code && !unit) errors.push(`找不到代碼「${code}」。`);
  if (concept && !catalog.concepts.some((entry) => entry.id === concept)) errors.push(`找不到概念「${concept}」。`);
  if (source && !Object.hasOwn(quizSourceLabels, source)) errors.push(`來源「${source}」無效，請選考古題、指引練習題或模擬題。`);
  if (wrong && !['0', '1'].includes(wrong)) errors.push('只練錯題參數無效，請使用 wrong=1。');
  if (stage && !unit?.stages.some((entry) => entry.id === stage)) errors.push(`找不到指定代碼的學習階段「${stage}」，請重新選擇代碼與階段。`);
  return { filters: { subject, code, concept, source, wrong: wrong === '1', stage }, errors };
}

export function selectQuizQuestions(catalog: QuizCatalog, params: URLSearchParams, attempts: Attempt[] = [], random = Math.random) {
  const { filters, errors } = readQuizFilters(params, catalog);
  const code = catalog.codes.find((entry) => entry.code === filters.code);
  const stage = code?.stages.find((entry) => entry.id === filters.stage);
  if (errors.length) return { filters, errors, code, stage, pool: [], selected: [] };
  const latest = new Map<string, Attempt>();
  const revisions = new Map(catalog.questions.map((question) => [question.id, question.rev]));
  if (filters.wrong) for (const attempt of attempts) {
    if (attempt.rev !== revisions.get(attempt.qid)) continue;
    const previous = latest.get(attempt.qid);
    if (!previous || Date.parse(attempt.ts) > Date.parse(previous.ts) || (Date.parse(attempt.ts) === Date.parse(previous.ts) && attempt.id.localeCompare(previous.id) > 0)) latest.set(attempt.qid, attempt);
  }
  const pool = catalog.questions.filter((question) =>
    (!filters.subject || question.subject === Number(filters.subject)) &&
    // 階段原有連結依概念找跨碼題，code 在此用來定位階段。
    (stage ? question.concepts.some((id) => stage.concepts.some((concept) => concept.id === id)) : !filters.code || question.codes.includes(filters.code)) &&
    (!filters.concept || question.concepts.includes(filters.concept)) &&
    (!filters.source || question.source === filters.source) &&
    (!filters.wrong || latest.get(question.id)?.correct === false));
  return { filters, errors, code, stage, pool, selected: sampleQuestions(pool, stage ? 5 : 10, random) };
}
