/** 每日題組沿用共用導覽；舊快取只替換官方題。 */
import { getAttempts, getDailySet, saveDailySet, type Attempt } from './attempts';
import { dailyMode, migrateDailySet, resolveDailySet, selectDailyQuestions, taipeiDate, unseenDailyQuestions, type DailyQuestion, type DailySubject } from './daily';
import { initQuestionSet } from './question-set-client';

export function initDaily(): void {
  const status = document.getElementById('daily-status')!;
  const container = document.getElementById('daily-cards')!;
  const subject = (new URLSearchParams(location.search).get('subject') === '3' ? 3 : 1) as DailySubject;
  (document.getElementById('daily-subject') as HTMLSelectElement).value = String(subject);
  const catalog: DailyQuestion[] = JSON.parse(document.getElementById('daily-catalog')?.textContent ?? '[]');
  const today = taipeiDate(new Date());
  const mode = dailyMode(today, subject);
  const text = (id: string, value: string) => { document.getElementById(id)!.textContent = value; };
  try {
    const attempts = getAttempts();
    let set = getDailySet(today, subject);
    if (!set) {
      const result = selectDailyQuestions(catalog, attempts, subject, today, Math.random);
      set = saveDailySet({ date: today, subject, questions: result.selected.map(({ id, rev }) => ({ id, rev })) });
    }
    const migration = migrateDailySet(set, catalog, attempts, Math.random);
    if (migration.replaced) set = saveDailySet(migration.set, true);
    const { selected, skipped, shortage } = resolveDailySet(set, catalog);
    const ids = new Set(selected.map((q) => q.id));
    const allCards = Array.from(container.querySelectorAll<HTMLElement>('[data-question]'));
    for (const card of allCards) if (!ids.has(card.dataset.qid!)) card.remove();
    const cards = selected.map((q) => allCards.find((card) => card.dataset.qid === q.id)!);
    const answered = new Map<string, Attempt>();
    // 任何模式作答都算做過；已快取的當日題目仍保留，並恢復當日建立後的作答。
    for (const attempt of attempts) {
      if (!ids.has(attempt.qid) || taipeiDate(new Date(attempt.ts)) !== today) continue;
      const previous = answered.get(attempt.qid);
      if (!previous || Date.parse(attempt.ts) > Date.parse(previous.ts) || (attempt.ts === previous.ts && attempt.id > previous.id)) answered.set(attempt.qid, attempt);
    }
    for (const card of cards) {
      card.dataset.mode = mode; container.append(card);
    }
    text('daily-date', `${today}・台北時間・科目 ${subject}`);
    const updateRemaining = () => text('daily-remaining', `該科剩餘未做的已驗證非官方題：${unseenDailyQuestions(catalog, getAttempts(), subject).length} 題（含今日未答題）。`);
    updateRemaining();
    status.textContent = [migration.replaced ? '已替換 ' + migration.replaced + ' 題官方題' + (migration.removed ? '，其中 ' + migration.removed + ' 題因候選不足已移除。' : '。') : '', shortage ? `今日可練 ${cards.length} 題，距離 50 題缺 ${shortage} 題。不補入做過的題目。` : '今日 50 題已固定，重新整理會保留題組與作答。', skipped.length ? `${skipped.length} 題已移除、改版或不再通過驗證，已略過，不自動補題。` : ''].filter(Boolean).join(' ');
    document.getElementById('daily-practice')!.hidden = !cards.length;
    if (!cards.length) return;
    initQuestionSet({ prefix: 'daily', cards, answered, mode,
      elapsed: attempts.filter((a) => a.mode === mode && ids.has(a.qid)).reduce((n, a) => n + a.ms, 0),
      onAnswered: () => { try { updateRemaining(); } catch { status.textContent += ' 無法更新剩餘題數，請確認瀏覽器允許儲存。'; } },
      expired: () => taipeiDate(new Date()) !== today,
    });
  } catch (cause) {
    status.textContent = '無法載入每日題組：' + (cause instanceof Error ? cause.message : '請確認瀏覽器允許本機儲存。') + ' 題組尚未開放作答，避免重新整理後換題。';
  }
}
