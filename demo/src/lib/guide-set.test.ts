/** 驗證新作答與不連續舊紀錄的開放範圍，並避免網址繞過確認作答。 */
import { describe, expect, it } from 'vitest';
import { guideNext, guideNumbers, guidePosition } from './guide-set';

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
