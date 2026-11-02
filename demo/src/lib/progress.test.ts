/** 以跨科、跨碼與版本交錯的資料驗證統計，防止將最近一次判定或模擬題混入考古題進度。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from './attempts';
import { summarizeProgress, type ProgressQuestion } from './progress';
vi.mock('../data/revisions.json', () => ({ default: { '115-1-S1-Q01': 2, '115-1-S3-Q01': 1, '115-1-S3-Q44': 3 } }));
import { exportAttempts, getAttempts, getReadings, getWrongBook, importAttempts } from './attempts';

const questions: readonly ProgressQuestion[] = [
  { id: '115-1-S1-Q01', rev: 2, codes: ['L21101', 'L23203'], source: 'exam' },
  { id: '115-1-S3-Q01', rev: 1, codes: ['L23203'], source: 'exam' },
  { id: '115-1-S3-Q44', rev: 3, codes: ['L23303'], source: 'exam' },
  { id: 'M-L23303-001', rev: 1, codes: ['L23303'], source: 'mock' },
  { id: 'G-L21101-001', rev: 1, codes: ['L21101'], source: 'guide' },
];
function attempt(id: string, qid: string, rev: number, correct: boolean): Attempt {
  return { id, qid, rev, correct, choice: 'A', ts: '2026-11-02T10:00:00Z', mode: 'quiz', ms: 1000 };
}
const attempts: readonly Attempt[] = [
  attempt('a', '115-1-S1-Q01', 1, true),
  attempt('b', '115-1-S1-Q01', 2, false),
  attempt('c', '115-1-S1-Q01', 2, true),
  attempt('d', '115-1-S3-Q01', 1, false),
  attempt('e', '115-1-S3-Q44', 2, true),
  attempt('f', 'M-L23303-001', 1, true),
  attempt('g', 'unknown-question', 1, true),
  attempt('h', 'G-L21101-001', 1, true),
];

describe('目前版本進度與正確率', () => {
  it('考古題涵蓋兩科，排除模擬、指引、未知題及舊版本，重複作答只增加次數', () => {
    expect(summarizeProgress(questions, attempts, 'exam')).toMatchObject({
      totalQuestions: 3, answeredQuestions: 2, attemptCount: 3, correctCount: 1, accuracy: 33,
    });
  });
  it('只作答非 L23303 的考古題也增加進度，舊版本不增加進度', () => {
    expect(summarizeProgress(questions, [attempts[0], attempts[4]], 'exam')).toMatchObject({ answeredQuestions: 0, attemptCount: 0, accuracy: null });
    expect(summarizeProgress(questions, [attempts[2]], 'exam')).toMatchObject({ answeredQuestions: 1, attemptCount: 1, accuracy: 100 });
  });
  it('全題庫含三種來源，各碼使用全部目前版本作答，跨碼題不重複計入全站', () => {
    const result = summarizeProgress(questions, attempts);
    expect(result).toMatchObject({ totalQuestions: 5, answeredQuestions: 4, attemptCount: 5, correctCount: 3, accuracy: 60 });
    expect(result.byCode).toEqual([
      { code: 'L21101', totalQuestions: 2, answeredQuestions: 2, attemptCount: 3, correctCount: 2, accuracy: 67 },
      { code: 'L23203', totalQuestions: 2, answeredQuestions: 2, attemptCount: 3, correctCount: 1, accuracy: 33 },
      { code: 'L23303', totalQuestions: 2, answeredQuestions: 1, attemptCount: 1, correctCount: 1, accuracy: 100 },
    ]);
    expect(result.byCode.reduce((total, group) => total + group.totalQuestions, 0)).toBe(6);
    expect(result.totalQuestions).toBe(5);
  });
  it('不採最近一次判定替代頻次正確率，也不從選項重新判分', () => {
    const result = summarizeProgress(questions, [attempts[1], attempts[2]], 'exam');
    expect(result).toMatchObject({ answeredQuestions: 1, attemptCount: 2, correctCount: 1, accuracy: 50 });
  });
  it('重複題目與重複代碼不重複計數', () => {
    const repeated = { ...questions[0], codes: ['L21101', 'L21101', 'L23203'] };
    const result = summarizeProgress([repeated, repeated], [attempts[1], attempts[2]]);
    expect(result).toMatchObject({ totalQuestions: 1, answeredQuestions: 1, attemptCount: 2 });
    expect(result.byCode).toHaveLength(2);
    expect(result.byCode.every((group) => group.totalQuestions === 1 && group.attemptCount === 2)).toBe(true);
  });
  it('沒有作答的碼顯示空值，答錯作答則明確為零正確率', () => {
    const result = summarizeProgress(questions, [attempts[3]], 'exam');
    expect(result.byCode.find(({ code }) => code === 'L21101')).toMatchObject({ attemptCount: 0, accuracy: null });
    expect(result.byCode.find(({ code }) => code === 'L23203')).toMatchObject({ attemptCount: 1, accuracy: 0 });
  });
  it('零題、零作答與只有未知題的紀錄都不產生無效分母', () => {
    expect(summarizeProgress([], attempts)).toEqual({ totalQuestions: 0, answeredQuestions: 0, attemptCount: 0, correctCount: 0, accuracy: null, byCode: [] });
    expect(summarizeProgress(questions, [], 'exam')).toMatchObject({ totalQuestions: 3, answeredQuestions: 0, accuracy: null });
    expect(summarizeProgress(questions, [attempts[6]])).toMatchObject({ totalQuestions: 5, attemptCount: 0, accuracy: null });
    expect(summarizeProgress([questions[3]], attempts, 'exam').totalQuestions).toBe(0);
  });
  it('凍結輸入仍可運作，未知題與舊版紀錄原封保留', () => {
    const frozenQuestions = Object.freeze(questions.map((question) => Object.freeze({ ...question, codes: Object.freeze([...question.codes]) })));
    const frozenAttempts = Object.freeze(attempts.map((record) => Object.freeze({ ...record })));
    const before = JSON.stringify({ questions: frozenQuestions, attempts: frozenAttempts });
    summarizeProgress(frozenQuestions, frozenAttempts, 'exam');
    expect(JSON.stringify({ questions: frozenQuestions, attempts: frozenAttempts })).toBe(before);
  });
});

describe('統計與既有紀錄 API 相容性', () => {
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('頻次正確率與錯題最近一次判定分離，未知題留在原錯題清單與備份', () => {
    importAttempts(JSON.stringify({ version: 1, attempts: [attempts[1], attempts[2], attempts[6]] }));
    expect(summarizeProgress(questions, getAttempts(), 'exam')).toMatchObject({ answeredQuestions: 1, accuracy: 50 });
    expect(getWrongBook().map(({ qid, outdated }) => ({ qid, outdated }))).toEqual([{ qid: 'unknown-question', outdated: true }]);
    expect(getAttempts()).toHaveLength(3);
    expect(JSON.parse(exportAttempts()).attempts).toEqual([attempts[1], attempts[2], attempts[6]]);
  });
  it('隔離儲存中匯出、清空、還原與重複匯入保留未知題及已讀紀錄', () => {
    const readings = [{ conceptId: 'data-leakage', ts: '2026-11-02T10:00:00Z' }];
    expect(importAttempts(JSON.stringify({ version: 1, attempts: [attempts[0], attempts[2], attempts[6]], readings }))).toEqual({ added: 4, skipped: 0, invalid: 0 });
    const backup = exportAttempts();
    const before = summarizeProgress(questions, getAttempts(), 'exam');
    storage.clear();
    expect(getAttempts()).toEqual([]);
    expect(importAttempts(backup)).toEqual({ added: 4, skipped: 0, invalid: 0 });
    expect(summarizeProgress(questions, getAttempts(), 'exam')).toEqual(before);
    expect(getReadings()).toEqual(readings);
    expect(exportAttempts()).toBe(backup);
    expect(importAttempts(backup)).toEqual({ added: 0, skipped: 4, invalid: 0 });
    expect(exportAttempts()).toBe(backup);
  });
});
