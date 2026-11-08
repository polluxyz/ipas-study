/** 確認實測涵蓋完整交卷資料，並由正式驗證器拒絕不一致的作答模式。 */
import { describe, expect, it } from 'vitest';
import { isBookletStore } from '../src/lib/attempts.ts';
import { buildBenchStore } from './booklet-store-bench.mjs';

describe('21 本題本的實測資料', () => {
  it('符合第 2 版題本格式', () => {
    const store = buildBenchStore();
    expect(store.version).toBe(2);
    expect(isBookletStore(store)).toBe(true);
  });

  it('包含科目 1 的 11 本與科目 3 的 10 本完整交卷資料', () => {
    const store = buildBenchStore();
    expect(store.booklets).toHaveLength(21);
    expect(store.booklets.filter((booklet) => booklet.subject === 1)).toHaveLength(11);
    expect(store.booklets.filter((booklet) => booklet.subject === 3)).toHaveLength(10);
    const qids = [];
    const attemptIds = [];
    for (const booklet of store.booklets) {
      expect(booklet.status).toBe('submitted');
      expect(booklet.assignedQids).toHaveLength(50);
      expect(booklet.questions).toHaveLength(50);
      expect(booklet.submission.total).toBe(50);
      expect(booklet.submission.attempts).toHaveLength(50);
      for (const question of booklet.questions) {
        expect(question.id).toMatch(/^Z-L(?:21203|23303)-\d{3}$/);
        qids.push(question.id);
      }
      for (const attempt of booklet.submission.attempts) {
        expect(attempt.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
        attemptIds.push(attempt.id);
      }
    }
    expect(new Set(qids).size).toBe(1050);
    expect(new Set(attemptIds).size).toBe(1050);
  });

  it('每次產生相同內容，修改其中一份不影響另一份', () => {
    const first = buildBenchStore();
    const second = buildBenchStore();
    expect(first).toEqual(second);
    first.booklets[0].questions[0].ms++;
    expect(first).not.toEqual(second);
    expect(isBookletStore(second)).toBe(true);
  });

  it.each(['quiz', 'booklet:other:S1', 'booklet:00000000-0000-4000-8000-000000000001:S3'])(
    '拒絕交卷快照中錯誤的作答模式 %s', (mode) => {
      const store = buildBenchStore();
      store.booklets[0].submission.attempts[0].mode = mode;
      expect(isBookletStore(store)).toBe(false);
    },
  );
});
