/** 驗證新作答與不連續舊紀錄的開放範圍，並避免網址繞過確認作答。 */
import { describe, expect, it } from 'vitest';
import { guideNext, guideNumbers, guidePosition, settleGuideTimer, type GuideTimer } from './guide-set';

describe('指引可見用時', () => {
  it('隱藏 60 秒不累加，恢復後保存值等於畫面累計', () => {
    const initial: GuideTimer = { elapsed: 0, questionMs: {}, active: { qid: 'q1', started: 100 } };
    const hidden = settleGuideTimer(initial, 5100);
    expect(hidden).toEqual({ elapsed: 5000, questionMs: { q1: 5000 }, active: null });
    const stillHidden = settleGuideTimer(hidden, 65100);
    expect(stillHidden).toEqual(hidden);
    const confirmed = settleGuideTimer({ ...stillHidden, active: { qid: 'q1', started: 65100 } }, 65100);
    expect(confirmed.elapsed).toBe(confirmed.questionMs.q1);
    expect(confirmed.questionMs.q1).toBe(5000);
    expect(initial.questionMs).toEqual({});
  });

  it('跨題與多個可見片段的總和等於每題保存值', () => {
    const first = settleGuideTimer({ elapsed: 7000, questionMs: {}, active: { qid: 'q1', started: 0 } }, 1234.4);
    const resumed = settleGuideTimer({ ...first, active: { qid: 'q1', started: 5000 } }, 6000.4);
    const next = settleGuideTimer({ ...resumed, active: { qid: 'q2', started: 8000 } }, 10000.6);
    expect(next.questionMs).toEqual({ q1: 2234, q2: 2001 });
    expect(next.elapsed).toBe(7000 + next.questionMs.q1 + next.questionMs.q2);
    expect(settleGuideTimer(next, 99999)).toEqual(next);
  });

  it('片段用時為非負整數', () => {
    const timer: GuideTimer = { elapsed: 0, questionMs: {}, active: { qid: 'q1', started: 100 } };
    expect(settleGuideTimer(timer, 99).questionMs.q1).toBe(0);
    expect(settleGuideTimer(timer, 101.6).questionMs.q1).toBe(2);
  });
});

describe('指引題號選單', () => {
  it.each([
    [[false, false, false], [0]],
    [[true, true, false, false], [0, 1, 2]],
    [[true, false, true, false, false, false, true], [0, 1, 2, 6]],
    [[true, true, true], [0, 1, 2]],
    [[], []],
  ])('依已確認紀錄 %j 列出開放題號', (confirmed, expected) => {
    expect(guideNumbers(confirmed as boolean[])).toEqual(expected);
  });
});

describe('指引下一題', () => {
  it('全部未答時不能前進', () => expect(guideNext([false, false], 0)).toBe(0));
  it('連續確認後開放下一題', () => expect(guideNext([true, false, false], 0)).toBe(1));
  it('不連續紀錄中不能從未答題前進', () => expect(guideNext([true, false, true], 1)).toBe(1));
  it('跳過未開放題，前往下一個已答題', () => expect(guideNext([true, false, true, false, true], 2)).toBe(4));
  it('全部答完時可前進及停在末題', () => {
    expect(guideNext([true, true, true], 1)).toBe(2);
    expect(guideNext([true, true, true], 2)).toBe(2);
  });
});

describe('指引網址位置', () => {
  const gaps = [true, false, true, false, false, false, true];
  it.each([null, '', '999', '0', '-1', '1.5', 'abc', 'NaN', 'Infinity', '2e0', ' 2', '9007199254740993'])('校正無效位置 %s', (requested) => {
    expect(guidePosition(gaps, requested)).toBe(1);
  });
  it.each(['1', '2', '3', '7'])('保留已答或第 1 個未答的位置 %s', (requested) => {
    expect(guidePosition(gaps, requested)).toBe(Number(requested) - 1);
  });
  it('未開放的未答題改到第 1 個未答題', () => expect(guidePosition(gaps, '4')).toBe(1));
  it('全部未答時開第 1 題', () => expect(guidePosition([false, false], null)).toBe(0));
  it('連續紀錄開第 1 個未答題', () => expect(guidePosition([true, true, false], null)).toBe(2));
  it('全部答完且沒有合法位置時開第 1 題', () => {
    expect(guidePosition([true, true], null)).toBe(0);
    expect(guidePosition([true, true], '999')).toBe(0);
    expect(guidePosition([true, true], '2')).toBe(1);
  });
});
