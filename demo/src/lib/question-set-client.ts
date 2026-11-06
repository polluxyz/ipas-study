/** 題組共用答題還原、逐題導覽與計時；位置放在網址，沿用既有作答儲存。 */
import type { Attempt } from './attempts';
import { displayQuestionCard } from './question-card-display';

function restoreCard(card: HTMLElement, attempt: Attempt): void {
  displayQuestionCard(card, { choice: attempt.choice, correct: attempt.correct, locked: true, reveal: true, saved: true });
}

export interface NavigationOptions {
  prefix: string; cards: HTMLElement[]; position: number;
  canVisit?: (target: number, current: number) => boolean;
  nextPosition?: (current: number) => number;
  onLeave?: () => void; onShow: (position: number) => void;
  heading?: HTMLElement;
}
/** 導覽只處理位置、網址與焦點；作答順序與資料保存由呼叫端決定。 */
export function initQuestionNavigation(options: NavigationOptions): { go: (target: number, focus?: boolean) => void; current: () => number } {
  let position = options.position;
  const go = (target: number, focus = true) => {
    if (target < 0 || target >= options.cards.length || options.canVisit?.(target, position) === false) return;
    options.onLeave?.(); position = target;
    options.cards.forEach((card, index) => { card.hidden = index !== position; });
    const url = new URL(location.href); url.searchParams.set('position', String(position + 1)); history.replaceState(history.state, '', url);
    options.onShow(position);
    options.cards[position].dispatchEvent(new Event('question-shown'));
    if (focus) {
      const heading = options.heading ?? options.cards[position].querySelector<HTMLElement>('.question-stem');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'instant' }); }
    }
  };
  document.getElementById(options.prefix + '-previous')!.addEventListener('click', () => go(position - 1));
  document.getElementById(options.prefix + '-next')!.addEventListener('click', () => go(options.nextPosition?.(position) ?? position + 1));
  go(position, false);
  return { go, current: () => position };
}

export interface QuestionSetOptions {
  prefix: string;
  cards: HTMLElement[];
  answered: Map<string, Attempt>;
  mode: string;
  elapsed: number;
  exam?: boolean;
  onAnswered?: () => void;
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
    showTime();
  }, 1000);
  window.addEventListener('pagehide', () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); }, { once: true });
  initQuestionNavigation({ prefix, cards, position, onLeave: settleSegment, onShow: (next) => {
    position = next; segmentStarted = performance.now(); updateProgress(); showTime();
  } });
}
