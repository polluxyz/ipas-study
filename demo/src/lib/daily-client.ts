/** 每日題組沿用現有答題卡；恢復畫面時只讀紀錄，不再次提交答案。 */
import { getAttempts, getDailySet, saveDailySet, type Attempt } from './attempts';
import { dailyMode, resolveDailySet, selectDailyQuestions, taipeiDate, unseenDailyQuestions, type DailyQuestion, type DailySubject } from './daily';

function restoreCard(card: HTMLElement, attempt: Attempt): void {
  card.dataset.answered = 'true'; card.dataset.saved = 'true';
  for (const input of card.querySelectorAll<HTMLInputElement>('input')) { input.checked = input.value === attempt.choice; input.disabled = true; }
  const submit = card.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = '已提交'; }
  for (const option of card.querySelectorAll<HTMLElement>('[data-option]')) {
    const isAnswer = option.dataset.option === card.dataset.answer;
    const isWrong = option.dataset.option === attempt.choice && !attempt.correct;
    option.classList.toggle('is-correct', isAnswer); option.classList.toggle('is-wrong', isWrong);
    const status = option.querySelector('.option-status'); if (status) status.textContent = isAnswer ? '✓ 正解' : isWrong ? '✕ 你的答案' : '';
  }
  card.querySelector('.answer-result')?.classList.toggle('incorrect', !attempt.correct);
  const label = card.querySelector('[data-result-label]'); if (label) label.textContent = attempt.correct ? '答對了，繼續保持！' : '這個觀念值得再看一次';
  const symbol = card.querySelector('[data-result-symbol]'); if (symbol) symbol.textContent = attempt.correct ? '✓' : '↺';
  const chosen = card.querySelector('[data-chosen]'); if (chosen) chosen.textContent = `・你的答案 ${attempt.choice}`;
  const explanation = card.querySelector<HTMLElement>('[data-explanation]'); if (explanation) explanation.hidden = false;
}

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
      const attempt = answered.get(card.dataset.qid!);
      if (attempt) restoreCard(card, attempt);
    }
    text('daily-date', `${today}・台北時間・科目 ${subject}`);
    const updateRemaining = () => text('daily-remaining', `該科剩餘未做的已驗證題目：${unseenDailyQuestions(catalog, getAttempts(), subject).length} 題（含今日未答題）。`);
    updateRemaining();
    status.textContent = [shortage ? `今日可練 ${cards.length} 題，距離 50 題缺 ${shortage} 題。不補入做過的題目。` : '今日 50 題已固定，重新整理會保留題組與作答。', skipped.length ? `${skipped.length} 題已移除、改版或不再通過驗證，已略過，不自動補題。` : ''].filter(Boolean).join(' ');
    document.getElementById('daily-practice')!.hidden = !cards.length;
    if (!cards.length) return;
    const previousButton = document.getElementById('daily-previous') as HTMLButtonElement;
    const nextButton = document.getElementById('daily-next') as HTMLButtonElement;
    let position = Math.max(0, cards.findIndex((card) => !card.dataset.answered));
    let elapsed = attempts.filter((a) => a.mode === mode).reduce((n, a) => n + a.ms, 0);
    let segmentStarted = performance.now();
    const showTime = () => {
      const ms = elapsed + (document.hidden || cards[position].dataset.answered ? 0 : performance.now() - segmentStarted);
      const seconds = Math.floor(ms / 1000);
      text('daily-time', `累計用時 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`);
    };
    const updateProgress = () => {
      const done = cards.filter((card) => card.dataset.answered).length;
      const correct = [...answered.values()].filter((a) => a.correct).length;
      text('daily-progress', `已答 ${done}／${cards.length} 題・答對 ${correct} 題`);
      (document.getElementById('daily-progress-bar') as HTMLProgressElement).value = done;
      (document.getElementById('daily-progress-bar') as HTMLProgressElement).max = cards.length;
      text('daily-position', `第 ${position + 1}／${cards.length} 題`);
      previousButton.disabled = position === 0; nextButton.disabled = position === cards.length - 1;
      text('daily-complete', done === cards.length ? '今日題組已完成。你可以回看解析，或到錯題練習繼續複習。' : '每題確認作答後，立即顯示解析。');
    };
    const show = () => {
      cards.forEach((card, index) => { card.hidden = index !== position; });
      segmentStarted = performance.now();
      cards[position].dispatchEvent(new Event('question-shown'));
      updateProgress(); showTime();
    };
    previousButton.addEventListener('click', () => { if (position > 0) { position--; show(); } });
    nextButton.addEventListener('click', () => { if (position < cards.length - 1) { position++; show(); } });
    container.addEventListener('question-answered', ((event: CustomEvent<{ qid: string; correct: boolean }>) => {
      const card = cards.find((item) => item.dataset.qid === event.detail.qid)!;
      elapsed += Math.round(performance.now() - segmentStarted);
      const selectedInput = card.querySelector<HTMLInputElement>('input:checked')!;
      answered.set(event.detail.qid, { id: '', qid: event.detail.qid, rev: Number(card.dataset.rev), choice: selectedInput.value as Attempt['choice'], correct: event.detail.correct, ts: new Date().toISOString(), mode, ms: 0 });
      updateProgress(); showTime();
      try { updateRemaining(); } catch { status.textContent += ' 無法更新剩餘題數，請確認瀏覽器允許儲存。'; }
    }) as EventListener);
    const timer = window.setInterval(() => {
      if (taipeiDate(new Date()) !== today) {
        status.textContent = '台北日期已換日。請重新整理，建立新一天的題組。';
        for (const input of container.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')) input.disabled = true;
        window.clearInterval(timer);
      }
      showTime();
    }, 1000);
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
    show();
  } catch (cause) {
    status.textContent = `無法載入每日題組：${cause instanceof Error ? cause.message : '請確認瀏覽器允許本機儲存。'} 題組尚未開放作答，避免重新整理後換題。`;
  }
}
