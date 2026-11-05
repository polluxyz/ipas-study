/** 練習清單保留官方題的閱讀順序，其他題依固定雜湊排序，避免連號透露答案規律。 */
import { createHash } from 'node:crypto';

interface PracticeQuestion { id: string; source: string; }

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function orderPracticeQuestions<T extends PracticeQuestion>(questions: readonly T[]): T[] {
  const official: T[] = [];
  const others: { question: T; hash: string }[] = [];
  for (const question of questions) {
    if (question.source === 'exam' || question.source === 'guide') official.push(question);
    else others.push({ question, hash: createHash('sha256').update(question.id).digest('hex') });
  }
  // 用字元順序比較，避免不同語系的建置環境產生不同結果。
  others.sort((a, b) => compareText(a.hash, b.hash) || compareText(a.question.id, b.question.id));
  return [...official, ...others.map(({ question }) => question)];
}
