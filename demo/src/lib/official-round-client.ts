/** 考古題輪次管理畫面與保存生命週期；只有交卷成功才揭露結果。 */
import { DailyConflictError, OFFICIAL_ROUND_KEY, readOfficialRounds, restartOfficialRound, saveOfficialRound, submitOfficialRound, type Choice, type OfficialRound, type OfficialRoundRef } from './attempts';
import { dailyCounts, dailyNext, dailyNumbers, dailyNumberState, dailyPosition } from './daily-exam';
import { availableOfficialQuestion, canSubmitOfficialRound, officialQuestionNumber, officialRetiredSummary, officialRoundList, officialRoundReviewAction, officialRoundScore, reconcileOfficialRound, type OfficialRoundAction, type OfficialRoundCatalogQuestion } from './official-round';
import { startOfficialRound } from './official-start';
import { displayQuestionCard, type CardDisplay } from './question-card-display';
import { initQuestionNavigation } from './question-set-client';

interface RoundCatalog { id: string; title: string; subject: 1 | 3; questions: OfficialRoundCatalogQuestion[]; }
interface RoundFailures { save: boolean; restart: boolean; }

/** 重新開始失敗不影響已保存答案；只有答案保存失敗會擋住交卷。 */
export function officialRoundSubmitEnabled(round: OfficialRound, failures: RoundFailures): boolean {
  return !failures.save && canSubmitOfficialRound(round);
}

/** 題號選單沿用每日規則，但文字始終保留原考卷題號。 */
export function officialRoundNumbers(round: OfficialRound, catalog: readonly OfficialRoundCatalogQuestion[]) {
  return officialRoundPositions(round).map((position) => {
    const q = round.questions[position];
    return { position, number: officialQuestionNumber(q.id, catalog),
      state: dailyNumberState(round, position, availableOfficialQuestion(q, catalog, round)),
      current: position === round.position, unsure: (round.status === 'submitted' || round.status === 'retired') && q.unsure };
  });
}

/** 未交卷紀錄可跳到所有題目，不使用每日作答的逐題開放規則。 */
export function officialRoundPositions(round: OfficialRound): number[] {
  return round.status === 'retired' ? round.questions.map((_, index) => index) : dailyNumbers(round);
}

export function officialRoundCanVisit(round: OfficialRound, target: number, current: number, initial = false): boolean {
  return officialRoundPositions(round).includes(target) && (round.status === 'retired' || initial ||
    (round.status !== 'submitting' && (round.status === 'submitted' || Boolean(round.questions[current]?.choice) || target <= current)));
}

/** 唯讀未交卷題卡只還原選擇；不傳入計分結果。 */
export function officialRoundCardDisplay(round: OfficialRound, position: number, editable: boolean): CardDisplay {
  const q = round.questions[position];
  if (round.status === 'retired') return { choice: q.choice, locked: true, reveal: false };
  return { choice: q.choice, locked: !editable, reveal: round.status === 'submitted', correct: q.correct, saved: round.status === 'submitted' };
}

/** 重新開始只保留畫面有效題與作答欄位，不把交卷結果帶入未交卷紀錄。 */
export function latestOfficialRound(round: OfficialRound, expected: OfficialRoundRef, catalog: readonly OfficialRoundCatalogQuestion[], elapsed = 0): OfficialRound {
  const kept = round.questions.map((q, index) => ({ q, index })).filter(({ q }) => availableOfficialQuestion(q, catalog, round));
  const next = kept.findIndex(({ index }) => index >= round.position);
  return { id: round.id, seq: expected.seq, setId: round.setId, subject: round.subject, number: round.number,
    createdAt: round.createdAt, attemptMode: round.attemptMode, status: 'open',
    position: next < 0 ? Math.max(0, kept.length - 1) : next,
    questions: kept.map(({ q, index }) => ({ id: q.id, rev: q.rev, choice: q.choice, unsure: q.unsure,
      ms: q.ms + (index === round.position ? officialElapsed(0, elapsed) : 0) })) };
}

/** 時間以可見片段累加；負時間與無效時鐘不污染儲存資料。 */
export function officialElapsed(started: number | null, now: number): number {
  return started === null || !Number.isFinite(started) || !Number.isFinite(now) ? 0 : Math.max(0, Math.round(now - started));
}

/** 交卷先固定作答 ID，後續重試直接沿用整份內容。 */
export function prepareOfficialSubmission(round: OfficialRound, answers: ReadonlyMap<string, string>, ts: string, randomId: () => string): OfficialRound {
  if (!canSubmitOfficialRound(round) || round.questions.some((q) => !answers.has(q.id))) throw new Error('全部有效題目作答後才能交卷。');
  const questions = round.questions.map((q) => ({ ...q, correct: q.choice === answers.get(q.id) }));
  return { ...round, status: 'submitting', questions, submission: {
    ts, total: questions.length, correct: questions.filter((q) => q.correct).length,
    attempts: questions.map((q) => ({ id: randomId(), qid: q.id, rev: q.rev, choice: q.choice!, correct: q.correct, ts, mode: round.attemptMode, ms: q.ms })),
  } };
}

export function initOfficialRound(): void {
  const element = <T extends HTMLElement = HTMLElement>(suffix: string) => document.getElementById('official-' + suffix) as T;
  const text = (suffix: string, value: string) => { element(suffix).textContent = value; };
  const catalog: RoundCatalog = JSON.parse(element('catalog').textContent ?? '{}');
  const roundId = new URL(location.href).searchParams.get('round');
  const container = element('cards');
  // 未進入這輪的題卡留在記憶體，避免隱藏題目進入朗讀與表單導覽。
  const allCards = new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-question]')).map((card) => [card.dataset.qid!, card]));
  container.replaceChildren();
  const submit = element<HTMLButtonElement>('submit');
  const restart = element<HTMLButtonElement>('restart');
  const unsure = element<HTMLButtonElement>('unsure');
  const dialog = element<HTMLDialogElement>('dialog');
  const restartDialog = element<HTMLDialogElement>('restart-dialog');
  const panel = element<HTMLDetailsElement>('panel');
  const desktop = window.matchMedia('(min-width: 1100px)');
  let round: OfficialRound | undefined;
  let expected: OfficialRoundRef | undefined;
  let pending: OfficialRound | undefined;
  let savedContent = '';
  let readOnly = false;
  const failures: RoundFailures = { save: false, restart: false };
  let opening = false;
  let stopped = false;
  let started: number | null = null;
  let timer: number | undefined;
  let saveTimer: number | undefined;
  let cards: HTMLElement[] = [];
  let navigation: ReturnType<typeof initQuestionNavigation> | undefined;
  let retryAction: (() => void) | undefined;
  const url = (id: string) => '/official/' + catalog.id + '/?round=' + encodeURIComponent(id);
  const editable = () => Boolean(round?.status === 'open' && !readOnly && !pending && !stopped && !restartDialog.open);
  const stop = () => { stopped = true; started = null; window.clearInterval(timer); window.clearInterval(saveTimer); };
  const error = (cause: unknown, lead = '尚未保存，畫面上的答案仍保留。', retry?: () => void, failure: keyof RoundFailures = 'save') => {
    failures[failure] = true; retryAction = retry;
    if (cause instanceof DailyConflictError) {
      readOnly = true; started = null;
      if (dialog.open) dialog.close();
      if (restartDialog.open) restartDialog.close();
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    text('error-message', cause instanceof DailyConflictError ? '這次作答已由另一頁更新，請重新載入。本頁已改為唯讀。' : readOnly ? `目前無法確認這次作答，請重新載入。本頁已改為唯讀。${message}` : lead + message);
    element('save-error').hidden = false; element('retry').hidden = readOnly; element('reload').hidden = !readOnly;
  };
  const clearError = () => { failures.save = false; failures.restart = false; retryAction = undefined; element('save-error').hidden = true; };
  const settle = () => {
    const now = performance.now();
    const q = round?.questions[round.position];
    if (q && editable()) q.ms += officialElapsed(started, now);
    started = editable() && q && !document.hidden ? now : null;
  };
  const persist = () => {
    if (!round || !expected || !editable() || JSON.stringify(round) === savedContent) return;
    try { round = saveOfficialRound(round, expected); expected = { ...round }; savedContent = JSON.stringify(round); clearError(); }
    catch (cause) { error(cause); }
  };
  const showTime = () => {
    if (!round) return;
    const ms = round.questions.reduce((sum, q) => sum + q.ms, 0) + (editable() ? officialElapsed(started, performance.now()) : 0);
    const seconds = Math.floor(ms / 1000); text('time', `本次用時 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
    if (round.status === 'retired') text('retired-time', element('time').textContent ?? '');
  };
  const actionElement = (action: OfficialRoundAction): HTMLElement => {
    if (action.kind === 'resume') return Object.assign(document.createElement('a'), { className: 'button primary', href: url(action.roundId), textContent: action.label });
    const button = Object.assign(document.createElement('button'), { type: 'button', className: 'button primary', textContent: action.label, disabled: readOnly || opening });
    button.addEventListener('click', startRound); return button;
  };
  const historyLink = () => Object.assign(document.createElement('a'), { href: '/official/' + catalog.id + '/', textContent: '全部紀錄 →' });
  const currentQuestions = () => catalog.questions.filter((q) => availableOfficialQuestion(q, catalog.questions, { setId: catalog.id, subject: catalog.subject }));
  function startRound(): void {
    if (opening || readOnly) return;
    opening = true;
    for (const button of document.querySelectorAll<HTMLButtonElement>('#official-round-action button, #official-review-action button')) button.disabled = true;
    try {
      const opened = startOfficialRound(catalog, () => crypto.randomUUID(), () => new Date().toISOString());
      stop(); location.href = url(opened.roundId);
    } catch (cause) {
      opening = false; error(cause, '尚未開始作答，原資料已保留。', startRound);
      for (const button of document.querySelectorAll<HTMLButtonElement>('#official-round-action button, #official-review-action button')) button.disabled = readOnly;
    }
  }

  const renderList = () => {
    const list = officialRoundList(catalog.id, readOfficialRounds().rounds);
    element('round-list').hidden = false; text('status', '按下開始按鈕才會開始作答。');
    element('round-action').replaceChildren(actionElement(list.action));
    const rows = list.rows.map((item) => {
      const row = document.createElement('div'); row.className = 'official-round-row';
      row.append(Object.assign(document.createElement('time'), { dateTime: item.createdAt, textContent: item.startedText }),
        Object.assign(document.createElement('span'), { textContent: item.statusText + '・' + item.resultText }),
        Object.assign(document.createElement('a'), { href: url(item.id), textContent: '查看 →', ariaLabel: item.ariaLabel }));
      return row;
    });
    element('round-rows').replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('p'), { textContent: '還沒有作答紀錄。' })]));
  };
  const displayCards = () => cards.forEach((card, index) => {
    const q = round!.questions[index];
    if (!availableOfficialQuestion(q, catalog.questions, round!)) return;
    displayQuestionCard(card, officialRoundCardDisplay(round!, index, editable()));
  });
  const render = () => {
    if (!round) return;
    const submitted = round.status === 'submitted';
    const retired = round.status === 'retired';
    element('time').hidden = retired;
    const submitting = round.status === 'submitting' || Boolean(pending);
    const counts = dailyCounts(round);
    const q = round.questions[round.position];
    const number = q ? officialQuestionNumber(q.id, catalog.questions) : null;
    text('position', `第 ${number ?? '—'} 題／共 ${counts.total} 題`); text('question-heading', `第 ${number ?? '—'} 題`);
    text('progress', `已答 ${counts.answered}／${counts.total}`); text('unsure-count', `不確定 ${counts.unsure}`);
    const bar = element<HTMLProgressElement>('progress-bar'); bar.max = Math.max(1, counts.total); bar.value = counts.answered;
    submit.hidden = submitted || retired; submit.disabled = !editable() || !officialRoundSubmitEnabled(round, failures);
    submit.textContent = counts.answered === counts.total ? '交卷' : `交卷（${counts.answered}／${counts.total}）`;
    element('submitted').hidden = !submitted;
    restart.hidden = round.status !== 'open'; restart.disabled = readOnly || Boolean(pending) || stopped;
    unsure.hidden = retired || (submitted && !q?.unsure); unsure.disabled = !editable() || !q?.choice;
    unsure.textContent = submitted ? '已標不確定' : '不確定'; unsure.setAttribute('aria-pressed', String(Boolean(q?.unsure)));
    element<HTMLButtonElement>('previous').disabled = submitting || !q || round.position === 0;
    element<HTMLButtonElement>('next').disabled = submitting || !q || round.position === counts.total - 1 || (!submitted && !retired && !q.choice);
    const numbers = element('numbers');
    const focusedNumber = document.activeElement instanceof HTMLButtonElement && numbers.contains(document.activeElement) ? document.activeElement.textContent : null;
    numbers.replaceChildren(...officialRoundNumbers(round, catalog.questions).map((item) => {
      const button = Object.assign(document.createElement('button'), { type: 'button', textContent: String(item.number), disabled: submitting });
      button.dataset.status = item.state; button.dataset.unsure = String(item.unsure);
      if (item.current) button.setAttribute('aria-current', 'step');
      const label = { correct: '答對', wrong: '答錯', unavailable: '解析不可用', unsure: '已答，標記不確定', answered: '已答', unanswered: '未答' }[item.state];
      button.setAttribute('aria-label', `第 ${item.number} 題，${label}${item.unsure ? '，曾標記不確定' : ''}`);
      button.addEventListener('click', () => { if (!desktop.matches) panel.open = false; navigation?.go(item.position); });
      return button;
    }));
    // 保存會重建題號按鈕，依原考卷題號還原焦點，避免鍵盤導覽中斷。
    if (focusedNumber !== null) Array.from(numbers.querySelectorAll('button')).find((button) => button.textContent === focusedNumber)?.focus({ preventScroll: true });
    const legend = submitted ? [['correct', '答對'], ['wrong', '答錯'], ['outlined', '曾標不確定'], ['unavailable', '解析不可用']] : [['unanswered', '未答'], ['answered', '已答'], ['unsure', '不確定']];
    element('legend').replaceChildren(...legend.map(([state, label]) => { const span = document.createElement('span'); const swatch = document.createElement('i'); swatch.dataset.status = state; swatch.setAttribute('aria-hidden', 'true'); span.append(swatch, label); return span; }));
    element('practice').hidden = cards.length === 0;
    element('empty').hidden = round.status !== 'open' || cards.length > 0;
    element('score').hidden = !submitted;
    if (submitted && round.submission) {
      const score = officialRoundScore(round.submission);
      text('score-heading', score.answerText); text('score-points', score.scoreText ?? '');
      try { element('review-action').replaceChildren(actionElement(officialRoundReviewAction(catalog.id, readOfficialRounds().rounds)), historyLink()); }
      catch (cause) { element('review-action').replaceChildren(historyLink()); error(cause, '紀錄清單無法讀取，原資料已保留。', () => location.reload()); }
    }
    element('retired').hidden = !retired;
    if (retired) text('retired-summary', officialRetiredSummary(round));
    displayCards(); showTime();
  };
  const finishSubmission = () => {
    if (!round || readOnly || stopped) return;
    settle(); started = null;
    try {
      pending ??= round.status === 'submitting' ? round : prepareOfficialSubmission(round, new Map([...allCards].map(([id, card]) => [id, card.dataset.answer!])), new Date().toISOString(), () => crypto.randomUUID());
      const result = submitOfficialRound(round, pending); round = result.round; expected = { ...round }; savedContent = JSON.stringify(round);
      if (result.error) { error(result.error); render(); return; }
      pending = undefined; clearError(); stop(); render(); text('status', '已交卷。現在可以逐題檢討。');
      element('score').focus({ preventScroll: true }); element('score').scrollIntoView({ block: 'start', behavior: 'instant' });
    } catch (cause) { error(cause); render(); }
  };
  const checkCurrent = () => {
    if (!round || !expected || (round.status === 'submitted' || round.status === 'retired') || readOnly || stopped) return;
    try {
      const current = readOfficialRounds().rounds.find((item) => item.id === expected!.id && item.setId === expected!.setId);
      if (!current || current.seq !== expected.seq || current.status === 'retired') throw new DailyConflictError();
    } catch (cause) { readOnly = true; started = null; error(cause); render(); }
  };
  element('retry').addEventListener('click', () => {
    if (retryAction) { retryAction(); return; }
    if (pending || round?.status === 'submitting') finishSubmission();
    else { settle(); persist(); render(); }
  });
  try {
    const store = readOfficialRounds();
    if (roundId === null) { renderList(); }
    else {
      round = store.rounds.find((item) => item.id === roundId && item.setId === catalog.id);
      if (!round) { text('status', '找不到這次作答'); return; }
      expected = { ...round };
      const resolved = reconcileOfficialRound(round, catalog.questions); round = resolved.round;
      text('status', resolved.skipped ? `${resolved.skipped} 題已移除或改版，已略過，不補題。` : round.status === 'submitting' ? '正在恢復交卷…' : round.status === 'submitted' ? '唯讀檢討・不能改答' : round.status === 'retired' ? '唯讀紀錄・不能改答' : '先保存答案，交卷後一起檢討。');
      const heading = document.querySelector('h1'); if (heading) heading.textContent = catalog.title;
      document.title = catalog.title;
      cards = round.questions.map((q) => {
        const card = allCards.get(q.id);
        if (card && availableOfficialQuestion(q, catalog.questions, round!)) { card.dataset.mode = round!.attemptMode; return card; }
        const missing = document.createElement('article'); missing.className = 'exam-unavailable'; missing.textContent = round!.status === 'retired' ? '題目已更新，無法顯示。' : '解析不可用。題目已移除或改版，這次成績維持交卷時的紀錄。'; missing.hidden = true; return missing;
      });
      container.replaceChildren(...cards);
      const requested = Number(new URL(location.href).searchParams.get('position')) - 1;
      if (round.status === 'retired') {
        const positions = officialRoundPositions(round);
        round.position = positions.includes(requested) ? requested : positions.includes(round.position) ? round.position : 0;
        if (resolved.unavailable.length) text('status', `${resolved.unavailable.length} 題已移除或改版，無法顯示題目；其他題照常查看。`);
      } else round.position = dailyPosition(round, requested);
      // 初始導覽與失效題過濾只改記憶體；開頁本身不寫入。
      savedContent = JSON.stringify(round);
      let initial = true;
      if (cards.length) navigation = initQuestionNavigation({ prefix: 'official', cards, position: round.position, heading: element('question-heading'),
        canVisit: (target, current) => Boolean(round && !pending && officialRoundCanVisit(round, target, current, initial)),
        nextPosition: (position) => round!.status === 'retired' ? Math.min(position + 1, cards.length - 1) : dailyNext(round!, position), onLeave: settle,
        onShow: (position) => { round!.position = position; if (!initial) persist(); initial = false; started = editable() && !document.hidden ? performance.now() : null; render(); } });
      else render();
      if (round.status === 'submitting') finishSubmission();
    }
  } catch (cause) { text('status', '無法載入考古題作答紀錄。'); error(cause, '原資料已保留。', () => location.reload()); return; }
  container.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !editable() || !round) return;
    settle(); round.questions[round.position].choice = input.value as Choice; persist(); render();
  });
  unsure.addEventListener('click', () => {
    if (!round || !editable() || !round.questions[round.position]?.choice) return;
    settle(); round.questions[round.position].unsure = !round.questions[round.position].unsure; persist(); render();
  });
  submit.addEventListener('click', () => {
    if (!round || !editable() || !officialRoundSubmitEnabled(round, failures)) return;
    text('dialog-count', `不確定 ${dailyCounts(round).unsure} 題`); dialog.showModal(); element('cancel').focus();
  });
  element('cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (round?.status === 'open' && !readOnly) submit.focus({ preventScroll: true }); });
  element('confirm').addEventListener('click', () => { dialog.close(); finishSubmission(); });
  restart.addEventListener('click', () => {
    if (!round || !editable()) return;
    settle(); started = null; restartDialog.showModal(); element('restart-cancel').focus();
  });
  element('restart-cancel').addEventListener('click', () => restartDialog.close());
  restartDialog.addEventListener('close', () => {
    if (!stopped && !readOnly && round?.status === 'open') { started = !document.hidden ? performance.now() : null; restart.focus({ preventScroll: true }); }
  });
  element('restart-confirm').addEventListener('click', () => {
    if (!round || !expected || readOnly || stopped || round.status !== 'open') return;
    try {
      const questions = currentQuestions();
      if (!questions.length) throw new Error('這份題組目前沒有可作答的題目。');
      const latest = latestOfficialRound(round, expected, catalog.questions);
      const opened = restartOfficialRound(expected, latest, crypto.randomUUID(), new Date().toISOString(), questions);
      stop(); restartDialog.close(); location.href = url(opened.id);
    } catch (cause) { restartDialog.close(); error(cause, '尚未重新開始。', () => restart.click(), 'restart'); render(); }
  });
  panel.addEventListener('toggle', () => { panel.querySelector('summary')!.setAttribute('aria-expanded', String(panel.open)); text('panel-toggle', panel.open ? '收合' : '展開'); });
  panel.open = desktop.matches;
  desktop.addEventListener('change', () => {
    const focused = document.activeElement;
    panel.open = desktop.matches;
    if (!panel.open && panel.contains(focused)) panel.querySelector('summary')!.focus({ preventScroll: true });
    else if (panel.open && focused === panel.querySelector('summary')) panel.querySelector<HTMLButtonElement>('[aria-current]')?.focus({ preventScroll: true });
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== OFFICIAL_ROUND_KEY && event.key !== null) return;
    if (roundId === null) { try { renderList(); } catch (cause) { error(cause); } }
    else { checkCurrent(); if (round?.status === 'submitted') render(); }
  });
  document.addEventListener('visibilitychange', () => { settle(); persist(); if (!document.hidden) checkCurrent(); render(); });
  if (round?.status === 'open' && !stopped) {
    timer = window.setInterval(showTime, 1000);
    saveTimer = window.setInterval(() => { if (!document.hidden && editable()) { settle(); persist(); render(); } }, 15_000);
  }
  window.addEventListener('pagehide', () => { if (stopped) return; settle(); persist(); window.clearInterval(timer); window.clearInterval(saveTimer); started = null; });
  // 返回快取一律重新讀網址與儲存資料，避免舊頁復活已刪或已交卷的輪次。
  window.addEventListener('pageshow', (event) => { if (event.persisted) { stopped = true; started = null; location.reload(); } });
}
