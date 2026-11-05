/** 驗證練習順序可重現且保留題目，並防止連號題的答案循環延續到清單。 */
import { describe, expect, it } from 'vitest';
import { orderPracticeQuestions } from './practice-order';

const questions = [
  { id: 'mock-003', source: 'mock' },
  { id: 'guide-002', source: 'guide' },
  { id: 'exam-002', source: 'exam' },
  { id: 'external-001', source: 'external' },
  { id: 'exam-001', source: 'exam' },
  { id: 'mock-001', source: 'mock' },
  { id: 'guide-001', source: 'guide' },
  { id: 'mock-002', source: 'mock' },
];

describe('練習題穩定排序', () => {
  it('考古題與指引題維持彼此原本的相對順序，並排在其他來源之前', () => {
    const result = orderPracticeQuestions(questions);
    expect(result.slice(0, 4).map(({ id }) => id)).toEqual(['guide-002', 'exam-002', 'exam-001', 'guide-001']);
    expect(result.slice(4).every(({ source }) => source !== 'exam' && source !== 'guide')).toBe(true);
  });

  it('其他來源的輸入順序不同，輸出順序仍相同', () => {
    const others = questions.filter(({ source }) => source === 'mock' || source === 'external');
    expect(orderPracticeQuestions([...others].reverse())).toEqual(orderPracticeQuestions(others));
    expect(orderPracticeQuestions([...others.slice(2), ...others.slice(0, 2)])).toEqual(orderPracticeQuestions(others));
  });

  it('移動其他來源不改變整份輸出，官方題仍沿用輸入的相對順序', () => {
    const official = questions.filter(({ source }) => source === 'exam' || source === 'guide');
    const others = questions.filter(({ source }) => source !== 'exam' && source !== 'guide');
    expect(orderPracticeQuestions([...others.reverse(), ...official])).toEqual(orderPracticeQuestions(questions));
  });

  it('不修改輸入陣列或題目，並回傳新陣列', () => {
    const input = Object.freeze(questions.map((question) => Object.freeze({ ...question })));
    const before = JSON.stringify(input);
    const result = orderPracticeQuestions(input);
    expect(result).not.toBe(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(orderPracticeQuestions(input)).toEqual(result);
  });

  it('回傳相同題目集合，保留物件與重複項目', () => {
    const input = [...questions, questions[0]];
    const result = orderPracticeQuestions(input);
    expect(result).toHaveLength(input.length);
    for (const question of input) {
      expect(result.filter((item) => item === question)).toHaveLength(input.filter((item) => item === question).length);
    }
  });

  it('空陣列與單題仍回傳新陣列', () => {
    expect(orderPracticeQuestions([])).toEqual([]);
    const input = [questions[0]];
    expect(orderPracticeQuestions(input)).toEqual(input);
    expect(orderPracticeQuestions(input)).not.toBe(input);
  });

  it('40 題 ABCD 循環題的下一字母比例降到 40% 以下', () => {
    const answers = ['A', 'B', 'C', 'D'];
    const input = Array.from({ length: 40 }, (_, index) => ({
      id: `mock-L23303-${String(index + 1).padStart(3, '0')}`,
      source: 'mock', answer: answers[index % 4],
    }));
    const nextLetterRatio = (items: typeof input) => items.slice(1).filter((question, index) =>
      question.answer === answers[(answers.indexOf(items[index].answer) + 1) % 4],
    ).length / (items.length - 1);
    expect(nextLetterRatio(input)).toBe(1);
    const result = orderPracticeQuestions(input);
    expect(result.map(({ id }) => id)).not.toEqual(input.map(({ id }) => id));
    expect(nextLetterRatio(result)).toBeLessThanOrEqual(0.4);
  });
});
