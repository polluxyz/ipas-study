/** 考古題輪次測試保護跨頁資料與固定提交內容，容量數字只記錄、不設門檻。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOKLET_KEY, DRAFT_KEY, OFFICIAL_ROUND_KEY, OFFICIAL_ROUND_SETS, STORAGE_KEY, DailyConflictError,
  clearStudyData, exportAttempts, getAttempts, importAttempts, isOfficialRoundStore, openOfficialRound,
  readOfficialRounds, restartOfficialRound, saveAttemptBatch, saveOfficialRound, submitOfficialRound,
  type Attempt, type OfficialRound, type OfficialRoundRef, type OfficialRoundStore,
} from './attempts';

const TS = '2026-11-12T03:00:00Z';
function make(overrides: Partial<OfficialRound> = {}): OfficialRound {
  const id = overrides.id ?? 'one'; const setId = overrides.setId ?? '115-1-S3';
  const subject = OFFICIAL_ROUND_SETS[setId as keyof typeof OFFICIAL_ROUND_SETS] ?? 3;
  return {
    id, seq: 0, setId, subject, number: 1, createdAt: TS, attemptMode: `official-round:${id}:S${subject}`,
    status: 'open', position: 0,
    questions: [1, 2].map((n) => ({ id: `${setId}-Q0${n}`, rev: 1, choice: null, unsure: false, ms: 0 })),
    ...overrides,
  };
}
function prepare(round: OfficialRound): OfficialRound {
  const questions = round.questions.map((q, i) => ({ ...q, choice: q.choice ?? 'A' as const, correct: i % 2 === 0 }));
  return { ...round, status: 'submitting', questions, submission: {
    ts: TS, total: questions.length, correct: questions.filter((q) => q.correct).length,
    attempts: questions.map((q) => ({ id: `${round.id}:${q.id}`, qid: q.id, rev: q.rev, choice: q.choice,
      correct: q.correct, ts: TS, mode: round.attemptMode, ms: q.ms })),
  } };
}
function submitted(round = make()): OfficialRound { return { ...prepare(round), status: 'submitted' }; }
function storeOf(...rounds: OfficialRound[]): OfficialRoundStore { return { version: 1, rounds }; }
let storage: Map<string, string>;
let setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;
let getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>;
beforeEach(() => {
  storage = new Map();
  setItem = vi.fn((key: string, value: string) => { storage.set(key, value); });
  getItem = vi.fn((key: string) => storage.get(key) ?? null);
  vi.stubGlobal('localStorage', { getItem, setItem, removeItem: (key: string) => { storage.delete(key); } });
});
function seed(...rounds: OfficialRound[]): void { storage.set(OFFICIAL_ROUND_KEY, JSON.stringify(storeOf(...rounds))); }
function unchanged(action: () => unknown, conflict = false): void {
  const before = [...storage]; const count = setItem.mock.calls.length;
  if (conflict) expect(action).toThrow(DailyConflictError); else expect(action).toThrow();
  expect([...storage]).toEqual(before); expect(setItem).toHaveBeenCalledTimes(count);
}

describe('輪次驗證規則 1：版本、識別碼、整數與時間', () => {
  it('接受空清單、序號 0、有效範圍與可解析時間', () => {
    expect(isOfficialRoundStore(storeOf())).toBe(true);
    expect(isOfficialRoundStore(storeOf(make(), make({ id: 'other', setId: '114-2-S1', seq: 20, number: 2, position: 1 })))).toBe(true);
  });
  it.each([
    { id: '' }, { id: ' ' }, { seq: -1 }, { seq: 0.5 }, { seq: Number.MAX_SAFE_INTEGER + 1 },
    { number: 0 }, { number: 1.2 }, { position: -1 }, { position: 2 }, { position: 0.1 }, { createdAt: 'invalid' },
  ])('拒絕無效欄位 %j', (overrides) => expect(isOfficialRoundStore(storeOf(make(overrides)))).toBe(false));
  it('拒絕未知版本、重複 ID 與非清單', () => {
    expect(isOfficialRoundStore({ version: 2, rounds: [] })).toBe(false);
    expect(isOfficialRoundStore(storeOf(make(), make({ setId: '114-2-S1' })))).toBe(false);
    expect(isOfficialRoundStore({ version: 1, rounds: {} })).toBe(false);
  });
});

describe('輪次驗證規則 2：題組、科目與作答模式', () => {
  it.each(Object.keys(OFFICIAL_ROUND_SETS))('接受考古題 %s', (setId) => {
    expect(isOfficialRoundStore(storeOf(make({ setId })))).toBe(true);
  });
  it.each([{ setId: 'guide-S3' }, { setId: 'toString' }, { subject: 1 as const }, { attemptMode: 'official:115-1:S3' },
    { attemptMode: 'official-round:other:S3' }])('拒絕題組或模式不符 %j', (overrides) => {
    expect(isOfficialRoundStore(storeOf(make(overrides)))).toBe(false);
  });
});

describe('輪次驗證規則 3：輪次編號與未交卷數量', () => {
  it('同題組容許多輪已交卷與 1 輪未交卷，不同題組可同時未交卷', () => {
    expect(isOfficialRoundStore(storeOf(submitted(), submitted(make({ id: 'two', number: 2 })),
      prepare(make({ id: 'three', number: 3 })), make({ id: 'other', setId: '114-2-S1' })))).toBe(true);
  });
  it('同題組拒絕重複編號', () => {
    expect(isOfficialRoundStore(storeOf(submitted(), submitted(make({ id: 'two' }))))).toBe(false);
  });
  it.each(['open', 'submitting'] as const)('已有 open 時拒絕另 1 輪 %s', (status) => {
    const next = make({ id: 'two', number: 2 });
    expect(isOfficialRoundStore(storeOf(make(), status === 'open' ? next : prepare(next)))).toBe(false);
  });
});

describe('輪次驗證規則 4：題目識別與欄位', () => {
  it('接受原題號不連續與空題輪次', () => {
    expect(isOfficialRoundStore(storeOf(make({ questions: [make().questions[1]] })))).toBe(true);
    expect(isOfficialRoundStore(storeOf(make({ questions: [] })))).toBe(true);
  });
  it.each(['duplicate', 'set', 'suffix', 'legacy', 'rev', 'choice', 'unsure', 'ms', 'count'] as const)('拒絕題目錯誤 %s', (kind) => {
    const round = make();
    if (kind === 'duplicate') round.questions.push(round.questions[0]);
    if (kind === 'set') round.questions[0].id = '114-2-S3-Q01';
    if (kind === 'suffix') round.questions[0].id += 'x';
    if (kind === 'legacy') Object.assign(round.questions[0], { legacyAttemptId: undefined });
    if (kind === 'rev') round.questions[0].rev = 0;
    if (kind === 'choice') Object.assign(round.questions[0], { choice: 'E' });
    if (kind === 'unsure') round.questions[0].unsure = true;
    if (kind === 'ms') round.questions[0].ms = -1;
    if (kind === 'count') round.questions = Array.from({ length: 51 }, (_, i) => ({ ...round.questions[0], id: `115-1-S3-Q${i}` }));
    expect(isOfficialRoundStore(storeOf(round))).toBe(false);
  });
});

describe('輪次驗證規則 5：固定提交與完整成績', () => {
  it.each(['open', 'submitting', 'submitted'] as const)('接受完整 %s', (status) => {
    expect(isOfficialRoundStore(storeOf(status === 'open' ? make() : { ...prepare(make()), status }))).toBe(true);
  });
  it.each(['correct', 'submission'] as const)('open 拒絕欄位 %s', (key) => {
    const round = make();
    if (key === 'correct') Object.assign(round.questions[0], { correct: undefined });
    else Object.assign(round, { submission: undefined });
    expect(isOfficialRoundStore(storeOf(round))).toBe(false);
  });
  it.each(['answer', 'correct', 'submission', 'id', 'total', 'score', 'qid', 'rev', 'mode', 'ms', 'ts', 'count'] as const)
  ('拒絕不完整提交 %s', (kind) => {
    const round = prepare(make()); const submission = round.submission!;
    if (kind === 'answer') round.questions[0].choice = null;
    if (kind === 'correct') delete round.questions[0].correct;
    if (kind === 'submission') delete round.submission;
    if (kind === 'id') submission.attempts[1].id = submission.attempts[0].id;
    if (kind === 'total') submission.total++;
    if (kind === 'score') submission.correct++;
    if (kind === 'qid') submission.attempts[0].qid = round.questions[1].id;
    if (kind === 'rev') submission.attempts[0].rev++;
    if (kind === 'mode') submission.attempts[0].mode = 'quiz';
    if (kind === 'ms') submission.attempts[0].ms++;
    if (kind === 'ts') submission.attempts[0].ts = '2026-11-13T00:00:00Z';
    if (kind === 'count') submission.attempts.pop();
    expect(isOfficialRoundStore(storeOf(round))).toBe(false);
  });
});

describe('讀取與開新輪', () => {
  it('不存在時回空 store，不寫入', () => {
    expect(readOfficialRounds()).toEqual(storeOf()); expect(setItem).not.toHaveBeenCalled();
  });
  it.each(['', '{', '{"version":99,"rounds":[]}', '{"version":1,"rounds":[{}]}'])('損壞資料不覆寫 %s', (raw) => {
    storage.set(OFFICIAL_ROUND_KEY, raw);
    unchanged(() => readOfficialRounds());
    unchanged(() => openOfficialRound('115-1-S3', make().questions, 'new', TS));
  });
  it('作答鍵損壞仍能開，題目依原題號排序，其他題組與舊紀錄不變', () => {
    const other = make({ id: 'other', setId: '114-2-S1' }); seed(submitted(make({ number: 4 })), other);
    storage.set(STORAGE_KEY, 'broken'); const before = JSON.stringify(other);
    const questions = [{ id: '115-1-S3-Q10', rev: 2 }, { id: '115-1-S3-Q02', rev: 1 }];
    const round = openOfficialRound('115-1-S3', questions, 'new', TS);
    expect(round).toMatchObject({ seq: 0, number: 5, position: 0, status: 'open' });
    expect(round.questions.map((q) => q.id)).toEqual(['115-1-S3-Q02', '115-1-S3-Q10']);
    expect(round.questions.every((q) => q.choice === null && q.ms === 0 && !q.unsure)).toBe(true);
    expect(questions[0].id).toBe('115-1-S3-Q10');
    expect(JSON.stringify(readOfficialRounds().rounds[1])).toBe(before);
    expect(storage.get(STORAGE_KEY)).toBe('broken'); expect(getItem.mock.calls.every(([key]) => key === OFFICIAL_ROUND_KEY)).toBe(true);
    unchanged(() => openOfficialRound(round.setId, questions, 'twice', TS), true);
  });
  it.each(['open', 'submitting'] as const)('已有 %s 拒絕開新輪', (status) => {
    seed(status === 'open' ? make() : prepare(make()));
    unchanged(() => openOfficialRound('115-1-S3', make().questions, 'new', TS), true);
  });
  it('不接受指引題、不同考卷題目與重複 ID', () => {
    unchanged(() => openOfficialRound('guide-S3', [], 'new', TS));
    unchanged(() => openOfficialRound('115-1-S1', make().questions, 'new', TS));
    seed(submitted()); unchanged(() => openOfficialRound('115-1-S3', make().questions, 'one', TS));
  });
});

describe('保存與狀態', () => {
  it('每次讀最新 store，只替換目標輪次並加序號', () => {
    const round = make(); const other = make({ id: 'other', setId: '114-2-S1' }); seed(round, other);
    const latest = saveOfficialRound({ ...other, position: 1 }, other);
    const saved = saveOfficialRound({ ...round, questions: round.questions.map((q) => ({ ...q, choice: 'B', ms: 123, unsure: true })) }, round);
    expect(saved.seq).toBe(1); expect(readOfficialRounds()).toEqual(storeOf(saved, latest));
    unchanged(() => saveOfficialRound(round, round), true);
  });
  it.each(['seq', 'candidate-seq', 'id', 'setId', 'deleted', 'cleared'] as const)('舊頁 %s 保存拒絕且不復活輪次', (kind) => {
    const round = make(); seed(round); const expected: OfficialRoundRef = { ...round }; let candidate = round;
    if (kind === 'seq') expected.seq++;
    if (kind === 'candidate-seq') candidate = { ...round, seq: 2 };
    if (kind === 'id') expected.id = 'gone';
    if (kind === 'setId') expected.setId = '114-2-S3';
    if (kind === 'deleted') seed();
    if (kind === 'cleared') clearStudyData();
    unchanged(() => saveOfficialRound(candidate, expected), true);
  });
  it.each(['id', 'setId', 'subject', 'number', 'createdAt', 'attemptMode'] as const)('拒絕固定欄位 %s 變更', (key) => {
    const round = make(); seed(round);
    const value = typeof round[key] === 'number' ? Number(round[key]) + 1 : `${round[key]}-changed`;
    unchanged(() => saveOfficialRound({ ...round, [key]: value }, round), true);
  });
  it('只接受 open 到 submitting 到 submitted，提交內容固定', () => {
    const round = make(); seed(round);
    unchanged(() => saveOfficialRound(submitted(round), round));
    const pending = saveOfficialRound(prepare(round), round);
    unchanged(() => saveOfficialRound({ ...pending, status: 'open', submission: undefined }, pending));
    unchanged(() => saveOfficialRound({ ...pending, position: 1, status: 'submitted' }, pending));
    const done = saveOfficialRound({ ...pending, status: 'submitted' }, pending);
    unchanged(() => saveOfficialRound(done, done));
    unchanged(() => saveOfficialRound({ ...done, questions: done.questions.map((q) => ({ ...q, choice: 'D' })) }, done));
  });
  it('寫入失敗不刪除原資料', () => {
    const round = make(); seed(round); const raw = storage.get(OFFICIAL_ROUND_KEY);
    setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => saveOfficialRound(round, round)).toThrow('quota'); expect(storage.get(OFFICIAL_ROUND_KEY)).toBe(raw);
  });
  it('交卷內容的物件鍵順序不同仍可完成，答案變更則拒絕', () => {
    const pending = prepare(make()); seed(pending);
    const changed = structuredClone(pending); changed.status = 'submitted';
    changed.questions[0].choice = 'D'; changed.submission!.attempts[0].choice = 'D';
    unchanged(() => saveOfficialRound(changed, pending));
    const reordered = Object.fromEntries(Object.entries(pending).reverse()) as unknown as OfficialRound;
    reordered.status = 'submitted';
    reordered.questions = pending.questions.map((q) => ({ correct: q.correct, ms: q.ms, unsure: q.unsure, choice: q.choice, rev: q.rev, id: q.id }));
    expect(saveOfficialRound(reordered, pending).status).toBe('submitted');
  });
});

describe('交卷恢復', () => {
  it.each([1, 2, 3])('第 %i 次寫入中斷，重載後同 ID 完成，不重複作答', (step) => {
    const round = make(); const other = make({ id: 'other', setId: '114-2-S1' }); seed(round, other);
    const prepared = prepare(round); let writes = 0;
    setItem.mockImplementation((key, value) => { if (++writes === step) throw new Error('quota'); storage.set(key, value); });
    const failed = submitOfficialRound(round, prepared);
    expect(failed.error?.message).toBe('quota'); expect(failed.round.status).toBe(step === 1 ? 'open' : 'submitting');
    expect(failed.round).toEqual(readOfficialRounds().rounds[0]);
    expect(getAttempts()).toEqual(step === 3 ? prepared.submission!.attempts : []);
    const restored = readOfficialRounds().rounds[0]; const success = submitOfficialRound(restored, prepared);
    expect(success.error).toBeUndefined(); expect(success.round.status).toBe('submitted');
    expect(getAttempts()).toEqual(prepared.submission!.attempts);
    expect(new Set(getAttempts().map((a) => a.id)).size).toBe(2);
    expect(getAttempts().every((a) => a.mode === 'official-round:one:S3')).toBe(true);
    expect(readOfficialRounds()).toEqual(storeOf(success.round, other));
    const count = setItem.mock.calls.length;
    expect(submitOfficialRound(success.round, prepared).error).toBeUndefined(); expect(setItem).toHaveBeenCalledTimes(count);
  });
  it('submitting 以 store 固定內容續傳，忽略呼叫端改過的副本', () => {
    const pending = prepare(make()); seed(pending);
    const modified = structuredClone(pending); modified.submission!.attempts[0].id = 'tampered';
    const success = submitOfficialRound(modified, make());
    expect(success.error).toBeUndefined(); expect(getAttempts()).toEqual(pending.submission!.attempts);
  });
  it('作答鍵損壞時保留 submitting，修復後沿用提交內容', () => {
    const round = make(); seed(round); storage.set(STORAGE_KEY, '{');
    const prepared = prepare(round); const failed = submitOfficialRound(round, prepared);
    expect(failed.error).toBeInstanceOf(Error); expect(failed.round.status).toBe('submitting'); expect(storage.get(STORAGE_KEY)).toBe('{');
    storage.delete(STORAGE_KEY); const restored = readOfficialRounds().rounds[0];
    expect(submitOfficialRound(restored, restored).error).toBeUndefined(); expect(getAttempts()).toEqual(prepared.submission!.attempts);
  });
  it('全部題目失效、錯誤 prepared 與舊頁不寫作答', () => {
    const round = make({ questions: [] }); seed(round); const before = storage.get(OFFICIAL_ROUND_KEY);
    expect(submitOfficialRound(round, prepare(round)).error).toBeInstanceOf(Error);
    expect(storage.get(OFFICIAL_ROUND_KEY)).toBe(before); expect(getAttempts()).toEqual([]);
    seed(make()); const initial = readOfficialRounds().rounds[0]; const latest = saveOfficialRound(initial, initial);
    expect(submitOfficialRound(initial, prepare(initial)).error).toBeInstanceOf(DailyConflictError);
    expect(submitOfficialRound(latest, latest).error).toBeInstanceOf(Error); expect(getAttempts()).toEqual([]);
  });
  it('已交卷的舊頁或被刪輪次重試不寫入', () => {
    const done = submitted(); seed(done); seed();
    const count = setItem.mock.calls.length;
    expect(submitOfficialRound(done, done).error).toBeInstanceOf(DailyConflictError); expect(setItem).toHaveBeenCalledTimes(count);
  });
});

describe('重新考、備份與清除', () => {
  it('只寫 1 次，沿用最新題目順序與編號，清空全部作答欄位', () => {
    const round = make({ number: 7, position: 1 }); round.questions.reverse();
    round.questions.forEach((q) => { q.choice = 'C'; q.unsure = true; q.ms = 90; });
    const other = submitted(make({ id: 'other', setId: '114-2-S1' })); seed(round, other);
    saveAttemptBatch(other.submission!.attempts); storage.set(BOOKLET_KEY, 'daily-untouched');
    const attempts = storage.get(STORAGE_KEY); const before = JSON.stringify(other); setItem.mockClear(); getItem.mockClear();
    const restarted = restartOfficialRound(round, 'fresh', '2026-11-12T04:00:00Z');
    expect(restarted).toMatchObject({ id: 'fresh', number: 7, seq: 0, position: 0, createdAt: '2026-11-12T04:00:00Z' });
    expect(restarted.attemptMode).toBe('official-round:fresh:S3');
    expect(restarted.questions).toEqual(round.questions.map((q) => ({ id: q.id, rev: q.rev, choice: null, unsure: false, ms: 0 })));
    expect(readOfficialRounds()).toEqual(storeOf(restarted, other));
    expect(JSON.stringify(readOfficialRounds().rounds[1])).toBe(before);
    expect(storage.get(STORAGE_KEY)).toBe(attempts); expect(storage.get(BOOKLET_KEY)).toBe('daily-untouched');
    expect(setItem).toHaveBeenCalledExactlyOnceWith(OFFICIAL_ROUND_KEY, JSON.stringify(storeOf(restarted, other)));
    expect(getItem.mock.calls.every(([key]) => key === OFFICIAL_ROUND_KEY)).toBe(true);
    unchanged(() => saveOfficialRound(round, round), true);
  });
  it.each(['submitting', 'submitted'] as const)('拒絕重新考 %s', (status) => {
    const round = { ...prepare(make()), status }; seed(round);
    unchanged(() => restartOfficialRound(round, 'fresh', TS));
  });
  it('舊序號、輪次不存在、重複 ID 與相同 ID 不改資料', () => {
    const round = make(); const other = make({ id: 'other', setId: '114-2-S1' }); seed(round, other);
    unchanged(() => restartOfficialRound({ ...round, seq: 1 }, 'fresh', TS), true);
    unchanged(() => restartOfficialRound({ ...round, id: 'missing' }, 'fresh', TS), true);
    unchanged(() => restartOfficialRound(round, 'other', TS)); unchanged(() => restartOfficialRound(round, round.id, TS));
  });
  it('重新考採用 store 最新內容，寫入失敗保留舊輪', () => {
    const stale = make(); const latest = make({ questions: [make().questions[1]] }); seed(latest);
    const raw = storage.get(OFFICIAL_ROUND_KEY); setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => restartOfficialRound(stale, 'fresh', TS)).toThrow('quota'); expect(storage.get(OFFICIAL_ROUND_KEY)).toBe(raw);
    expect(restartOfficialRound(stale, 'fresh', TS).questions.map((q) => q.id)).toEqual(['115-1-S3-Q02']);
  });
  it('匯入只補作答，不建立輪次，也不改現有輪次；備份不含輪次', () => {
    const backup = { version: 1, attempts: submitted().submission!.attempts };
    expect(importAttempts(JSON.stringify(backup))).toEqual({ added: 2, skipped: 0, invalid: 0 });
    expect(storage.has(OFFICIAL_ROUND_KEY)).toBe(false); expect(getAttempts()).toEqual(backup.attempts);
    seed(make()); const raw = storage.get(OFFICIAL_ROUND_KEY);
    expect(importAttempts(JSON.stringify(backup))).toEqual({ added: 0, skipped: 2, invalid: 0 });
    expect(storage.get(OFFICIAL_ROUND_KEY)).toBe(raw);
    expect(Object.keys(JSON.parse(exportAttempts()))).toEqual(['version', 'attempts', 'readings']);
  });
  it('清除全部 6 個鍵，保留其他資料', () => {
    const keys = [OFFICIAL_ROUND_KEY, BOOKLET_KEY, DRAFT_KEY, STORAGE_KEY, 'ipas-reading-v1', 'ipas-daily-v1'];
    keys.forEach((key) => storage.set(key, 'data')); storage.set('other', 'keep'); clearStudyData();
    expect([...storage]).toEqual([['other', 'keep']]);
  });
});

describe('合成容量實測', () => {
  it('50 輪各 50 題與固定作答，記錄字元數與連續保存時間', () => {
    const rounds = Array.from({ length: 50 }, (_, i) => {
      const round = make({ id: `capacity-${i}`, number: i + 1 });
      round.questions = Array.from({ length: 50 }, (_, n) => ({ id: `115-1-S3-Q${String(n + 1).padStart(2, '0')}`, rev: 1,
        choice: null, unsure: false, ms: 1234 }));
      return submitted(round);
    });
    const store = storeOf(...rounds); expect(isOfficialRoundStore(store)).toBe(true);
    const attempts: Attempt[] = rounds.flatMap((round) => round.submission!.attempts);
    expect(attempts).toHaveLength(2500);
    const roundChars = JSON.stringify(store).length; const attemptChars = JSON.stringify({ version: 1, attempts }).length;
    seed(...rounds); saveAttemptBatch(attempts);
    // 計時保留 49 輪完整歷史，將第 50 輪設為作答中以量測正常保存。
    let active = make({ ...rounds[49], status: 'open', submission: undefined,
      questions: rounds[49].questions.map((q) => ({ id: q.id, rev: q.rev, choice: q.choice, unsure: q.unsure, ms: q.ms })) });
    delete active.submission; seed(...rounds.slice(0, 49), active); setItem.mockClear();
    const start = performance.now();
    for (let i = 0; i < 50; i++) active = saveOfficialRound(active, active);
    const elapsed = performance.now() - start;
    expect(active.seq).toBe(50); expect(setItem).toHaveBeenCalledTimes(50);
    console.log(`容量實測：50 輪 × 50 題；輪次 ${roundChars} 字元；作答 ${attemptChars} 字元；合計 ${roundChars + attemptChars} 字元；Node 連續保存 50 次 ${elapsed.toFixed(3)} ms`);
  });
});
