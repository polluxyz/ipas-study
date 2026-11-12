/** 題組共用答題還原、逐題導覽與計時；位置放在網址，沿用既有作答儲存。 */
import type { Attempt } from './attempts';
import { displayQuestionCard } from './question-card-display';
import { guideNext, guideNumbers, guidePosition, settleGuideTimer, type GuideTimer } from './guide-set';

function restoreCard(card: HTMLElement, attempt: Attempt): void {
  displayQuestionCard(card, { choice: attempt.choice, correct: attempt.correct, locked: true, reveal: true, saved: true });
}

export interface NavigationOptions {
  prefix: string; cards: HTMLElement[]; position: number;
  canVisit?: (target: number, current: number) => boolean;
  nextPosition?: (current: number) => number;
  previousPosition?: (current: number) => number;
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
  document.getElementById(options.prefix + '-previous')!.addEventListener('click', () => go(options.previousPosition?.(position) ?? position - 1));
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
  onAnswered?: () => void;
}

export function initQuestionSet(options: QuestionSetOptions): void {
  const { prefix, cards, answered, mode } = options;
  if (!cards.length) return;
  const text = (suffix: string, value: string) => { document.getElementById(prefix + '-' + suffix)!.textContent = value; };
  const previous = document.getElementById(prefix + '-previous') as HTMLButtonElement;
  const next = document.getElementById(prefix + '-next') as HTMLButtonElement;
  const panel = document.getElementById(prefix + '-panel') as HTMLDetailsElement;
  const desktop = window.matchMedia('(min-width: 1100px)');
  const confirmed = () => cards.map((card) => answered.has(card.dataset.qid!));
  const previousPosition = (current: number) => guideNumbers(confirmed()).filter((target) => target < current).at(-1) ?? current;
  for (const card of cards) {
    card.dataset.mode = mode;
    const attempt = answered.get(card.dataset.qid!);
    if (attempt) restoreCard(card, attempt);
  }
  let position = guidePosition(confirmed(), new URL(location.href).searchParams.get('position'));
  let time: GuideTimer = { elapsed: options.elapsed, questionMs: {}, active: null };
  let navigation: ReturnType<typeof initQuestionNavigation> | undefined;
  const showTime = () => {
    const ms = time.elapsed + (time.active === null ? 0 : performance.now() - time.active.started);
    const seconds = Math.floor(ms / 1000);
    text('time', '累計用時 ' + Math.floor(seconds / 60) + ' 分 ' + seconds % 60 + ' 秒');
  };
  const updateProgress = () => {
    const done = confirmed().filter(Boolean).length;
    const correct = cards.filter((card) => answered.get(card.dataset.qid!)?.correct).length;
    text('progress', '已答 ' + done + '／' + cards.length + ' 題・答對 ' + correct + ' 題');
    const progress = document.getElementById(prefix + '-progress-bar') as HTMLProgressElement;
    progress.value = done; progress.max = cards.length;
    text('position', '第 ' + (position + 1) + '／' + cards.length + ' 題');
    text('question-heading', '指引練習・第 ' + (position + 1) + ' 題');
    previous.disabled = previousPosition(position) === position;
    next.disabled = guideNext(confirmed(), position) === position;
    document.getElementById(prefix + '-numbers')!.replaceChildren(...guideNumbers(confirmed()).map((target) => {
      const attempt = answered.get(cards[target].dataset.qid!);
      const state = attempt ? attempt.correct ? 'correct' : 'wrong' : 'unanswered';
      const label = { correct: '答對', wrong: '答錯', unanswered: '未答' }[state];
      const button = Object.assign(document.createElement('button'), { type: 'button', textContent: String(target + 1) });
      button.dataset.status = state;
      if (target === position) button.setAttribute('aria-current', 'step');
      button.setAttribute('aria-label', '第 ' + (target + 1) + ' 題，' + label + (target === position ? '，目前題' : ''));
      button.addEventListener('click', () => { if (!desktop.matches) panel.open = false; navigation?.go(target); });
      return button;
    }));
    text('complete', done === cards.length ? '這份題組已完成。可回看解析，或到錯題練習繼續複習。' : '每題確認作答後，立即顯示解析。');
  };
  const settleSegment = () => {
    time = settleGuideTimer(time, performance.now());
  };
  // 題卡保存前同步取得已結算用時；沒有題組的題卡保留自己的計時。
  document.getElementById(prefix + '-cards')!.addEventListener('question-time-request', ((event: CustomEvent<{ ms?: number }>) => {
    const card = cards[position];
    if (event.target !== card || card.dataset.reveal === 'deferred' || answered.has(card.dataset.qid!)) return;
    settleSegment();
    event.detail.ms = time.questionMs[card.dataset.qid!] ?? 0;
  }) as EventListener);
  document.getElementById(prefix + '-cards')!.addEventListener('question-answered', ((event: CustomEvent<{ qid: string; correct: boolean; ms: number }>) => {
    const card = cards.find((item) => item.dataset.qid === event.detail.qid);
    if (!card) return;
    settleSegment();
    const selected = card.querySelector<HTMLInputElement>('input:checked')!;
    answered.set(event.detail.qid, { id: '', qid: event.detail.qid, rev: Number(card.dataset.rev), choice: selected.value as Attempt['choice'], correct: event.detail.correct, ts: new Date().toISOString(), mode, ms: event.detail.ms });
    updateProgress(); showTime(); options.onAnswered?.();
  }) as EventListener);
  const visibility = () => {
    settleSegment();
    if (!document.hidden && !answered.has(cards[position].dataset.qid!)) time.active = { qid: cards[position].dataset.qid!, started: performance.now() };
    showTime();
  };
  document.addEventListener('visibilitychange', visibility);
  const timer = window.setInterval(() => {
    showTime();
  }, 1000);
  window.addEventListener('pagehide', () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); }, { once: true });
  navigation = initQuestionNavigation({ prefix, cards, position, heading: document.getElementById(prefix + '-question-heading')!,
    canVisit: (target) => guideNumbers(confirmed()).includes(target),
    nextPosition: (current) => guideNext(confirmed(), current), previousPosition,
    onLeave: settleSegment, onShow: (next) => {
    position = next;
    time.active = !document.hidden && !answered.has(cards[position].dataset.qid!) ? { qid: cards[position].dataset.qid!, started: performance.now() } : null;
    updateProgress(); showTime();
  } });
  panel.addEventListener('toggle', () => {
    panel.querySelector('summary')!.setAttribute('aria-expanded', String(panel.open));
    text('panel-toggle', panel.open ? '收合' : '展開');
  });
  panel.open = desktop.matches;
  desktop.addEventListener('change', () => {
    const focused = document.activeElement;
    panel.open = desktop.matches;
    if (!panel.open && panel.contains(focused)) panel.querySelector('summary')!.focus({ preventScroll: true });
    else if (panel.open && focused === panel.querySelector('summary')) panel.querySelector<HTMLButtonElement>('[aria-current]')?.focus({ preventScroll: true });
  });
}
