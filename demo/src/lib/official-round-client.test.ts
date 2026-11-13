/** 輪次畫面的題號、計時與交卷準備不依賴瀏覽器，也不碰真實作答資料。 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { OfficialRound } from './attempts';
import type { OfficialRoundCatalogQuestion } from './official-round';
import { latestOfficialRound, officialElapsed, officialRoundCanVisit, officialRoundCardDisplay, officialRoundNumbers, officialRoundPositions, officialRoundSubmitEnabled, prepareOfficialSubmission } from './official-round-client';

const catalog: OfficialRoundCatalogQuestion[] = [1, 3, 7].map((number) => ({ id: `115-1-S3-Q${number}`, number, rev: 1, subject: 3, source: 'exam', session: '115-1', review: { status: number === 3 ? 'disputed' : 'verified' } }));
function draft(): OfficialRound {
  return { id: 'round-a', seq: 2, setId: '115-1-S3', subject: 3, number: 1, createdAt: '2026-11-12T00:00:00Z',
    attemptMode: 'official-round:round-a:S3', status: 'open', position: 0,
    questions: catalog.map((q) => ({ id: q.id, rev: q.rev, choice: null, unsure: false, ms: 0 })) };
}
function answered(): OfficialRound {
  const round = draft(); round.questions.forEach((q) => { q.choice = 'A'; q.ms = 1234; }); return round;
}
const answers = new Map(catalog.map((q, index) => [q.id, index === 1 ? 'B' : 'A']));
const ts = '2026-11-12T01:00:00Z';

describe('交卷與保存失敗狀態', () => {
  it.each([
    [false, false, true], [false, true, true], [true, false, false], [true, true, false],
  ] as const)('答案保存失敗 %s、重新開始失敗 %s 時，交卷可用為 %s', (save, restart, enabled) => {
    expect(officialRoundSubmitEnabled(answered(), { save, restart })).toBe(enabled);
  });
  it('重新開始失敗仍不能交出未答完的作答', () => {
    expect(officialRoundSubmitEnabled(draft(), { save: false, restart: true })).toBe(false);
  });
  it.each(['submitting', 'submitted', 'retired'] as const)('%s 紀錄不能再次交卷', (status) => {
    const round = answered(); round.status = status;
    expect(officialRoundSubmitEnabled(round, { save: false, restart: true })).toBe(false);
  });
});

describe('考古題題號選單', () => {
  it('未答時只列第 1 題，不開放未來題', () => {
    expect(officialRoundNumbers(draft(), catalog)).toEqual([{ position: 0, number: 1, state: 'unanswered', current: true, unsure: false }]);
  });
  it('列出已答題與第 1 個未答題，保留原題號', () => {
    const round = draft(); round.questions[0].choice = 'B'; round.position = 1;
    expect(officialRoundNumbers(round, catalog).map((q) => [q.number, q.state, q.current])).toEqual([[1, 'answered', false], [3, 'unanswered', true]]);
  });
  it('交卷前不透露對錯，不確定使用中性狀態', () => {
    const round = answered(); round.questions[0].unsure = true;
    expect(officialRoundNumbers(round, catalog).map((q) => q.state)).toEqual(['unsure', 'answered', 'answered']);
  });
  it('交卷後顯示全部題號、固定對錯與不確定標記', () => {
    const prepared = prepareOfficialSubmission(answered(), answers, ts, () => 'id'); prepared.status = 'submitted'; prepared.questions[1].unsure = true;
    expect(officialRoundNumbers(prepared, catalog).map((q) => [q.number, q.state, q.unsure])).toEqual([[1, 'correct', false], [3, 'wrong', true], [7, 'correct', false]]);
  });
  it('已交卷失效題保留原題號，標示解析不可用', () => {
    const round = prepareOfficialSubmission(answered(), answers, ts, () => 'id'); round.status = 'submitted';
    expect(officialRoundNumbers(round, catalog.slice(1))[0]).toMatchObject({ number: 1, state: 'unavailable' });
  });
  it('爭議題仍是有效題', () => {
    const round = prepareOfficialSubmission(answered(), answers, ts, () => 'id'); round.status = 'submitted';
    expect(officialRoundNumbers(round, catalog)[1].state).toBe('wrong');
  });
  it('未交卷紀錄可跳任一題，保留不確定且不透露對錯', () => {
    const round = draft(); round.status = 'retired'; round.questions[1].choice = 'B'; round.questions[1].unsure = true;
    expect(officialRoundNumbers(round, catalog)).toEqual([
      { position: 0, number: 1, state: 'unanswered', current: true, unsure: false },
      { position: 1, number: 3, state: 'unsure', current: false, unsure: true },
      { position: 2, number: 7, state: 'unanswered', current: false, unsure: false },
    ]);
    for (const current of [0, 1, 2]) for (const target of [0, 1, 2]) expect(officialRoundCanVisit(round, target, current)).toBe(true);
    expect(officialRoundCanVisit(round, -1, 0)).toBe(false);
    expect(officialRoundCanVisit(round, 3, 0)).toBe(false);
  });
  it('未交卷紀錄未答任何題仍可跳到最後一題', () => {
    const round = draft(); round.status = 'retired';
    expect(officialRoundPositions(round)).toEqual([0, 1, 2]);
    expect(officialRoundCanVisit(round, 2, 0)).toBe(true);
    expect(officialRoundCanVisit(draft(), 2, 0)).toBe(false);
  });
  it('未交卷紀錄失效題不帶對錯，0 題也可產生選單', () => {
    const round = answered(); round.status = 'retired';
    expect(officialRoundNumbers(round, []).map((q) => q.state)).toEqual(['answered', 'answered', 'answered']);
    round.questions = [];
    expect(officialRoundNumbers(round, catalog)).toEqual([]);
    expect(officialRoundCanVisit(round, 0, 0)).toBe(false);
  });
  it('未交卷題卡鎖定選擇，不傳入結果或保存標記', () => {
    const round = answered(); round.status = 'retired';
    expect(officialRoundCardDisplay(round, 0, true)).toEqual({ choice: 'A', locked: true, reveal: false });
    round.questions[0].choice = null;
    expect(officialRoundCardDisplay(round, 0, false)).toEqual({ choice: null, locked: true, reveal: false });
  });
});

describe('重新開始的最新作答', () => {
  it('保留畫面答案、標記、位置與用時，序號沿用保存預期值', () => {
    const round = answered(); round.position = 1; round.questions[1].choice = 'C'; round.questions[1].unsure = true;
    const expected = { id: round.id, setId: round.setId, seq: 7 };
    const snapshot = structuredClone(round);
    const latest = latestOfficialRound(round, expected, catalog, 2500);
    expect(latest).toMatchObject({ seq: 7, status: 'open', position: 1 });
    expect(latest.questions[1]).toEqual({ id: catalog[1].id, rev: 1, choice: 'C', unsure: true, ms: 3734 });
    expect(latest.questions[0].ms).toBe(1234);
    expect(round).toEqual(snapshot);
    latest.questions[0].ms = 0;
    expect(round.questions[0].ms).toBe(1234);
  });
  it('只保留有效題，不帶 correct 或 submission，仍使用原版本', () => {
    const round = prepareOfficialSubmission(answered(), answers, ts, () => 'id'); round.position = 2;
    const latest = latestOfficialRound(round, round, catalog.slice(1));
    expect(latest.questions.map((q) => q.id)).toEqual([catalog[1].id, catalog[2].id]);
    expect(latest.position).toBe(1);
    expect(latest).not.toHaveProperty('submission');
    expect(latest.questions.every((q) => !('correct' in q))).toBe(true);
    expect(latest.questions.map((q) => q.rev)).toEqual([1, 1]);
  });
  it('略過目前題時選後面的有效題，全部失效時保留空清單', () => {
    const round = answered(); round.position = 1;
    expect(latestOfficialRound(round, round, [catalog[0], catalog[2]]).position).toBe(1);
    expect(latestOfficialRound(round, round, [])).toMatchObject({ questions: [], position: 0 });
  });
});

describe('考古題畫面文字', () => {
  it.each(['./official-round-client.ts', '../pages/official/[id].astro'])('%s 除註解外不含舊稱呼', (path) => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(source).not.toContain('輪');
    expect(source).not.toContain('重新考');
    expect(source).not.toMatch(/\?{3,}/);
  });
});

describe('可見片段用時', () => {
  it.each([[null, 1000, 0], [1000, 2500, 1500], [1500, 1000, 0], [1.1, 2.7, 2], [NaN, 1000, 0], [1000, Infinity, 0]] as const)('從 %s 到 %s 累加 %s 毫秒', (start, now, expected) => {
    expect(officialElapsed(start, now)).toBe(expected);
  });
  it('隱藏及確認期間的片段不累計', () => {
    expect(officialElapsed(100, 1100) + officialElapsed(null, 9100) + officialElapsed(9100, 10100)).toBe(2000);
  });
});

describe('固定交卷內容', () => {
  it('固定作答 ID、輪次模式、用時與原題版本', () => {
    let id = 0;
    const result = prepareOfficialSubmission(answered(), answers, ts, () => `attempt-${++id}`);
    expect(result.status).toBe('submitting');
    expect(result.submission).toMatchObject({ ts, total: 3, correct: 2 });
    expect(result.submission!.attempts.map((a) => a.id)).toEqual(['attempt-1', 'attempt-2', 'attempt-3']);
    expect(result.submission!.attempts[1]).toEqual({ id: 'attempt-2', qid: '115-1-S3-Q3', rev: 1, choice: 'A', correct: false, ts, mode: 'official-round:round-a:S3', ms: 1234 });
  });
  it('不修改原輪次，也不共用題目物件', () => {
    const round = answered(); const snapshot = structuredClone(round);
    const result = prepareOfficialSubmission(round, answers, ts, () => 'id');
    result.questions[0].ms = 99;
    expect(round).toEqual(snapshot); expect(round.questions.every((q) => q.correct === undefined)).toBe(true);
  });
  it('保留固定 ID 供重試，不再呼叫亂數函式', () => {
    let calls = 0;
    const prepared = prepareOfficialSubmission(answered(), answers, ts, () => `id-${++calls}`);
    const retried = structuredClone(prepared);
    expect(retried.submission).toEqual(prepared.submission); expect(calls).toBe(3);
  });
  it.each(['empty', 'unanswered', 'missing-answer', 'submitting', 'submitted', 'retired'] as const)('拒絕 %s 狀態', (kind) => {
    const round = answered(); const map = new Map(answers);
    if (kind === 'empty') round.questions = [];
    if (kind === 'unanswered') round.questions[1].choice = null;
    if (kind === 'missing-answer') map.delete(round.questions[1].id);
    if (kind === 'submitting' || kind === 'submitted' || kind === 'retired') round.status = kind;
    expect(() => prepareOfficialSubmission(round, map, ts, () => 'id')).toThrow('全部有效題目作答後才能交卷');
  });
});
