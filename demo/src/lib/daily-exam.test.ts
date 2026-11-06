/** 每日狀態與持久化的正反例，特別驗證交卷每一步失敗後沿用同一批 ID。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStudyData, DailyConflictError, DRAFT_KEY, exportAttempts, getAttempts, getDailyDrafts, getWrongBook, importAttempts, isDailyDraft, saveAttemptBatch, saveDailyDraft, submitDailyDraft, type Attempt, type DailyDraft, type DailySet } from './attempts';
import { availableDailyQuestion, canOpenToday, createDailyDraft, dailyCounts, dailyNext, dailyNumbers, dailyNumberState, dailyPosition, dailySource, prepareDailySubmission, reconcileDailyDraft } from './daily-exam';
import { unseenDailyQuestions } from './daily';
const set: DailySet = { date: '2026-11-05', subject: 1, questions: Array.from({ length: 5 }, (_, index) => ({ id: `q${index}`, rev: 2 })) };
const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({ id: 'old', qid: 'q0', rev: 2, choice: 'A', correct: true, ts: '2026-11-05T03:00:00Z', mode: 'daily:2026-11-05:S1', ms: 200, ...overrides });
const make = () => createDailyDraft(set, [], false, 'draft1');
const catalog = set.questions.map((q) => ({ ...q, subject: 1, source: 'mock', codes: ['L21101'], type: '情境', review: { status: 'verified' } }));
const complete = (): DailyDraft => ({ ...make(), questions: make().questions.map((q) => ({ ...q, choice: 'A' as const, ms: 321 })) });
const prepare = (draft: DailyDraft) => prepareDailySubmission(draft, new Map(set.questions.map((q) => [q.id, 'A'])), '2026-11-06T03:00:00Z', () => crypto.randomUUID());
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
});
describe('草稿驗證及隔離', () => {
  it('接受 0、1、5、50 題；拒絕超過 50 題', () => {
    for (const count of [0, 1, 5, 50]) expect(isDailyDraft({ ...make(), questions: Array.from({ length: count }, (_, i) => ({ ...make().questions[0], id: String(i) })) })).toBe(true);
    expect(isDailyDraft({ ...make(), questions: Array.from({ length: 51 }, (_, i) => ({ ...make().questions[0], id: String(i) })) })).toBe(false);
  });
  it.each([
    { id: '' }, { seq: -1 }, { seq: 1.5 }, { subject: '1' }, { date: 'unknown' }, { status: 'unknown' }, { position: -1 }, { position: 5 },
    { questions: [{ id: 'q0', rev: 0, choice: null, unsure: false, ms: 0 }] },
    { questions: [{ id: 'q0', rev: 2, choice: null, unsure: true, ms: 0 }] },
    { questions: [{ id: 'q0', rev: 2, choice: 'E', unsure: false, ms: 0 }] },
    { questions: [{ id: 'q0', rev: 2, choice: 'A', unsure: false, ms: -1 }] },
    { questions: [{ id: 'q0', rev: 2, choice: 'A', unsure: false, ms: 0, legacyAttemptId: 'old' }] },
    { questions: [make().questions[0], make().questions[0]] },
    { submission: { ts: 'bad' } }, { status: 'submitted' },
  ])('無效草稿不覆寫：%j', (invalid) => {
    const saved = saveDailyDraft(make(), null); const before = storage.get(DRAFT_KEY);
    expect(() => saveDailyDraft({ ...saved, ...invalid } as DailyDraft, saved)).toThrow(); expect(storage.get(DRAFT_KEY)).toBe(before);
  });
  it.each(['{', '{"version":9,"drafts":[]}', '{"version":1,"drafts":[{}]}'])('未知或損壞資料保持位元不變：%s', (raw) => {
    storage.set(DRAFT_KEY, raw); expect(() => getDailyDrafts()).toThrow('保留原資料'); expect(() => saveDailyDraft(make(), null)).toThrow(); expect(storage.get(DRAFT_KEY)).toBe(raw);
  });
  it('同科不可重複；改另一科後依最新內容合併', () => {
    const one = saveDailyDraft(make(), null); const three = saveDailyDraft({ ...make(), subject: 3, id: 'three' }, null);
    saveDailyDraft({ ...three, position: 2 }, three); saveDailyDraft({ ...one, position: 1 }, one);
    expect(getDailyDrafts().find((d) => d.subject === 3)?.position).toBe(2);
    const raw = JSON.stringify({ version: 1, drafts: [one, one] }); storage.set(DRAFT_KEY, raw); expect(() => getDailyDrafts()).toThrow();
  });
  it('寫入比對 id 與 seq；清除後重建同 seq 仍拒絕舊頁', () => {
    const original = saveDailyDraft(make(), null); const updated = saveDailyDraft({ ...original, position: 1 }, original);
    expect(() => saveDailyDraft(original, original)).toThrow(DailyConflictError);
    clearStudyData(); expect(() => saveDailyDraft(updated, updated)).toThrow(DailyConflictError);
    saveDailyDraft({ ...make(), id: 'replacement' }, null); expect(() => saveDailyDraft(original, original)).toThrow(DailyConflictError);
  });
  it('草稿不改作答、錯題、未做題、備份；清除時一起移除', () => {
    const before = exportAttempts(); const unseen = unseenDailyQuestions(catalog, [], 1);
    saveDailyDraft(complete(), null); expect(getAttempts()).toEqual([]); expect(getWrongBook()).toEqual([]);
    expect(exportAttempts()).toBe(before); expect(unseenDailyQuestions(catalog, getAttempts(), 1)).toEqual(unseen);
    const draftRaw = storage.get(DRAFT_KEY); importAttempts(JSON.stringify({ version: 1, attempts: [attempt()] })); expect(storage.get(DRAFT_KEY)).toBe(draftRaw);
    expect(getDailyDrafts()[0].status).toBe('open'); clearStudyData(); expect(storage.has(DRAFT_KEY)).toBe(false);
  });
});
describe('還原、舊作答與順序', () => {
  it('所有草稿狀態都優先於今日題組，否則先舊快取再抽新題', () => {
    for (const status of ['open', 'submitting', 'submitted'] as const) expect(dailySource({ ...make(), status }, { ...set, date: '2026-11-06' })).toBe('draft');
    expect(dailySource(undefined, set)).toBe('legacy'); expect(dailySource(undefined, undefined)).toBe('new');
  });
  it('只掃描完全相同 mode、qid、rev 的最新紀錄；不連續的題保留', () => {
    const records = [attempt(), attempt({ id: 'new', choice: 'B', ts: '2026-11-05T04:00:00Z' }), attempt({ id: 'other-mode', qid: 'q1', mode: 'quiz' }), attempt({ id: 'other-rev', qid: 'q2', rev: 1 }), attempt({ id: 'q4', qid: 'q4' })];
    const draft = createDailyDraft(set, records, true, 'legacy');
    expect(draft.questions.map((q) => q.choice)).toEqual(['B', null, null, null, 'A']); expect(draft.questions[0].legacyAttemptId).toBe('new'); expect(draft.position).toBe(1);
    expect(dailyNumbers(draft)).toEqual([0, 1, 4]); expect(dailyNext(draft, 4)).toBe(4);
    expect(createDailyDraft(set, records, false, 'fresh').questions.every((q) => !q.legacyAttemptId)).toBe(true);
  });
  it('空草稿視同沒有草稿；空快取不阻擋重新抽題', () => {
    const empty = { ...make(), questions: [] };
    expect(dailySource(empty, set)).toBe('legacy');
    expect(dailySource(empty, { ...set, questions: [] })).toBe('new');
    expect(dailySource(empty, undefined)).toBe('new');
  });
  it('全部移除或改版的 open 草稿才可提前開今日題組', () => {
    for (const changed of [[], catalog.map((q) => ({ ...q, rev: 99 }))]) {
      expect(canOpenToday(make(), changed, set.date)).toBe(true);
      expect(() => prepare(reconcileDailyDraft(complete(), changed).draft)).toThrow();
    }
    expect(canOpenToday(make(), catalog.slice(0, 1), '2026-11-06')).toBe(false);
    expect(canOpenToday({ ...make(), questions: [] }, catalog, set.date)).toBe(false);
    expect(canOpenToday(prepare(complete()), [], '2026-11-06')).toBe(false);
    const submitted = { ...prepare(complete()), status: 'submitted' as const };
    expect(canOpenToday(submitted, [], set.date)).toBe(false);
    expect(canOpenToday(submitted, catalog, '2026-11-06')).toBe(true);
  });
  it('未答不可前進；已答、不確定、交卷結果與不可用狀態優先序', () => {
    const draft = make(); expect(dailyNumbers(draft)).toEqual([0]); expect(dailyNext(draft, 0)).toBe(0); expect(dailyPosition(draft, 4)).toBe(0);
    draft.questions[0].choice = 'A'; expect(dailyNumbers(draft)).toEqual([0, 1]); expect(dailyNumberState(draft, 0)).toBe('answered'); expect(dailyNext(draft, 0)).toBe(1);
    draft.questions[0].unsure = true; expect(dailyNumberState(draft, 0)).toBe('unsure'); expect(dailyCounts(draft)).toEqual({ total: 5, answered: 1, unsure: 1 });
    const submitted = { ...prepare(complete()), status: 'submitted' as const }; expect(dailyNumbers(submitted)).toEqual([0, 1, 2, 3, 4]);
    expect(dailyNumberState(submitted, 0)).toBe('correct'); submitted.questions[0].correct = false; expect(dailyNumberState(submitted, 0)).toBe('wrong'); expect(dailyNumberState(submitted, 0, false)).toBe('unavailable');
  });
  it('網址位置、草稿位置、第 1 個未答題依序回退；下一題不跨未答空隙', () => {
    const draft = complete(); draft.questions[1].choice = null; draft.questions[2].choice = null; draft.position = 4;
    expect(dailyPosition(draft, 1)).toBe(1); expect(dailyPosition(draft, 2)).toBe(4); expect(dailyNext(draft, 0)).toBe(1);
    draft.position = 2; expect(dailyPosition(draft, 99)).toBe(1);
    draft.questions[0].choice = null; draft.questions[1].choice = 'A'; expect(dailyNext(draft, 1)).toBe(0);
  });
  it('交卷前移除改版題不補題；交卷後維持快照', () => {
    const changed = catalog.map((q, i) => i === 1 ? { ...q, rev: 99 } : q).slice(1);
    expect(availableDailyQuestion(set.questions[0], changed, 1)).toBe(false);
    const resolved = reconcileDailyDraft(make(), changed); expect(resolved.skipped).toBe(2); expect(resolved.draft.questions).toHaveLength(3);
    const submitted = { ...prepare(complete()), status: 'submitted' as const }; expect(reconcileDailyDraft(submitted, []).draft).toEqual(submitted);
  });
  it('不允許空題組或未答完交卷', () => { expect(() => prepare(make())).toThrow(); expect(() => prepare({ ...make(), questions: [] })).toThrow(); });
});
describe('整批交卷與逐步故障', () => {
  it.each([1, 2, 3])('第 %i 步寫入失敗，重試筆數與 ID 不變', (step) => {
    let draft = saveDailyDraft(complete(), null); const prepared = prepare(draft);
    const old = attempt({ id: 'unrelated', qid: 'other' }); saveAttemptBatch([old]);
    const before = storage.get('ipas-attempts-v1'); let writes = 0;
    localStorage.setItem = (key, raw) => { writes++; if (writes === step) throw new Error('quota'); storage.set(key, raw); };
    const failed = submitDailyDraft(draft, prepared); expect(failed.error?.message).toBe('quota');
    if (step < 3) expect(storage.get('ipas-attempts-v1')).toBe(before);
    else expect(getAttempts()).toHaveLength(6);
    draft = failed.draft;
    const success = submitDailyDraft(draft, prepared); expect(success.error).toBeUndefined(); expect(success.draft.status).toBe('submitted');
    expect(getAttempts().map((a) => a.id)).toEqual([old.id, ...prepared.submission!.attempts.map((a) => a.id)]);
    expect(getAttempts()).toHaveLength(6); expect(submitDailyDraft(success.draft, prepared).error).toBeUndefined(); expect(getAttempts()).toHaveLength(6);
    expect(getAttempts()[0]).toEqual(old); expect(getAttempts().slice(1).every((a) => a.ts === '2026-11-06T03:00:00Z' && a.mode === 'daily:2026-11-05:S1' && a.ms === 321)).toBe(true);
  });
  it('submitting 重載後沿用固定提交 ID，不依現在日期或匯入紀錄重建', () => {
    const original = saveDailyDraft(complete(), null); const prepared = prepare(original);
    const pending = saveDailyDraft(prepared, original); saveAttemptBatch(pending.submission!.attempts);
    const restored = getDailyDrafts()[0]; const result = submitDailyDraft(restored, restored);
    expect(result.draft.status).toBe('submitted'); expect(getAttempts()).toEqual(prepared.submission!.attempts);
  });
  it('沿用舊作答 2 題只新增 3 筆，原始紀錄不變', () => {
    const records = [attempt(), attempt({ id: 'legacy4', qid: 'q4', correct: false })]; saveAttemptBatch(records);
    const legacy = createDailyDraft(set, records, true, 'legacy'); legacy.questions.forEach((q) => { q.choice ??= 'A'; });
    const draft = saveDailyDraft(legacy, null); const prepared = prepare(draft); const result = submitDailyDraft(draft, prepared);
    expect(result.draft.submission?.correct).toBe(4); expect(result.draft.submission?.attempts).toHaveLength(3); expect(getAttempts().slice(0, 2)).toEqual(records); expect(getAttempts()).toHaveLength(5);
  });
  it('整批驗證有 1 筆無效就完全不寫，ID 碰撞也保留原作答', () => {
    saveAttemptBatch([attempt()]); const before = storage.get('ipas-attempts-v1');
    expect(() => saveAttemptBatch([attempt({ id: 'valid' }), attempt({ id: 'bad', ms: -1 })])).toThrow(); expect(storage.get('ipas-attempts-v1')).toBe(before);
    expect(() => saveAttemptBatch([attempt({ choice: 'B' })])).toThrow('衝突'); expect(storage.get('ipas-attempts-v1')).toBe(before);
  });
  it('提交快照欄位不一致一律拒絕，不能提早顯示成功', () => {
    const draft = saveDailyDraft(complete(), null); const prepared = prepare(draft);
    for (const field of ['total', 'correct'] as const) expect(isDailyDraft({ ...prepared, submission: { ...prepared.submission!, [field]: 99 } })).toBe(false);
    prepared.submission!.attempts[0].mode = 'daily:today:S3'; expect(submitDailyDraft(draft, prepared).error).toBeDefined(); expect(getAttempts()).toEqual([]);
  });
});
