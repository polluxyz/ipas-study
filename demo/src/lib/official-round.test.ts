/** 合成考卷驗證輪次畫面資料，避免失效題、舊紀錄與重考改變歷史成績。 */
import { describe, expect, it } from 'vitest';
import type { Attempt } from './attempts';
import {
  availableOfficialQuestion, canSubmitOfficialRound, officialLegacyText, officialQuestionNumber, officialRetiredSummary,
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

describe('目錄卡片、紀錄清單與舊紀錄', () => {
  it('沒有紀錄時開始作答，沒有虛構的進度與歷史', () => {
    expect(officialRoundCard(set(), [], [])).toEqual({
      action: { kind: 'start', label: '開始作答' }, rows: [], progressText: null,
      submittedCount: 0, latestScore: null, latestSubmittedId: null, historyText: null, legacyText: null,
    });
  });
  it('只有作答中時可繼續，沒有交卷成績', () => {
    expect(officialRoundCard(set(), [round()], [])).toEqual({
      action: { kind: 'resume', roundId: 'round-1', label: '繼續作答 →' }, rows: [],
      progressText: '作答中・已答 0／3', submittedCount: 0, latestScore: null,
      latestSubmittedId: null, historyText: null, legacyText: null,
    });
  });
  it('有交卷但沒有作答中時可重新開始', () => {
    expect(officialRoundCard(set(), [submitted(1)], [])).toMatchObject({
      action: { kind: 'start', label: '重新開始' }, progressText: null,
      submittedCount: 1, latestScore: { summary: '74 分' }, latestSubmittedId: 'round-1',
      historyText: '已交卷 1 次・最近 74 分',
    });
  });
  it('卡片顯示有效題的作答進度，已答但失效的題不列入', () => {
    const current = round({ number: 3, questions: [savedQuestion(1, { choice: 'A' }), savedQuestion(2, { choice: 'B' }), savedQuestion(3)] });
    const card = officialRoundCard(set([question(1), question(3)]), [submitted(1), submitted(2), current], []);
    expect(card).toMatchObject({ action: { kind: 'resume', roundId: current.id, label: '繼續作答 →' },
      progressText: '作答中・已答 1／2', submittedCount: 2, latestSubmittedId: 'round-2', historyText: '已交卷 2 次・最近 74 分' });
  });
  it('只有未交卷紀錄時重新開始，目錄和全部紀錄的按鈕一致', () => {
    const previous = round({ status: 'retired' });
    const card = officialRoundCard(set(), [previous], []);
    expect(card).toMatchObject({ action: { kind: 'start', label: '重新開始' }, progressText: null,
      submittedCount: 0, latestSubmittedId: null, latestScore: null, historyText: null });
    expect(card.rows).toHaveLength(1);
    expect(card.action).toEqual(officialRoundList(set().id, [previous]).action);
  });
  it('最新一筆未交卷不增加交卷次數，仍回看最近交卷成績', () => {
    const rounds = [submitted(2, { submission: { ts: '2026-11-13T00:00:00Z', total: 50, correct: 38 } }),
      round({ id: 'retired', number: 3, status: 'retired' }), submitted(1)];
    const card = officialRoundCard(set(), rounds, []);
    expect(card.rows[0]).toMatchObject({ id: 'retired', score: null });
    expect(card).toMatchObject({ submittedCount: 2, latestSubmittedId: 'round-2',
      latestScore: { summary: '76 分' }, historyText: '已交卷 2 次・最近 76 分' });
  });
  it('交卷中輪次仍可接續，目錄讀取不移除失效題或改交卷內容', () => {
    const current = submitted(2, { status: 'submitting' });
    const before = JSON.stringify(current);
    const card = officialRoundCard(set([]), [submitted(1), current], []);
    expect(card.progressText).toBe('作答中・已答 1／1');
    expect(card.submittedCount).toBe(1);
    expect(card.action).toMatchObject({ kind: 'resume', roundId: current.id });
    expect(JSON.stringify(current)).toBe(before);
  });
  it('其他題組不影響開始按鈕，同題組已交卷後重新開始', () => {
    expect(officialRoundList('115-1-S3', [submitted(90, { setId: '114-2-S1', subject: 1 })]).action)
      .toEqual({ kind: 'start', label: '開始作答' });
    expect(officialRoundList('115-1-S3', [submitted(2), submitted(90, { setId: '114-2-S1', subject: 1 })]).action)
      .toEqual({ kind: 'start', label: '重新開始' });
  });
  it('歷史只含同題組交卷與未交卷，依編號新的在上且不改輸入', () => {
    const rounds = [submitted(1, { createdAt: '2026-11-13T06:05:09Z' }),
      submitted(9, { setId: '114-2-S3' }), submitted(2, { createdAt: '2026-11-13T06:20:00Z' }),
      round({ id: 'retired', number: 3, status: 'retired', createdAt: '2026-11-13T06:25:00Z',
        questions: [savedQuestion(1, { choice: 'B' }), savedQuestion(2)] }),
      round({ id: 'open', number: 4 }), submitted(5, { status: 'submitting' }),
      submitted(6, { submission: undefined })];
    const before = JSON.stringify(rounds);
    const result = officialRoundList('115-1-S3', rounds);
    expect(result.rows.map((row) => [row.id, row.status, row.startedText, row.statusText, row.resultText])).toEqual([
      ['retired', 'retired', '2026-11-13 14:25:00', '未交卷', '已答 1／2'],
      ['round-2', 'submitted', '2026-11-13 14:20:00', '已交卷', '74 分'],
      ['round-1', 'submitted', '2026-11-13 14:05:09', '已交卷', '74 分'],
    ]);
    expect(result.rows[2].createdAt).toBe(rounds[0].createdAt);
    expect(JSON.stringify(rounds)).toBe(before);
  });
  it('同秒的列依編號從小到大加序號，不影響其他列', () => {
    const result = officialRoundList('115-1-S3', [submitted(8, { createdAt: '2026-11-13T06:05:09.900Z' }),
      round({ id: 'retired', number: 2, status: 'retired', createdAt: '2026-11-13T06:05:09.100Z' }),
      submitted(3, { createdAt: '2026-11-13T06:05:10Z' }),
      submitted(20, { setId: '114-2-S3', createdAt: '2026-11-13T06:05:10Z' }),
      round({ number: 10, createdAt: '2026-11-13T06:05:10Z' })]);
    expect(result.rows.map((row) => row.startedText)).toEqual([
      '2026-11-13 14:05:09・同時間第 2 筆', '2026-11-13 14:05:10', '2026-11-13 14:05:09・同時間第 1 筆',
    ]);
    expect(result.rows[0].ariaLabel).toBe('查看 2026-11-13 14:05:09・同時間第 2 筆 已交卷 74 分');
  });
  it('時間以台北日界顯示，午夜是 00 點', () => {
    expect(officialRoundList(set().id, [submitted(1, { createdAt: '2026-11-12T16:00:01Z' })]).rows[0].startedText)
      .toBe('2026-11-13 00:00:01');
  });
  it('朗讀文字包含開始時間、狀態與實際結果', () => {
    const questions = Array.from({ length: 50 }, (_, index) => savedQuestion(index + 1, { choice: index < 12 ? 'A' : null }));
    const result = officialRoundList(set().id, [submitted(1, { createdAt: '2026-11-13T06:05:09Z',
      submission: { ts: '2026-11-14T00:00:00Z', total: 50, correct: 38 } }),
      round({ id: 'retired', number: 2, status: 'retired', createdAt: '2026-11-13T06:20:00Z', questions })]);
    expect(result.rows.map((row) => row.ariaLabel)).toEqual([
      '查看 2026-11-13 14:20:00 未交卷 已答 12／50', '查看 2026-11-13 14:05:09 已交卷 76 分',
    ]);
  });
  it('不完整歷史考卷在卡片和清單都不顯示正式分數', () => {
    const previous = submitted(1, { submission: { total: 49, correct: 37, ts: '2026-11-11T00:00:00Z' } });
    const card = officialRoundCard(set(), [previous], []);
    expect(card.latestScore?.scoreText).toBeNull();
    expect(card.historyText).toBe('已交卷 1 次・最近 答對 37／49 題・不是正式考試換算');
    expect(card.rows[0].score).toEqual(card.latestScore);
    expect(card.rows[0].resultText).toBe('答對 37／49 題・不是正式考試換算');
    expect(card.rows[0].ariaLabel).toContain('已交卷 答對 37／49 題・不是正式考試換算');
  });
  it('舊紀錄使用同模式每題最新作答，並排除新輪次模式', () => {
    const records = [attempt(), attempt({ id: 'latest', correct: false, ts: '2026-11-10T01:00:00Z' }),
      attempt({ id: 'second', qid: qid(2) }), attempt({ id: 'new', qid: qid(3), mode: officialRoundMode('new', 3) }),
      attempt({ id: 'other-set', qid: qid(3), mode: 'official:114-2:S3' })];
    expect(officialLegacyText(set(), records)).toBe('舊紀錄（即時解析）：已答 2／3・答對 1');
    const fullSet = set(Array.from({ length: 50 }, (_, index) => question(index + 1)));
    expect(officialLegacyText(fullSet, records)).toBe('舊紀錄（即時解析）：已答 2／50・答對 1');
  });
  it('只有舊紀錄時仍無歷史，舊紀錄不影響開始按鈕', () => {
    const card = officialRoundCard(set(), [], [attempt()]);
    expect(card.rows).toEqual([]);
    expect(card.submittedCount).toBe(0);
    expect(card.action).toEqual({ kind: 'start', label: '開始作答' });
    expect(card.legacyText).toBe('舊紀錄（即時解析）：已答 1／3・答對 1');
    expect(officialLegacyText(set(), [attempt({ mode: officialRoundMode('new', 3) })])).toBeNull();
  });
});

describe('檢討頁按鈕與作答模式', () => {
  it('沒有作答中時顯示重新開始，其他題組的紀錄不影響', () => {
    expect(officialRoundReviewAction('115-1-S3', [submitted(1), round({ setId: '114-2-S3' })]))
      .toEqual({ kind: 'start', label: '重新開始' });
    expect(officialRoundReviewAction('115-1-S3', [])).toEqual({ kind: 'start', label: '重新開始' });
  });
  it.each(['open', 'submitting'] as const)('有 %s 輪次時回傳繼續按鈕與輪次 ID', (status) => {
    const current = round({ id: 'current', number: 2, status });
    expect(officialRoundReviewAction('115-1-S3', [submitted(1), current]))
      .toEqual({ kind: 'resume', roundId: 'current', label: '繼續作答 →' });
  });
  it('輪次模式使用獨立前綴與科目', () => {
    expect(officialRoundMode('round-1', 1)).toBe('official-round:round-1:S1');
    expect(officialRoundMode('round-2', 3)).toBe('official-round:round-2:S3');
  });
});

describe('未交卷紀錄與畫面用詞', () => {
  it.each([
    [[], '未交卷・已答 0／0・不計分'],
    [[savedQuestion(1)], '未交卷・已答 0／1・不計分'],
    [[savedQuestion(1, { choice: 'D', unsure: true }), savedQuestion(2, { unsure: true })], '未交卷・已答 1／2・不計分'],
  ] as const)('未交卷摘要只計有選答案的題目 %j', (questions, expected) => {
    expect(officialRetiredSummary(round({ status: 'retired', questions }))).toBe(expected);
  });
  it('未交卷紀錄失效後仍保留原題數與答案，不能交卷', () => {
    const original = round({ status: 'retired', questions: [savedQuestion(1, { choice: 'A' })] });
    expect(reconcileOfficialRound(original, [])).toEqual({ round: original, skipped: 0, unavailable: [qid(1)] });
    expect(canSubmitOfficialRound(original)).toBe(false);
    expect(officialRetiredSummary(original)).toBe('未交卷・已答 1／1・不計分');
  });
  it('所有畫面資料都不含舊用詞', () => {
    const cases = [[], [round()], [submitted(1)], [submitted(1), round({ number: 2 })],
      [round({ status: 'retired' })], [submitted(1, { submission: { total: 49, correct: 30, ts: '2026-11-13T00:00:00Z' } })]];
    for (const rounds of cases) {
      const returned = [officialRoundCard(set(), rounds, [attempt()]), officialRoundList(set().id, rounds),
        officialRoundReviewAction(set().id, rounds), officialRetiredSummary(round({ status: 'retired' })),
        officialRetiredSummary(round({ status: 'retired', questions: [] })), officialRoundScore({ total: 50, correct: 38 }),
        officialLegacyText(set(), [attempt()])];
      expect(JSON.stringify(returned)).not.toMatch(/輪|再考一次|重新考/);
    }
  });
});
