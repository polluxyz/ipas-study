/** 題組共用答題還原、逐題導覽與計時；位置放在網址，沿用既有作答儲存。 */
import type { Attempt } from './attempts';

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

export interface QuestionSetOptions {
  prefix: string;
  cards: HTMLElement[];
  answered: Map<string, Attempt>;
  mode: string;
  elapsed: number;
  exam?: boolean;
  onAnswered?: () => void;
  expired?: () => boolean;
}

export function initQuestionSet(options: QuestionSetOptions): void {
  const { prefix, cards, answered, mode } = options;
  if (!cards.length) return;
  const text = (suffix: string, value: string) => { document.getElementById(prefix + '-' + suffix)!.textContent = value; };
  const previous = document.getElementById(prefix + '-previous') as HTMLButtonElement;
  const next = document.getElementById(prefix + '-next') as HTMLButtonElement;
  for (const card of cards) {
    card.dataset.mode = mode;
    const attempt = answered.get(card.dataset.qid!);
    if (attempt) restoreCard(card, attempt);
  }
  const queryPosition = Number(new URL(location.href).searchParams.get('position'));
  let position = Number.isInteger(queryPosition) && queryPosition >= 1 && queryPosition <= cards.length
    ? queryPosition - 1 : Math.max(0, cards.findIndex((card) => !card.dataset.answered));
  let elapsed = options.elapsed;
  let segmentStarted = performance.now();
  const showTime = () => {
    const ms = elapsed + (document.hidden || cards[position].dataset.answered ? 0 : performance.now() - segmentStarted);
    const seconds = Math.floor(ms / 1000);
    text('time', '累計用時 ' + Math.floor(seconds / 60) + ' 分 ' + seconds % 60 + ' 秒');
  };
  const updateProgress = () => {
    const done = cards.filter((card) => card.dataset.answered).length;
    const correct = [...answered.values()].filter((a) => a.correct).length;
    text('progress', '已答 ' + done + '／' + cards.length + ' 題・答對 ' + correct + ' 題' + (options.exam ? '・換算分數 ' + correct * 2 + ' 分' : ''));
    const progress = document.getElementById(prefix + '-progress-bar') as HTMLProgressElement;
    progress.value = done; progress.max = cards.length;
    text('position', '第 ' + (position + 1) + '／' + cards.length + ' 題');
    previous.disabled = position === 0; next.disabled = position === cards.length - 1;
    text('complete', done === cards.length ? '這份題組已完成。可回看解析，或到錯題練習繼續複習。' : '每題確認作答後，立即顯示解析。');
  };
  const settleSegment = () => {
    if (!document.hidden && !cards[position].dataset.answered) elapsed += performance.now() - segmentStarted;
    segmentStarted = performance.now();
  };
  const show = () => {
    cards.forEach((card, index) => { card.hidden = index !== position; });
    const url = new URL(location.href); url.searchParams.set('position', String(position + 1));
    history.replaceState(history.state, '', url);
    segmentStarted = performance.now();
    cards[position].dispatchEvent(new Event('question-shown'));
    updateProgress(); showTime();
  };
  previous.addEventListener('click', () => { if (position > 0) { settleSegment(); position--; show(); } });
  next.addEventListener('click', () => { if (position < cards.length - 1) { settleSegment(); position++; show(); } });
  document.getElementById(prefix + '-cards')!.addEventListener('question-answered', ((event: CustomEvent<{ qid: string; correct: boolean }>) => {
    const card = cards.find((item) => item.dataset.qid === event.detail.qid);
    if (!card) return;
    elapsed += Math.round(performance.now() - segmentStarted);
    const selected = card.querySelector<HTMLInputElement>('input:checked')!;
    answered.set(event.detail.qid, { id: '', qid: event.detail.qid, rev: Number(card.dataset.rev), choice: selected.value as Attempt['choice'], correct: event.detail.correct, ts: new Date().toISOString(), mode, ms: 0 });
    updateProgress(); showTime(); options.onAnswered?.();
  }) as EventListener);
  const visibility = () => { segmentStarted = performance.now(); };
  document.addEventListener('visibilitychange', visibility);
  const timer = window.setInterval(() => {
    if (options.expired?.()) {
      text('status', '台北日期已換日。請重新整理，建立新一天的題組。');
      for (const input of document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('#' + prefix + '-cards input, #' + prefix + '-cards button')) input.disabled = true;
      window.clearInterval(timer);
    }
    showTime();
  }, 1000);
  window.addEventListener('pagehide', () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); }, { once: true });
  show();
}
