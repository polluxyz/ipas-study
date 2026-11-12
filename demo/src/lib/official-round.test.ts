/** 合成考卷驗證輪次畫面資料，避免失效題、舊紀錄與重考改變歷史成績。 */
import { describe, expect, it } from 'vitest';
import type { Attempt } from './attempts';
import {
  availableOfficialQuestion, canSubmitOfficialRound, officialLegacyText, officialQuestionNumber,
  officialRoundCard, officialRoundList, officialRoundMode, officialRoundReviewAction, officialRoundScore,
  reconcileOfficialRound, type OfficialRoundCatalogQuestion, type OfficialRoundQuestionSource,
  type OfficialRoundSetSource, type OfficialRoundSource,
} from './official-round';

const qid = (number: number) => `115-1-S3-Q${number}`;
const question = (number: number, overrides: Partial<OfficialRoundCatalogQuestion> = {}): OfficialRoundCatalogQuestion => ({
  id: qid(number), rev: 1, subject: 3, source: 'exam', session: '115-1', number,
  review: { status: 'verified' }, ...overrides,
});
const savedQuestion = (number: number, overrides: Partial<OfficialRoundQuestionSource> = {}): OfficialRoundQuestionSource => ({
  id: qid(number), rev: 1, choice: null, unsure: false, ms: 0, ...overrides,
});
const round = (overrides: Partial<OfficialRoundSource> = {}): OfficialRoundSource => ({
  id: 'round-1', seq: 0, setId: '115-1-S3', subject: 3, number: 1,
  createdAt: '2026-11-10T00:00:00Z', attemptMode: officialRoundMode('round-1', 3),
  status: 'open', position: 0, questions: [savedQuestion(1), savedQuestion(2), savedQuestion(3)], ...overrides,
});
const submitted = (number: number, overrides: Partial<OfficialRoundSource> = {}): OfficialRoundSource => round({
  id: `round-${number}`, number, attemptMode: officialRoundMode(`round-${number}`, 3), status: 'submitted',
  questions: [savedQuestion(1, { choice: 'A', correct: true })],
  submission: { ts: `2026-11-${10 + number}T17:00:00Z`, total: 50, correct: 37 }, ...overrides,
});
const set = (questions = [question(1), question(2), question(3)]): OfficialRoundSetSource => ({
  id: '115-1-S3', session: '115-1', subject: 3, questions,
});
const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: 'legacy', qid: qid(1), rev: 1, choice: 'A', correct: true, ms: 100,
  ts: '2026-11-10T00:00:00Z', mode: 'official:115-1:S3', ...overrides,
});

describe('考古題有效題', () => {
  it.each([
    ['114-2', 1], ['114-2', 3], ['115-1', 1], ['115-1', 3],
  ] as const)('%s 科目 %s 接受該題組的有效題', (session, subject) => {
    const setId = `${session}-S${subject}`;
    const item = question(1, { id: `${setId}-Q01`, session, subject });
    expect(availableOfficialQuestion({ id: item.id, rev: 1 }, [item], { setId, subject })).toBe(true);
  });
  it.each(['verified', 'disputed'])('%s 題保留在考卷內', (status) => {
    expect(availableOfficialQuestion(savedQuestion(1), [question(1, { review: { status } })], round())).toBe(true);
  });
  it.each([
    ['版本改變', question(1, { rev: 2 })],
    ['科目不符', question(1, { subject: 1 })],
    ['場次不符', question(1, { session: '114-2' })],
    ['模擬題', question(1, { source: 'mock' })],
    ['指引題', question(1, { source: 'guide' })],
    ['未驗證', question(1, { review: { status: 'draft' } })],
    ['ID 不符', question(2)],
  ])('%s 無效', (_, item) => {
    expect(availableOfficialQuestion(savedQuestion(1), [item], round())).toBe(false);
  });
  it('移除的題目無效', () => {
    expect(availableOfficialQuestion(savedQuestion(1), [], round())).toBe(false);
  });
  it('題組、科目與題目 ID 必須一致', () => {
    expect(availableOfficialQuestion(savedQuestion(1), [question(1)], round({ setId: '114-2-S3' }))).toBe(false);
    expect(availableOfficialQuestion(savedQuestion(1), [question(1)], round({ subject: 1 }))).toBe(false);
    expect(availableOfficialQuestion(savedQuestion(1), [question(1)], round({ setId: 'guide-S3' }))).toBe(false);
    const wrongId = question(1, { id: '114-2-S3-Q1' });
    expect(availableOfficialQuestion({ id: wrongId.id, rev: 1 }, [wrongId], round())).toBe(false);
    const malformedId = question(1, { id: '115-1-S3-Qtext-Q1' });
    expect(availableOfficialQuestion({ id: malformedId.id, rev: 1 }, [malformedId], round())).toBe(false);
  });
});

describe('失效題依輪次狀態處理', () => {
  it('作答中略過失效題，位置仍指向原本正在看的題', () => {
    const original = round({ position: 2, questions: [savedQuestion(1), savedQuestion(2), savedQuestion(3, { choice: 'B', unsure: true, ms: 12 })] });
    const before = JSON.stringify(original);
    const result = reconcileOfficialRound(original, [question(1), question(3)]);
    expect(result).toMatchObject({ skipped: 1, unavailable: [], round: { position: 1 } });
    expect(result.round.questions.map((q) => q.id)).toEqual([qid(1), qid(3)]);
    expect(result.round.questions[1]).toBe(original.questions[2]);
    expect(JSON.stringify(original)).toBe(before);
  });
  it('目前題失效時向後找有效題，末題失效時退回最後一題', () => {
    expect(reconcileOfficialRound(round({ position: 1 }), [question(1), question(3)]).round.position).toBe(1);
    expect(reconcileOfficialRound(round({ position: 2 }), [question(1)]).round.position).toBe(0);
  });
  it('全部有效時保留原輪次參照', () => {
    const original = round();
    expect(reconcileOfficialRound(original, set().questions)).toEqual({ round: original, skipped: 0, unavailable: [] });
    expect(reconcileOfficialRound(original, set().questions).round).toBe(original);
  });
  it.each(['submitting', 'submitted'] as const)('%s 原樣保留題數、位置與固定成績，另列解析不可用', (status) => {
    const original = submitted(1, { status, position: 0 });
    const before = JSON.stringify(original);
    const result = reconcileOfficialRound(original, [question(1, { rev: 2 })]);
    expect(result).toEqual({ round: original, skipped: 0, unavailable: [qid(1)] });
    expect(result.round).toBe(original);
    expect(officialRoundScore(result.round.submission!)).toMatchObject({ points: 74, total: 50 });
    expect(JSON.stringify(original)).toBe(before);
  });
  it('全部失效時不能交卷，位置仍是有效的空清單起點', () => {
    const result = reconcileOfficialRound(round({ position: 2 }), []);
    expect(result).toMatchObject({ skipped: 3, unavailable: [], round: { position: 0, questions: [] } });
    expect(canSubmitOfficialRound(result.round)).toBe(false);
  });
  it('只有全部答完的非空未交卷輪次可以交卷', () => {
    expect(canSubmitOfficialRound(round())).toBe(false);
    expect(canSubmitOfficialRound(round({ questions: [savedQuestion(1, { choice: 'C' })] }))).toBe(true);
    expect(canSubmitOfficialRound(submitted(1))).toBe(false);
    expect(canSubmitOfficialRound(submitted(1, { status: 'submitting' }))).toBe(false);
  });
});

describe('原題號與成績文字', () => {
  it('優先使用題庫的原題號，缺題時從 ID 取得題號', () => {
    expect(officialQuestionNumber(qid(3), [question(3, { number: 43 })])).toBe(43);
    expect(officialQuestionNumber('115-1-S3-Q03', [])).toBe(3);
    expect(officialQuestionNumber(qid(3), [question(3, { number: undefined })])).toBe(3);
    expect(officialQuestionNumber('unknown', [])).toBeNull();
  });
  it('略過題目後仍保留原題號', () => {
    const catalog = [question(1), question(3)];
    const result = reconcileOfficialRound(round(), catalog);
    expect(result.round.questions.map((q) => officialQuestionNumber(q.id, catalog))).toEqual([1, 3]);
  });
  it('完整 50 題全對是 100 分', () => {
    expect(officialRoundScore({ total: 50, correct: 50 })).toEqual({
      total: 50, correct: 50, points: 100, answerText: '答對 50／50 題', scoreText: '100 分／100 分', summary: '100 分',
    });
    expect(officialRoundScore({ total: 50, correct: 37 }).scoreText).toBe('74 分／100 分');
    expect(officialRoundScore({ total: 50, correct: 0 }).points).toBe(0);
  });
  it('失效 1 題後只顯示答對 C／49，不換算 100 分', () => {
    const questions = Array.from({ length: 50 }, (_, index) => savedQuestion(index + 1, { choice: 'A' }));
    const catalog = Array.from({ length: 49 }, (_, index) => question(index + 1));
    const result = reconcileOfficialRound(round({ questions }), catalog);
    const score = officialRoundScore({ total: result.round.questions.length, correct: 37 });
    expect(result.skipped).toBe(1);
    expect(score).toMatchObject({ total: 49, correct: 37, points: null, scoreText: null,
      answerText: '答對 37／49 題・不是正式考試換算' });
  });
});

describe('目錄卡片、輪次清單與舊紀錄', () => {
  it('空題組卡片從第 1 輪開始，沒有虛構的進度與歷史', () => {
    expect(officialRoundCard(set(), [], [])).toEqual({
      action: { kind: 'start', number: 1, label: '開始第 1 輪' }, rows: [], progressText: null,
      submittedCount: 0, latestScore: null, historyText: null, legacyText: null,
    });
  });
  it('卡片顯示有效題的作答進度，已答但失效的題不列入', () => {
    const current = round({ number: 3, questions: [savedQuestion(1, { choice: 'A' }), savedQuestion(2, { choice: 'B' }), savedQuestion(3)] });
    const card = officialRoundCard(set([question(1), question(3)]), [submitted(1), submitted(2), current], []);
    expect(card).toMatchObject({ action: { kind: 'resume', roundId: current.id, number: 3, label: '繼續第 3 輪 →' },
      progressText: '第 3 輪・已答 1／2', submittedCount: 2, historyText: '已交卷 2 輪・最近 74 分' });
  });
  it('交卷中輪次仍可接續，目錄讀取不移除失效題或改交卷內容', () => {
    const current = submitted(2, { status: 'submitting' });
    const before = JSON.stringify(current);
    const card = officialRoundCard(set([]), [submitted(1), current], []);
    expect(card.progressText).toBe('第 2 輪・已答 1／1');
    expect(card.submittedCount).toBe(1);
    expect(card.action).toMatchObject({ kind: 'resume', roundId: current.id });
    expect(JSON.stringify(current)).toBe(before);
  });
  it('沒有未交卷輪次時按該題組最大輪次編號遞增', () => {
    expect(officialRoundList('115-1-S3', [submitted(2), submitted(90, { setId: '114-2-S1', subject: 1 })]).action)
      .toEqual({ kind: 'start', number: 3, label: '開始第 3 輪' });
  });
  it('已交卷清單新的在上，以台北日期顯示交卷日，不改輸入順序', () => {
    const rounds = [submitted(1), submitted(3, { setId: '114-2-S3' }), submitted(2), round({ number: 4 })];
    const before = JSON.stringify(rounds);
    const result = officialRoundList('115-1-S3', rounds);
    expect(result.rows.map((row) => [row.id, row.label, row.submittedDate, row.score.summary])).toEqual([
      ['round-2', '第 2 輪', '2026-11-13', '74 分'], ['round-1', '第 1 輪', '2026-11-12', '74 分'],
    ]);
    expect(JSON.stringify(rounds)).toBe(before);
  });
  it('不完整歷史考卷在卡片和清單都不顯示正式分數', () => {
    const previous = submitted(1, { submission: { total: 49, correct: 37, ts: '2026-11-11T00:00:00Z' } });
    const card = officialRoundCard(set(), [previous], []);
    expect(card.latestScore?.scoreText).toBeNull();
    expect(card.historyText).toBe('已交卷 1 輪・最近 答對 37／49 題・不是正式考試換算');
    expect(card.rows[0].score).toEqual(card.latestScore);
  });
  it('舊紀錄使用同模式每題最新作答，並排除新輪次模式', () => {
    const records = [attempt(), attempt({ id: 'latest', correct: false, ts: '2026-11-10T01:00:00Z' }),
      attempt({ id: 'second', qid: qid(2) }), attempt({ id: 'new', qid: qid(3), mode: officialRoundMode('new', 3) }),
      attempt({ id: 'other-set', qid: qid(3), mode: 'official:114-2:S3' })];
    expect(officialLegacyText(set(), records)).toBe('舊紀錄（即時解析）：已答 2／3・答對 1');
    const fullSet = set(Array.from({ length: 50 }, (_, index) => question(index + 1)));
    expect(officialLegacyText(fullSet, records)).toBe('舊紀錄（即時解析）：已答 2／50・答對 1');
  });
  it('只有舊紀錄時仍無輪次，舊紀錄不影響第 1 輪編號', () => {
    const card = officialRoundCard(set(), [], [attempt()]);
    expect(card.rows).toEqual([]);
    expect(card.submittedCount).toBe(0);
    expect(card.action).toMatchObject({ kind: 'start', number: 1 });
    expect(card.legacyText).toBe('舊紀錄（即時解析）：已答 1／3・答對 1');
    expect(officialLegacyText(set(), [attempt({ mode: officialRoundMode('new', 3) })])).toBeNull();
  });
});

describe('檢討頁按鈕與作答模式', () => {
  it('沒有未交卷輪次時顯示再考一次，其他題組的輪次不影響', () => {
    expect(officialRoundReviewAction('115-1-S3', [submitted(1), round({ setId: '114-2-S3' })]))
      .toEqual({ kind: 'start', number: 2, label: '再考一次' });
  });
  it.each(['open', 'submitting'] as const)('有 %s 輪次時回傳繼續按鈕與輪次 ID', (status) => {
    const current = round({ id: 'current', number: 2, status });
    expect(officialRoundReviewAction('115-1-S3', [submitted(1), current]))
      .toEqual({ kind: 'resume', roundId: 'current', number: 2, label: '繼續第 2 輪 →' });
  });
  it('輪次模式使用獨立前綴與科目', () => {
    expect(officialRoundMode('round-1', 1)).toBe('official-round:round-1:S1');
    expect(officialRoundMode('round-2', 3)).toBe('official-round:round-2:S3');
  });
});
