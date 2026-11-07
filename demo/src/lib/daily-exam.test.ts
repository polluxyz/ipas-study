/** 每日狀態與持久化的正反例，特別驗證交卷每一步失敗後沿用同一批 ID。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStudyData, DailyConflictError, DRAFT_KEY, exportAttempts, getAttempts, getDailyDrafts, getWrongBook, importAttempts, isDailyDraft, saveAttemptBatch, saveDailyDraft, submitDailyDraft, type Attempt, type DailyDraft, type DailySet } from './attempts';
import { availableDailyQuestion, availableDailySet, canOpenToday, createDailyDraft, dailyCounts, dailyNext, dailyNumbers, dailyNumberState, dailyPosition, dailySource, dailySubjectStatus, prepareDailySubmission, reconcileDailyDraft } from './daily-exam';
import { unseenDailyQuestions } from './daily';
import { isBooklet, type Booklet, type BookletStore } from './attempts';
import { bookletAttemptMode, bookletExclusions, bookletNeedsRetire, bookletOpenLabel, bookletPageState, bookletPartialNote, bookletProgramNotice, bookletProgress, bookletRows, createBooklet, legacyRecords, prepareBookletSubmission, reconcileBooklet } from './daily-exam';
import { eligibleDailyQuestions, type DailyQuestion } from './daily';
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
describe('科目卡狀態', () => {
  it('沒有草稿時尚未開啟', () => {
    expect(dailySubjectStatus(undefined, catalog, 1)).toBe('尚未開啟');
  });
  it('空題目清單優先顯示沒有可作答題', () => {
    for (const status of ['open', 'submitting', 'submitted'] as const) {
      expect(dailySubjectStatus({ ...make(), status, questions: [] }, catalog, 1)).toBe('沒有可作答題');
    }
  });
  it('已交卷顯示草稿的已答數與總題數', () => {
    const submitted = { ...prepare(complete()), status: 'submitted' as const };
    expect(dailySubjectStatus(submitted, catalog, 1)).toBe('已交卷・已答 5／5');
  });
  it('未交卷且全部失效時需換題', () => {
    for (const status of ['open', 'submitting'] as const) {
      for (const changed of [[], catalog.map((q) => ({ ...q, rev: 99 })), catalog.map((q) => ({ ...q, subject: 3 })), catalog.map((q) => ({ ...q, source: 'official' })), catalog.map((q) => ({ ...q, review: { status: 'draft' } }))]) {
        expect(dailySubjectStatus({ ...complete(), status }, changed, 1)).toBe('題目已失效・需換題');
      }
      expect(dailySubjectStatus({ ...complete(), status }, catalog, 3)).toBe('題目已失效・需換題');
    }
  });
  it('有效且未交卷時顯示作答中', () => {
    const draft = make(); draft.questions[0].choice = 'A';
    for (const status of ['open', 'submitting'] as const) {
      expect(dailySubjectStatus({ ...draft, status }, catalog, 1)).toBe('作答中・已答 1／5');
    }
  });
  it('部分有效的 open 草稿仍是作答中，計數保留草稿定義', () => {
    const draft = make(); draft.questions[0].choice = 'A';
    expect(dailySubjectStatus(draft, catalog.slice(1), 1)).toBe('作答中・已答 1／5');
  });
  it('全部失效但已交卷仍是已交卷', () => {
    const submitted = { ...prepare(complete()), status: 'submitted' as const };
    for (const changed of [[], catalog.map((q) => ({ ...q, rev: 99 }))]) {
      expect(dailySubjectStatus(submitted, changed, 1)).toBe('已交卷・已答 5／5');
    }
  });
});

describe('今日快取有效性', () => {
  it('全部失效的快取視同不存在，無草稿或空草稿都重新抽題', () => {
    for (const changed of [[], catalog.map((q) => ({ ...q, rev: 99 })), catalog.map((q) => ({ ...q, subject: 3 })), catalog.map((q) => ({ ...q, source: 'official' })), catalog.map((q) => ({ ...q, review: { status: 'draft' } }))]) {
      const todaySet = availableDailySet(set, [{ ...catalog[0], id: 'fresh' }, ...changed]);
      expect(todaySet).toBeUndefined();
      expect(dailySource(undefined, todaySet)).toBe('new');
      expect(dailySource({ ...make(), questions: [] }, todaySet)).toBe('new');
    }
  });
  it('部分有效的快取保留同日題目順序，N 扣除失效題且不補題', () => {
    const changed = catalog.map((q, i) => i === 1 ? { ...q, rev: 99 } : q).slice(1);
    const todaySet = availableDailySet(set, changed);
    expect(todaySet).toBe(set);
    expect(todaySet?.questions).toEqual(set.questions);
    expect(dailySource(undefined, todaySet)).toBe('legacy');
    const restored = reconcileDailyDraft(createDailyDraft(todaySet!, [], true, 'partial'), changed);
    expect(restored.skipped).toBe(2);
    expect(restored.draft.questions.map((q) => q.id)).toEqual(['q2', 'q3', 'q4']);
    expect(dailyCounts(restored.draft).total).toBe(3);
  });
  it('全部有效的快取保留原題組', () => {
    expect(availableDailySet(set, catalog)).toBe(set);
  });
  it('空快取視同不存在', () => {
    expect(availableDailySet({ ...set, questions: [] }, catalog)).toBeUndefined();
  });
  it('沒有快取時維持不存在', () => {
    expect(availableDailySet(undefined, catalog)).toBeUndefined();
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

// 題本資料直接給固定值，預期計數不借用被測函式計算。
const bookletStore = (booklets: Booklet[] = [], current: BookletStore['current'] = { '1': null, '3': null }): BookletStore =>
  ({ version: 2, migratedAt: null, current, booklets });
const makeBooklet = (overrides: Partial<Booklet> = {}): Booklet => ({
  id: 'book1', seq: 1, subject: 1, number: 1, createdDate: '2026-11-05', attemptMode: 'booklet:book1:S1', origin: 'new', status: 'open', position: 0,
  assignedQids: ['q0', 'q1', 'q2', 'q3', 'q4'], questions: set.questions.map((q) => ({ ...q, choice: null, unsure: false, ms: 0 })), ...overrides,
});
const answeredBooklet = (overrides: Partial<Booklet> = {}): Booklet => makeBooklet({
  questions: set.questions.map((q) => ({ ...q, choice: 'A', unsure: false, ms: 321 })), ...overrides,
});

describe('不足 50 題的題本說明', () => {
  it.each([
    { total: 0, assigned: 0, note: null },
    { total: 50, assigned: 50, note: null },
    { total: 41, assigned: 41, note: '本題本共 41 題。未做題不足 50 題，不換算正式模擬卷分數。' },
    { total: 49, assigned: 50, note: '本題本共 49 題。部分題目已略過，不補題，不換算正式模擬卷分數。' },
  ])('$total 題、原分配 $assigned 題', ({ total, assigned, note }) => {
    const questions = Array.from({ length: total }, (_, i) => ({ ...makeBooklet().questions[0], id: `q${i}` }));
    const assignedQids = Array.from({ length: assigned }, (_, i) => `q${i}`);
    expect(bookletPartialNote(makeBooklet({ questions, assignedQids }))).toBe(note);
  });
});
const bookletAnswers = new Map([['q0', 'A'], ['q1', 'A'], ['q2', 'A'], ['q3', 'A'], ['q4', 'A']]);
const submitBookletForTest = (booklet = answeredBooklet(), ts = '2026-11-06T03:00:00Z'): Booklet => {
  let id = 0;
  return { ...prepareBookletSubmission(booklet, bookletAnswers, ts, () => `${booklet.id}-a${++id}`), status: 'submitted' };
};

describe('作答不可讀時的題本狀態', () => {
  it.each([
    { free: 41, kind: 'first', next: 41, label: '開第 1 本（41 題）' },
    { free: 0, kind: 'exhausted', next: 0, label: null },
    { free: null, kind: 'blocked', next: null, label: null },
  ])('空白科目：剩餘 $free 題決定是否能開本', ({ free, kind, next, label }) => {
    const state = bookletPageState(bookletStore(), 1, free, catalog);
    expect(state.kind).toBe(kind);
    expect(bookletOpenLabel(false, 'next' in state ? state.next : next)).toBe(label);
    expect(state.kind === 'exhausted').toBe(free === 0);
  });
  it.each([41, 0, null])('已交卷：剩餘 %s 題仍可檢討，只有已知正數能開本', (free) => {
    const book = submitBookletForTest();
    expect(bookletPageState(bookletStore([book]), 1, free, catalog)).toEqual({ kind: 'review', booklet: book, next: free });
    expect(bookletOpenLabel(true, free)).toBe(free === 41 ? '開下一本（41 題）' : null);
  });
  it('無法讀取作答仍接續未交卷題本，失效題本仍可結束', () => {
    const book = makeBooklet();
    const store = bookletStore([book], { '1': book.id, '3': null });
    expect(bookletPageState(store, 1, null, catalog)).toEqual({ kind: 'resume', booklet: book });
    expect(bookletPageState(store, 1, null, [])).toEqual({ kind: 'retire', booklet: book });
    expect(bookletPageState(store, 3, null, catalog)).toEqual({ kind: 'blocked' });
  });
  it.each([
    { free: { fullBooks: 3, lastBook: 41 }, fullBooks: 3, lastBook: 41 },
    { free: { fullBooks: 0, lastBook: 0 }, fullBooks: 0, lastBook: 0 },
    { free: null, fullBooks: null, lastBook: null },
  ])('可再開 $fullBooks 本與今日交卷分開計算', ({ free, fullBooks, lastBook }) => {
    const submitted = submitBookletForTest();
    const open = makeBooklet({ id: 'next', number: 2 }); open.questions[0].choice = 'A';
    const store = bookletStore([submitted, open], { '1': open.id, '3': null });
    expect(bookletProgress(store, 1, '2026-11-06', free)).toEqual({ answered: 1, total: 5, todaySubmitted: 5, fullBooks, lastBook });
    expect(bookletProgress(store, 3, '2026-11-06', free).todaySubmitted).toBe(0);
  });
});

describe('題本建立與抽題排除', () => {
  it('新科從第 1 本開始，分配順序與版本照 selected 保留', () => {
    const selected = [{ id: 'q4', rev: 2 }, { id: 'q0', rev: 2 }];
    const built = createBooklet({ store: bookletStore(), subject: 1, date: '2026-11-07', id: 'fresh', selected });
    expect(built).toEqual({ id: 'fresh', subject: 1, number: 1, createdDate: '2026-11-07', attemptMode: 'booklet:fresh:S1', origin: 'new', status: 'open', position: 0,
      assignedQids: ['q4', 'q0'], questions: [{ id: 'q4', rev: 2, choice: null, unsure: false, ms: 0 }, { id: 'q0', rev: 2, choice: null, unsure: false, ms: 0 }] });
    expect(isBooklet({ ...built, seq: 1 })).toBe(true);
    expect(bookletAttemptMode('fresh', 3)).toBe('booklet:fresh:S3');
    selected[0].id = 'changed';
    expect(built.assignedQids).toEqual(['q4', 'q0']);
    expect(built.questions[0].id).toBe('q4');
  });
  it('編號取同科最大值加 1，忽略陣列順序與其他科編號', () => {
    const store = bookletStore([makeBooklet({ id: 'b7', number: 7, status: 'retired' }), makeBooklet({ id: 's3', subject: 3, number: 20 }), makeBooklet({ number: 2 })]);
    const input = { store, date: '2026-11-07', id: 'fresh', selected: [{ id: 'q0', rev: 2 }] };
    expect(createBooklet({ ...input, subject: 1 }).number).toBe(8);
    expect(createBooklet({ ...input, subject: 3 }).number).toBe(21);
    expect(createBooklet({ ...input, store: bookletStore([makeBooklet()]), subject: 3 }).number).toBe(1);
    expect(isBooklet({ ...createBooklet({ ...input, subject: 3 }), seq: 1 })).toBe(true);
  });
  it('排除全部題本的原分配，包含他科、未交卷與已結束的失效題', () => {
    const store = bookletStore([
      makeBooklet({ assignedQids: ['q0', 'skipped'], questions: [] }),
      makeBooklet({ id: 'other', subject: 3, assignedQids: ['q1'] }),
      makeBooklet({ id: 'retired', status: 'retired', assignedQids: ['q2', 'q0'] }),
      submitBookletForTest(makeBooklet({ id: 'submitted', questions: [{ id: 'q3', rev: 2, choice: 'A', unsure: false, ms: 0 }], assignedQids: ['q3'] })),
    ]);
    const groups = [['q1', 'q4']];
    const exclusions = bookletExclusions(store, groups);
    expect([...exclusions.assignedQids]).toEqual(['q0', 'skipped', 'q1', 'q2', 'q3']);
    expect(exclusions.groups).toBe(groups);
    expect(eligibleDailyQuestions([...catalog, { ...catalog[0], id: 'fresh' }], [], 1, exclusions).map((q) => q.id)).toEqual(['fresh']);
  });
});

describe('題本失效與位置', () => {
  it('略過改版、爭議、移除與官方題，不改原分配清單', () => {
    const book = makeBooklet(); const before = structuredClone(book);
    const changed = [catalog[4], { ...catalog[0], rev: 3 }, { ...catalog[1], review: { status: 'disputed' } }, { ...catalog[3], source: 'exam' }];
    const result = reconcileBooklet(book, changed);
    expect(result.skipped).toBe(4);
    expect(result.booklet.questions.map((q) => q.id)).toEqual(['q4']);
    expect(result.booklet.assignedQids).toEqual(['q0', 'q1', 'q2', 'q3', 'q4']);
    expect(book).toEqual(before);
    expect(eligibleDailyQuestions(catalog, [], 1, bookletExclusions(bookletStore([result.booklet]), []) )).toEqual([]);
  });
  it('原題仍有效時，位置跟著原題', () => {
    expect(reconcileBooklet(makeBooklet({ position: 3 }), catalog.slice(2)).booklet.position).toBe(1);
  });
  it('原題失效時，指向後面第 1 個留下的題', () => {
    const result = reconcileBooklet(makeBooklet({ position: 1 }), [catalog[0], catalog[3], catalog[4]]);
    expect(result.booklet.position).toBe(1);
    expect(result.booklet.questions[1].id).toBe('q3');
  });
  it('原題後面沒有題時指向最後 1 題，全部失效時位置是 0', () => {
    expect(reconcileBooklet(makeBooklet({ position: 4 }), catalog.slice(0, 2)).booklet.position).toBe(1);
    const empty = reconcileBooklet(makeBooklet({ position: 4 }), []);
    expect(empty.booklet.position).toBe(0); expect(empty.skipped).toBe(5);
  });
  it.each(['submitting', 'submitted', 'retired'] as const)('%s 不略過題目也不改物件', (status) => {
    const book = { ...submitBookletForTest(), status };
    const result = reconcileBooklet(book, []);
    expect(result.booklet).toBe(book); expect(result.skipped).toBe(0);
    expect(bookletNeedsRetire(book, [])).toBe(false);
  });
  it('僅 open 且沒有可作答題需要結束，部分有效仍可作答', () => {
    expect(bookletNeedsRetire(makeBooklet(), [])).toBe(true);
    expect(bookletNeedsRetire(makeBooklet({ questions: [] }), catalog)).toBe(true);
    expect(bookletNeedsRetire(makeBooklet(), catalog.slice(4))).toBe(false);
  });
});

describe('題本交卷', () => {
  it.each([
    { origin: 'new', attemptMode: 'booklet:book1:S1' },
    { origin: 'v1-set', attemptMode: 'daily:2026-11-05:S1' },
  ] as const)('$origin 使用固定的 attemptMode，不新增鎖定作答', (identity) => {
    const book = answeredBooklet(identity);
    book.questions[0] = { ...book.questions[0], legacyAttemptId: 'locked', correct: false };
    book.questions[2].choice = 'B';
    const before = structuredClone(book); let sequence = 0; const id = vi.fn(() => `new-id-${++sequence}`);
    const prepared = prepareBookletSubmission(book, bookletAnswers, '2026-11-07T00:00:00Z', id);
    expect(prepared.status).toBe('submitting'); expect(prepared.submission?.total).toBe(5); expect(prepared.submission?.correct).toBe(3);
    expect(prepared.submission?.attempts.map((a) => a.qid)).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(prepared.submission?.attempts.map((a) => a.mode)).toEqual([identity.attemptMode, identity.attemptMode, identity.attemptMode, identity.attemptMode]);
    expect(prepared.submission?.attempts[1]).toEqual({ id: 'new-id-2', qid: 'q2', rev: 2, choice: 'B', correct: false, ts: '2026-11-07T00:00:00Z', mode: identity.attemptMode, ms: 321 });
    expect(id).toHaveBeenCalledTimes(4); expect(book).toEqual(before); expect(isBooklet(prepared)).toBe(true);
  });
  it('全是鎖定作答時仍可交卷，作答陣列為空', () => {
    const book = answeredBooklet(); book.questions.forEach((q) => { q.legacyAttemptId = `old-${q.id}`; q.correct = true; });
    const id = vi.fn(() => 'unused'); const prepared = prepareBookletSubmission(book, bookletAnswers, '2026-11-07T00:00:00Z', id);
    expect(prepared.submission).toEqual({ ts: '2026-11-07T00:00:00Z', attempts: [], total: 5, correct: 5 });
    expect(isBooklet(prepared)).toBe(true); expect(id).not.toHaveBeenCalled();
  });
  it('未答完、缺答案、0 題與非 open 都拒絕，且不產生 ID', () => {
    const id = vi.fn(() => 'unused');
    for (const book of [makeBooklet(), makeBooklet({ questions: [] }), answeredBooklet({ status: 'retired' }), submitBookletForTest(), { ...submitBookletForTest(), status: 'submitting' as const }]) {
      expect(() => prepareBookletSubmission(book, bookletAnswers, '2026-11-07T00:00:00Z', id)).toThrow('全部有效題目作答後才能交卷');
    }
    expect(() => prepareBookletSubmission(answeredBooklet(), new Map(), '2026-11-07T00:00:00Z', id)).toThrow();
    expect(id).not.toHaveBeenCalled();
  });
});

describe('題本科目畫面與開本文字', () => {
  it('有目前題本時 resume，不改答案、標記、位置與用時', () => {
    const book = answeredBooklet({ position: 3 }); book.questions[2].unsure = true;
    expect(bookletPageState(bookletStore([book], { '1': book.id, '3': null }), 1, 100, catalog)).toEqual({ kind: 'resume', booklet: book });
  });
  it('current 指向的題全部失效時 retire，不跳到後面的有效題本', () => {
    const invalid = makeBooklet({ id: 'invalid', questions: [{ id: 'missing', rev: 1, choice: null, unsure: false, ms: 0 }] });
    expect(bookletPageState(bookletStore([makeBooklet({ number: 2 }), invalid], { '1': invalid.id, '3': null }), 1, 100, catalog)).toEqual({ kind: 'retire', booklet: invalid });
  });
  it('全部已交卷時 review 最後一本，未做題為 0 時 next 仍為 0', () => {
    const first = submitBookletForTest(); const last = { ...first, id: 'last', number: 2 };
    expect(bookletPageState(bookletStore([last, first]), 1, 0, [])).toEqual({ kind: 'review', booklet: last, next: 0 });
  });
  it('沒有該科題本且有未做題時 first，最多開 50 題', () => {
    expect(bookletPageState(bookletStore([makeBooklet({ subject: 3 })]), 1, 100, catalog)).toEqual({ kind: 'first', next: 50 });
    expect(bookletPageState(bookletStore(), 1, 41, catalog)).toEqual({ kind: 'first', next: 41 });
  });
  it('沒有題本且未做題為 0 時 exhausted', () => {
    expect(bookletPageState(bookletStore(), 1, 0, catalog)).toEqual({ kind: 'exhausted' });
  });
  it('retired 不擋開下一本，有其他未交卷本就先接續', () => {
    const retired = makeBooklet({ status: 'retired' });
    expect(bookletPageState(bookletStore([retired]), 1, 41, [])).toEqual({ kind: 'review', booklet: retired, next: 41 });
    const next = makeBooklet({ id: 'next', number: 2 });
    expect(bookletPageState(bookletStore([retired, next]), 1, 41, catalog)).toEqual({ kind: 'resume', booklet: next });
  });
  it.each([
    [false, 50, '開第 1 本'], [false, 41, '開第 1 本（41 題）'], [false, 0, null],
    [true, 50, '開下一本'], [true, 41, '開下一本（41 題）'], [true, 0, null],
  ] as const)('開本文字 hasBooklets=%s next=%s', (hasBooklets, next, label) => {
    expect(bookletOpenLabel(hasBooklets, next)).toBe(label);
  });
});

describe('題本清單與進度', () => {
  it('清單依編號排序，3 種狀態與 submitting 分別帶正確欄位', () => {
    const open = makeBooklet(); open.questions[0].choice = 'A';
    const pending = { ...submitBookletForTest(answeredBooklet({ id: 'pending', number: 2 })), status: 'submitting' as const };
    const submitted = submitBookletForTest(answeredBooklet({ id: 'done', number: 3 }));
    const retired = makeBooklet({ id: 'retired', number: 4, status: 'retired', questions: [] });
    expect(bookletRows(bookletStore([retired, submitted, pending, open, makeBooklet({ subject: 3 })]), 1)).toEqual([
      { id: 'book1', number: 1, createdDate: '2026-11-05', statusLabel: '作答中', total: 5, answered: 1, canReview: false },
      { id: 'pending', number: 2, createdDate: '2026-11-05', statusLabel: '作答中', total: 5, answered: 5, canReview: false },
      { id: 'done', number: 3, createdDate: '2026-11-05', statusLabel: '已交卷', total: 5, correct: 5, canReview: true },
      { id: 'retired', number: 4, createdDate: '2026-11-05', statusLabel: '已結束', total: 0, canReview: false },
    ]);
  });
  it('交卷當天依台北日期加總多本，排除他科、未交卷、已結束與前一天', () => {
    const at = (id: string, number: number, ts: string) => submitBookletForTest(answeredBooklet({ id, number }), ts);
    const current = makeBooklet({ id: 'current', number: 7 }); current.questions[0].choice = 'A'; current.questions[3].choice = 'B';
    const store = bookletStore([
      at('day1', 1, '2026-11-06T16:00:00Z'), at('day2', 2, '2026-11-07T15:59:59Z'), at('previous', 3, '2026-11-06T15:59:59Z'),
      { ...at('pending', 4, '2026-11-06T17:00:00Z'), status: 'submitting' },
      { ...at('retired', 5, '2026-11-06T17:00:00Z'), status: 'retired' },
      { ...at('other', 1, '2026-11-06T17:00:00Z'), subject: 3 }, current,
    ], { '1': 'current', '3': null });
    const free = { free: 191, fullBooks: 3, lastBook: 41 };
    expect(bookletProgress(store, 1, '2026-11-07', free)).toEqual({ answered: 2, total: 5, todaySubmitted: 10, fullBooks: 3, lastBook: 41 });
    expect(bookletProgress(store, 1, '2026-11-06', { fullBooks: 3, lastBook: 41 }).todaySubmitted).toBe(5);
  });
  it('沒有目前題本時已答與總題數為 0，retired 不計入進度', () => {
    const retired = answeredBooklet({ status: 'retired' });
    for (const current of [null, retired.id]) {
      expect(bookletProgress(bookletStore([retired], { '1': current, '3': null }), 1, '2026-11-05', { fullBooks: 0, lastBook: 0 }))
        .toEqual({ answered: 0, total: 0, todaySubmitted: 0, fullBooks: 0, lastBook: 0 });
    }
  });
});

describe('題本以外的舊紀錄', () => {
  it('daily 與 booklet 各列一組，依日期倒序，同日科目 1 在前', () => {
    const records = [attempt({ mode: 'daily:2026-11-05:S3' }), attempt({ id: 's1', mode: 'daily:2026-11-05:S1' }),
      attempt({ id: 'new', mode: 'booklet:new:S3', correct: false, ts: '2026-11-06T16:00:00Z' })];
    expect(legacyRecords(bookletStore(), records)).toEqual([
      { mode: 'booklet:new:S3', date: '2026-11-07', subject: 3, answered: 1, correct: 0 },
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 1, correct: 1 },
      { mode: 'daily:2026-11-05:S3', date: '2026-11-05', subject: 3, answered: 1, correct: 1 },
    ]);
  });
  it('同 mode 同題只算最新時間，同時間依 id 決定，版本不影響分組', () => {
    expect(legacyRecords(null, [attempt(), attempt({ id: 'z', rev: 1, correct: false, ts: '2026-11-05T04:00:00Z' }),
      attempt({ id: 'a', correct: true, ts: '2026-11-05T04:00:00Z' }), attempt({ id: 'q1', qid: 'q1' })])).toEqual([
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 2, correct: 1 },
    ]);
  });
  it('清除後匯入，store 為 null 時全部有效模式都列入', () => {
    const records = [attempt(), attempt({ id: 'q1', qid: 'q1', correct: false }), attempt({ id: 'b', mode: 'booklet:backup:S1', ts: '2026-11-06T17:00:00Z' })];
    expect(legacyRecords(null, records)).toEqual([
      { mode: 'booklet:backup:S1', date: '2026-11-07', subject: 1, answered: 1, correct: 1 },
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 2, correct: 1 },
    ]);
  });
  it('失效後被略過的題回到舊紀錄，assignedQids 不算引用', () => {
    const book = makeBooklet({ attemptMode: 'daily:2026-11-05:S1' });
    book.questions[0] = { ...book.questions[0], choice: 'A', legacyAttemptId: 'old', correct: true };
    expect(legacyRecords(bookletStore([book]), [attempt()])).toEqual([]);
    const reconciled = reconcileBooklet(book, catalog.slice(1)).booklet;
    expect(reconciled.assignedQids).toEqual(['q0', 'q1', 'q2', 'q3', 'q4']);
    expect(legacyRecords(bookletStore([reconciled]), [attempt()])).toEqual([
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 1, correct: 1 },
    ]);
  });
  it('retired 的鎖定作答與提交作答都列入舊紀錄', () => {
    const book = answeredBooklet({ attemptMode: 'daily:2026-11-05:S1' });
    book.questions[0] = { ...book.questions[0], legacyAttemptId: 'old', correct: true };
    const retired = { ...submitBookletForTest(book), status: 'retired' as const };
    expect(legacyRecords(bookletStore([retired]), [attempt(), ...retired.submission!.attempts])).toEqual([
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 5, correct: 5 },
    ]);
  });
  it('案例 A：清單新版 q1 只留 q2，舊版 q1 答對紀錄仍列入', () => {
    const book = makeBooklet({ attemptMode: 'daily:2026-11-05:S1', assignedQids: ['q1', 'q2'],
      questions: [{ id: 'q2', rev: 1, choice: null, unsure: false, ms: 0 }] });
    expect(legacyRecords(bookletStore([book]), [attempt({ qid: 'q1', rev: 1 })])).toEqual([
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 1, correct: 1 },
    ]);
  });
  it('案例 B：匯入舊版答對先列入，交卷後最新作答被引用就不再列', () => {
    const book = makeBooklet({ attemptMode: 'daily:2026-11-05:S1', assignedQids: ['q1'],
      questions: [{ id: 'q1', rev: 2, choice: 'B', unsure: false, ms: 12 }] });
    const old = attempt({ qid: 'q1', rev: 1 }); const records = [old];
    expect(legacyRecords(bookletStore([book]), records)).toEqual([
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 1, correct: 1 },
    ]);
    const submitted = submitBookletForTest(book);
    expect(submitted.submission?.correct).toBe(0);
    expect(legacyRecords(bookletStore([submitted]), [...records, ...submitted.submission!.attempts])).toEqual([]);
    expect(records).toEqual([old]);
  });
  it('只排除最新作答 ID 的實際引用，不退回被取代的紀錄', () => {
    const book = makeBooklet(); book.questions[0] = { ...book.questions[0], legacyAttemptId: 'latest', choice: 'B', correct: false };
    expect(legacyRecords(bookletStore([book]), [attempt(), attempt({ id: 'latest', correct: false, ts: '2026-11-06T00:00:00Z' })])).toEqual([]);
    const newer = attempt({ id: 'newest', ts: '2026-11-07T00:00:00Z' });
    expect(legacyRecords(bookletStore([book]), [attempt(), newer])).toEqual([
      { mode: 'daily:2026-11-05:S1', date: '2026-11-05', subject: 1, answered: 1, correct: 1 },
    ]);
  });
  it('排除一般測驗與非 S1、S3 結尾的模式', () => {
    const modes = ['quiz', 'official:S1', 'single:S3', 'daily:2026-11-05:S2', 'booklet:b:S2', 'booklet:b:S13', 'daily:2026-11-05:S1:extra'];
    expect(legacyRecords(null, modes.map((mode) => attempt({ mode })))).toEqual([]);
  });
  it('booklet 的日期取該組最新作答台北日期，同題的舊日期不列入', () => {
    expect(legacyRecords(null, [attempt({ mode: 'booklet:b:S1' }), attempt({ id: 'new', mode: 'booklet:b:S1', qid: 'q1', correct: false, ts: '2026-11-07T16:00:00Z' })])).toEqual([
      { mode: 'booklet:b:S1', date: '2026-11-08', subject: 1, answered: 2, correct: 1 },
    ]);
  });
});

describe('程式題提示與共用題號', () => {
  it('13 題不提示，14 題提示題數與非程式題變少的原因', () => {
    const questions: DailyQuestion[] = Array.from({ length: 15 }, (_, i) => ({ ...catalog[0], id: `p${i}`, type: i === 14 ? '圖表' : '程式' }));
    const book = makeBooklet({ questions: questions.map((q) => ({ id: q.id, rev: q.rev, choice: null, unsure: false, ms: 0 })) });
    expect(bookletProgramNotice({ ...book, questions: book.questions.slice(0, 13) }, questions)).toBeNull();
    expect(bookletProgramNotice(book, questions)).toEqual({ count: 14, message: '這本有 14 題程式題，因為未做的非程式題變少。' });
    expect(bookletProgramNotice(book, questions.filter((q) => q.id !== 'p0'))).toBeNull();
    expect(bookletProgramNotice({ ...book, questions: [] }, questions)).toBeNull();
  });
  it('第 1 版與題本共用題號、狀態、位置、前進與計數', () => {
    const draft = make(); draft.questions[0].choice = 'A'; draft.questions[0].unsure = true; draft.questions[4].choice = 'B';
    for (const status of ['open', 'submitting', 'submitted'] as const) {
      const old = { ...draft, status }; const book = makeBooklet({ questions: draft.questions, status });
      expect(dailyNumbers(book)).toEqual(dailyNumbers(old));
      expect(dailyNumbers(book)).toEqual(status === 'submitted' ? [0, 1, 2, 3, 4] : [0, 1, 4]);
      expect(dailyCounts(book)).toEqual({ answered: 2, unsure: 1, total: 5 });
      expect(dailyPosition(book, 4)).toBe(dailyPosition(old, 4)); expect(dailyNext(book, 0)).toBe(dailyNext(old, 0));
      for (let i = 0; i < 5; i++) for (const available of [true, false]) expect(dailyNumberState(book, i, available)).toBe(dailyNumberState(old, i, available));
    }
    const retired = makeBooklet({ questions: draft.questions, status: 'retired' });
    expect(dailyNumbers(retired)).toEqual([0, 1, 4]); expect(dailyNumberState(retired, 0, false)).toBe('unsure');
    expect(dailyNumberState(retired, 1)).toBe('unanswered'); expect(dailyNumberState(retired, 4)).toBe('answered');
    expect(dailyNext(retired, 1)).toBe(1);
  });
});
