/** 每日流程組裝狀態與互動；保存一律透過 attempts，題卡及導覽沿用共用函式。 */
import { assertBookletCurrent, DailyConflictError, BOOKLET_KEY, getAttempts, readBookletStore, openBooklet, saveBooklet, submitBooklet, retireBooklet, type Choice, type Booklet, type BookletRef, type BookletStore } from './attempts';
import { dailyFreeCount, selectDailyQuestions, taipeiDate, type DailyQuestion, type DailySubject, type DuplicateGroups } from './daily';
import { availableDailyQuestion, bookletExclusions, bookletOpenLabel, bookletPageState, bookletPartialNote, bookletProgramNotice, bookletProgress, bookletRows, createBooklet, dailyCounts, dailyNext, dailyNumbers, dailyNumberState, dailyPosition, legacyRecords, prepareBookletSubmission, reconcileBooklet } from './daily-exam';
import { ensureBookletStore } from './booklet-migration';
import { displayQuestionCard } from './question-card-display';
import { initQuestionNavigation } from './question-set-client';

export async function initDaily(): Promise<void> {
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById('daily-' + id) as T;
  const text = (id: string, value: string) => { element(id).textContent = value; };
  const subject: DailySubject = new URL(location.href).searchParams.get('subject') === '3' ? 3 : 1;
  const catalog: DailyQuestion[] = JSON.parse(element('catalog').textContent ?? '[]');
  const groups: DuplicateGroups = JSON.parse(element('groups').textContent ?? '[]');
  const bookId = new URL(location.href).searchParams.get('book');
  const viewing = bookId !== null;
  let store: BookletStore;
  const container = element('cards');
  // 題卡保留於記憶體，只有目前題本的卡片會進入作答區。
  const allCards = new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-question]')).map((card) => [card.dataset.qid!, card]));
  container.replaceChildren();
  const submit = element<HTMLButtonElement>('submit');
  const unsure = element<HTMLButtonElement>('unsure');
  const dialog = element<HTMLDialogElement>('dialog');
  let draft: Booklet | undefined;
  let expected: BookletRef | undefined;
  let pending: Booklet | undefined;
  let readOnly = viewing;
  let retryAction: (() => void) | undefined;
  let opening = false;
  let failed = false;
  let started: number | null = null;
  let navigation: ReturnType<typeof initQuestionNavigation> | undefined;
  let cards: HTMLElement[] = [];
  let timer: number | undefined;
  let saveTimer: number | undefined;
  const error = (cause: unknown, action: 'save' | 'open' | 'retire' = 'save', retry?: () => void) => {
    failed = true;
    retryAction = retry;
    if (cause instanceof DailyConflictError) { readOnly = true; started = null; for (const id of ['open-first', 'open-next', 'retire-book']) element<HTMLButtonElement>(id).disabled = true; }
    const lead = action === 'open' ? '題本尚未建立，原本的題本不變。' : action === 'retire' ? '這本尚未結束。' : '尚未保存，畫面上的答案仍保留。';
    text('error-message', readOnly ? String(cause instanceof Error ? cause.message : cause) : lead + String(cause instanceof Error ? cause.message : cause));
    text('retry', action === 'save' ? '重試保存' : '重試');
    element('save-error').hidden = false; element('retry').hidden = readOnly; element('reload').hidden = !readOnly;
  };
  const clearError = () => { failed = false; retryAction = undefined; element('save-error').hidden = true; };
  const editable = () => draft?.status === 'open' && cards.length > 0 && !pending && !readOnly;
  const canVisit = (target: number, current: number) => Boolean(draft && (!pending || target === current) && dailyNumbers(draft).includes(target) && (draft.status === 'submitted' || Boolean(draft.questions[current]?.choice) || target <= current));
  const settle = () => {
    if (!draft) return;
    const now = performance.now(); const q = draft.questions[draft.position];
    if (started !== null && editable() && q && !q.legacyAttemptId) q.ms += Math.max(0, Math.round(now - started));
    started = editable() && !document.hidden ? now : null;
  };
  const persist = () => {
    if (!draft || !expected || !editable()) return;
    try { draft = saveBooklet(draft, expected); expected = draft; store = readBookletStore()!; clearError(); }
    catch (cause) { error(cause); }
  };
  const showTime = () => {
    if (!draft) return;
    const q = draft.questions[draft.position];
    const ms = draft.questions.reduce((sum, item) => sum + item.ms, 0) + (started !== null && editable() && q && !q.legacyAttemptId ? performance.now() - started : 0);
    const seconds = Math.floor(ms / 1000); text('time', `累計用時 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  };
  const displayCards = () => cards.forEach((card, index) => {
    const q = draft!.questions[index]; if (!availableDailyQuestion(q, catalog, subject)) return;
    displayQuestionCard(card, { choice: q.choice, locked: !editable() || Boolean(q.legacyAttemptId), reveal: draft!.status === 'submitted', correct: q.correct, saved: draft!.status === 'submitted' });
  });
  const currentUrl = (id?: string) => '/daily/?subject=' + subject + (id ? '&book=' + encodeURIComponent(id) : '');
  const freeCount = (target: DailySubject) => dailyFreeCount(catalog, getAttempts(), target, bookletExclusions(store, groups));
  const renderOverview = () => {
    const today = taipeiDate(new Date());
    const free = freeCount(subject);
    const state = bookletPageState(store, subject, free.free, catalog);
    const progress = bookletProgress(store, subject, today, free);
    element('metrics').hidden = false;
    const shownCounts = progress.total ? progress : draft?.status === 'submitted' ? dailyCounts(draft) : null;
    text('metric-answered', shownCounts ? String(shownCounts.answered) : state.kind === 'retire' ? '0／0' : store.booklets.some((b) => b.subject === subject) ? '目前無題本' : '尚未開本');
    if (shownCounts) element('metric-answered').append(Object.assign(document.createElement('small'), { textContent: '／' + shownCounts.total }));
    element('metric-answered').classList.toggle('is-text', !shownCounts);
    text('metric-today', String(progress.todaySubmitted)); element('metric-today').append(Object.assign(document.createElement('small'), { textContent: '題' }));
    text('metric-free', String(progress.fullBooks)); element('metric-free').append(Object.assign(document.createElement('small'), { textContent: '本' }));
    if (progress.lastBook) { const tail = document.createElement('small'); tail.className = 'booklet-tail'; tail.textContent = '另 1 本 ' + progress.lastBook + ' 題'; element('metric-free').append(tail); }
    for (const link of document.querySelectorAll<HTMLElement>('[data-daily-subject]')) {
      const target: DailySubject = link.dataset.dailySubject === '3' ? 3 : 1;
      const targetState = bookletPageState(store, target, freeCount(target).free, catalog);
      if (target === subject) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      const caption = link.querySelector('[data-subject-progress]')!;
      caption.replaceChildren();
      if (targetState.kind === 'resume') {
        const b = target === subject && draft?.status === 'open' ? draft : targetState.booklet;
        for (const label of ['第 ' + b.number + ' 本作答中', '已答 ' + dailyCounts(b).answered + '／' + b.questions.length]) caption.append(Object.assign(document.createElement('span'), { textContent: label }));
      } else caption.textContent = targetState.kind === 'review' ? '第 ' + targetState.booklet.number + ' 本' + (targetState.booklet.status === 'retired' ? '已結束' : '已交卷') : targetState.kind === 'retire' ? '題目已失效・需結束題本' : targetState.kind === 'first' ? '尚未開本' : '未做題已用完';
    }
    for (const id of ['current', 'score', 'empty', 'stock', 'retire', 'next-book', 'partial-note', 'code-note']) element(id).hidden = true;
    element('stock-review').hidden = !store.booklets.some((b) => b.subject === subject && b.status === 'submitted');
    element('readonly').hidden = !viewing;
    element<HTMLAnchorElement>('return').href = currentUrl();
    const next = 'next' in state ? state.next : 0;
    const partial = next > 0 && next < 50;
    if (!viewing) {
      if (state.kind === 'resume') {
        element('current').hidden = false;
        text('current-title', '第 ' + state.booklet.number + ' 本作答中');
        text('current-note', '建立於 ' + state.booklet.createdDate + '・' + state.booklet.questions.length + ' 題。隔天仍接續這一本。');
      } else if (state.kind === 'review') {
        element('score').hidden = false;
        text('result-number', '第 ' + state.booklet.number + ' 本・' + (state.booklet.status === 'retired' ? '已結束' : '已交卷'));
        if (state.booklet.status === 'retired') { text('score-heading', '第 ' + state.booklet.number + ' 本已結束'); text('score-points', ''); }
        element('next-book').hidden = next === 0;
        text('open-next', bookletOpenLabel(true, next) ?? '');
        text('next-note', partial ? '保留實際題數，不補入做過的題。' : '可再開 ' + free.fullBooks + ' 本，每本 50 題。' + (free.lastBook ? '另 1 本 ' + free.lastBook + ' 題。' : ''));
        element('result-note').hidden = state.booklet.status === 'retired';
        element('stock').hidden = next !== 0;
      } else if (state.kind === 'first') {
        element('empty').hidden = false; text('open-first', bookletOpenLabel(false, next)!);
        element('first-note').hidden = !partial;
        text('first-note', partial ? '保留實際題數，不補入做過的題。' : '');
      } else element(state.kind === 'retire' ? 'retire' : 'stock').hidden = false;
    } else if (draft) text('readonly-title', '科目 ' + subject + '・第 ' + draft.number + ' 本');
    if (draft && draft.status !== 'retired') {
      const partialNote = bookletPartialNote(draft);
      if (partialNote) { element('partial-note').hidden = false; text('partial-note', partialNote); }
      const notice = bookletProgramNotice(draft, catalog);
      if (notice) { element('code-note').hidden = false; text('code-note', notice.message); }
      if (draft.status === 'submitted') {
        element('score').hidden = false; text('result-number', '第 ' + draft.number + ' 本・已交卷');
        text('score-heading', '答對 ' + draft.submission!.correct + '／' + draft.submission!.total + ' 題');
        text('score-points', draft.submission!.correct * 2 + ' 分／' + draft.submission!.total * 2 + ' 分' + (draft.submission!.total === 50 ? '・每題 2 分' : '・不是正式考試換算'));
      }
    }
    const rows = element('rows'); rows.replaceChildren();
    const appendRow = (values: (string | HTMLElement)[], head = false, current = false) => {
      const row = document.createElement('div'); row.className = 'booklet-row' + (head ? ' booklet-table-head' : '') + (current ? ' booklet-row-current' : ''); row.setAttribute('role', 'row');
      for (const value of values) { const cell = document.createElement('div'); cell.setAttribute('role', head ? 'columnheader' : 'cell'); cell.append(value); row.append(cell); } rows.append(row);
    };
    const historyRows = bookletRows(store, subject).reverse();
    element('history').hidden = historyRows.length === 0;
    if (historyRows.length) appendRow(['題本／建立日期', '狀態', '題數', '作答結果', '操作'], true);
    for (const row of historyRows) {
      const name = document.createElement('div'); name.append(Object.assign(document.createElement('strong'), { textContent: '第 ' + row.number + ' 本' }), Object.assign(document.createElement('time'), { textContent: row.createdDate, dateTime: row.createdDate }));
      const status = document.createElement('span'); status.className = 'booklet-status' + (row.answered !== undefined ? ' is-open' : ''); status.textContent = row.statusLabel;
      let action: string | HTMLElement = '';
      if (row.canReview || row.answered !== undefined) { const link = document.createElement('a'); link.className = 'booklet-row-action'; link.href = row.canReview ? currentUrl(row.id) : currentUrl(); link.textContent = row.canReview ? '回看檢討 →' : '繼續作答 →'; action = link; }
      appendRow([name, status, row.total + ' 題', row.correct !== undefined ? '答對 ' + row.correct + '／' + row.total : row.answered !== undefined ? '已答 ' + row.answered + '／' + row.total : '', action], false, row.id === store.current[subject]);
    }
    const records = legacyRecords(store, getAttempts());
    element('legacy-records').hidden = records.length === 0;
    element('legacy-rows').replaceChildren(...records.map((record) => { const row = document.createElement('div'); row.className = 'booklet-legacy-row'; for (const label of [record.date, '科目 ' + record.subject, '已答 ' + record.answered + ' 題', '答對 ' + record.correct + ' 題']) row.append(Object.assign(document.createElement('span'), { textContent: label })); return row; }));
    return state;
  };
  const render = () => {
    renderOverview();
    if (!draft) return;
    const { answered, unsure: count, total } = dailyCounts(draft); const submitted = draft.status === 'submitted';
    text('position', `第 ${draft.position + 1}／${total} 題`); text('question-heading', `第 ${draft.position + 1} 題`);
    text('progress', `這本已答 ${answered}／${total}`); text('unsure-count', `不確定 ${count}`);
    const bar = element<HTMLProgressElement>('progress-bar'); bar.max = Math.max(1, total); bar.value = answered;
    submit.hidden = submitted; element('submitted').hidden = !submitted;
    submit.disabled = !editable() || answered !== total || !total || failed; submit.textContent = answered === total ? '交卷' : `交卷（${answered}／${total}）`;
    const q = draft.questions[draft.position];
    unsure.hidden = submitted && !q?.unsure; unsure.disabled = !editable() || !q?.choice;
    unsure.textContent = submitted ? '已標不確定' : '不確定'; unsure.setAttribute('aria-pressed', String(Boolean(q?.unsure)));
    const submitting = Boolean(pending) || draft.status === 'submitting';
    element<HTMLButtonElement>('previous').disabled = submitting || !total || draft.position === 0;
    element<HTMLButtonElement>('next').disabled = submitting || !total || draft.position === total - 1 || (!submitted && !q?.choice);
    const numbers = element('numbers'); numbers.replaceChildren();
    for (const index of dailyNumbers(draft)) {
      const item = draft.questions[index]; const state = dailyNumberState(draft, index, availableDailyQuestion(item, catalog, subject));
      const button = document.createElement('button'); button.type = 'button'; button.textContent = String(index + 1); button.dataset.status = state; button.dataset.unsure = String(submitted && item.unsure);
      button.disabled = submitting;
      const label = ({ correct: '答對', wrong: '答錯', unavailable: '已移除或改版', unsure: '已答，標記不確定', answered: '已答', unanswered: '未答' })[state];
      button.setAttribute('aria-label', `第 ${index + 1} 題，${label}${submitted && item.unsure ? '，曾標記不確定' : ''}`);
      if (index === draft.position) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => {
        if (!navigation || !canVisit(index, navigation.current())) return;
        // 先收合再導覽，讓題目標題在收合後取得焦點並定位。
        if (!desktopPanel.matches) panel.open = false;
        navigation.go(index);
      }); numbers.append(button);
    }
    const legend = element('legend'); legend.replaceChildren();
    for (const [state, label] of submitted ? [['correct', '答對'], ['wrong', '答錯'], ['outlined', '曾標不確定'], ['unavailable', '解析不可用']] : [['unanswered', '未答'], ['answered', '已答'], ['unsure', '不確定']]) {
      const span = document.createElement('span'); const swatch = document.createElement('i'); swatch.dataset.status = state; swatch.setAttribute('aria-hidden', 'true'); span.append(swatch, label); legend.append(span);
    }
    element('legacy').hidden = !draft.questions.some((item) => item.legacyAttemptId);
    showTime();
  };
  // 提交中斷時保留同一份 prepared；儲存層依固定作答 ID 去重。
  const finishSubmission = () => {
    if (!draft || readOnly) return; settle(); started = null;
    try {
      const resolved = reconcileBooklet(draft, catalog);
      if (resolved.skipped) { draft = saveBooklet(resolved.booklet, expected!); expected = draft; text('status', resolved.skipped + ' 題已移除或改版，已略過，不補題。'); }
      if (draft.questions.length === 0) { store = readBookletStore()!; element('practice').hidden = true; cards = []; render(); return; }
      pending ??= draft.status === 'submitting' ? draft : prepareBookletSubmission(draft, new Map(cards.map((card) => [card.dataset.qid!, card.dataset.answer!])), new Date().toISOString(), () => crypto.randomUUID());
      const result = submitBooklet(draft, pending); draft = result.booklet; expected = draft;
      store = readBookletStore()!;
      if (result.error) { error(result.error); displayCards(); render(); return; }
      pending = undefined; clearError(); displayCards(); render();
      if (store.current[subject]) { location.href = currentUrl(draft.id); return; }
      element('score').focus({ preventScroll: true }); element('score').scrollIntoView({ block: 'start', behavior: 'instant' });
    } catch (cause) { error(cause); displayCards(); render(); }
  };
  const recoverSubmissions = () => {
    for (const b of store.booklets.filter((item) => item.status === 'submitting')) {
      const result = submitBooklet(b, b);
      if (result.error) throw result.error;
    }
    store = readBookletStore()!;
  };
  const panel = element<HTMLDetailsElement>('panel');
  const desktopPanel = window.matchMedia('(min-width: 1100px)');
  try {
    if (viewing) {
      // 回看完全唯讀，連遷移、修復及計時保存都不啟動。
      store = readBookletStore() ?? { version: 2, migratedAt: null, current: { '1': null, '3': null }, booklets: [] };
      const found = store.booklets.find((b) => b.id === bookId);
      if (!found || found.subject !== subject || found.status !== 'submitted') {
        element('readonly').hidden = false; element<HTMLAnchorElement>('return').href = currentUrl();
        text('readonly-title', !found ? '找不到這本題本' : found.subject !== subject ? '這本題本不屬於目前科目' : '這本題本尚未交卷，不能回看'); text('status', '請返回目前題本。'); return;
      }
      draft = found; text('status', '');
    } else {
      const outcome = await ensureBookletStore({ catalog, groups, now: () => new Date(), locks: navigator.locks });
      if (outcome.status === 'error') { text('status', outcome.message); return; }
      store = outcome.store;
      try { recoverSubmissions(); }
      catch (cause) { error(cause); text('status', '交卷尚未完成，請重試。'); element('retry').addEventListener('click', () => location.reload()); return; }
      let skipped = 0;
      for (const target of [1, 3] as const) {
        const b = store.booklets.find((item) => item.id === store.current[target]);
        if (b?.status !== 'open') continue;
        const resolved = reconcileBooklet(b, catalog);
        if (resolved.skipped || resolved.booklet.questions.length === 0) {
          saveBooklet(resolved.booklet, b); store = readBookletStore()!;
          if (target === subject) skipped += resolved.skipped;
        }
      }
      const state = bookletPageState(store, subject, freeCount(subject).free, catalog);
      draft = 'booklet' in state ? state.booklet : undefined;
      text('status', skipped ? skipped + ' 題已移除或改版，已略過，不補題。' : '');
    }
    expected = draft;
    if (draft) {
      cards = draft.status === 'retired' ? [] : draft.questions.map((q) => {
        if (availableDailyQuestion(q, catalog, subject) && allCards.has(q.id)) return allCards.get(q.id)!;
        const missing = document.createElement('article'); missing.className = 'daily-unavailable'; missing.textContent = '已移除或改版，解析目前不可用。本次成績維持交卷時的紀錄。'; missing.hidden = true; return missing;
      });
      container.replaceChildren(...cards);
      text('date', draft.createdDate + ' 建立・科目 ' + subject + '・第 ' + draft.number + ' 本');
      const requested = Number(new URL(location.href).searchParams.get('position')) - 1;
      draft.position = dailyPosition(draft, requested); displayCards();
    }
    element('practice').hidden = cards.length === 0;
    if (cards.length && draft) navigation = initQuestionNavigation({ prefix: 'daily', cards, position: draft.position, heading: element('question-heading'), canVisit,
      nextPosition: (current) => dailyNext(draft!, current), onLeave: settle,
      onShow: (position) => { draft!.position = position; persist(); started = editable() && !document.hidden ? performance.now() : null; displayCards(); render(); } });
    else render();
  } catch (cause) {
    text('status', '無法載入每日題本：' + String(cause instanceof Error ? cause.message : cause));
    element('practice').hidden = true; error(cause);
    element('retry').addEventListener('click', () => location.reload()); return;
  }
  container.addEventListener('change', (event) => {
    const input = event.target; if (!(input instanceof HTMLInputElement) || !editable()) return;
    const q = draft!.questions[draft!.position]; if (q.legacyAttemptId) return;
    settle(); q.choice = input.value as Choice; persist(); displayCards(); render();
  });
  unsure.addEventListener('click', () => { const q = draft?.questions[draft.position]; if (!editable() || !q?.choice) return; settle(); q.unsure = !q.unsure; persist(); render(); });
  submit.addEventListener('click', () => {
    if (!draft) return;
    const count = dailyCounts(draft); if (!editable() || count.answered !== count.total || !count.total || failed) return;
    text('dialog-count', `不確定 ${count.unsure} 題`); dialog.showModal(); element('cancel').focus();
  });
  dialog.addEventListener('close', () => { if (draft?.status !== 'submitted') submit.focus({ preventScroll: true }); });
  element('cancel').addEventListener('click', () => dialog.close());
  element('confirm').addEventListener('click', () => { submit.disabled = true; dialog.close(); finishSubmission(); });
  element('retry').addEventListener('click', () => { const action = retryAction; retryAction = undefined; if (action) { action(); return; } if (pending || draft?.status === 'submitting') finishSubmission(); else { settle(); persist(); displayCards(); render(); } });
  panel.addEventListener('toggle', () => { panel.querySelector('summary')!.setAttribute('aria-expanded', String(panel.open)); text('panel-toggle', panel.open ? '收合' : '展開'); });
  panel.open = desktopPanel.matches;
  const summary = panel.querySelector('summary')!;
  let summaryFocused = false;
  summary.addEventListener('focus', () => { summaryFocused = true; });
  // 桌面樣式會在寬度事件前隱藏開關，先保留因此失去的焦點。
  summary.addEventListener('blur', () => { if (!desktopPanel.matches) summaryFocused = false; });
  desktopPanel.addEventListener('change', () => {
    const focused = document.activeElement;
    const focusInPanel = panel.contains(focused) && focused !== summary;
    const focusOnSummary = focused === summary || summaryFocused;
    summaryFocused = false;
    panel.open = desktopPanel.matches;
    // 寬度改變會隱藏題號或開關，將焦點留在仍可操作的選單位置。
    if (!panel.open && focusInPanel) {
      summary.focus({ preventScroll: true });
      const bounds = summary.getBoundingClientRect();
      const top = Math.max(0, document.querySelector('.daily-toolbar')!.getBoundingClientRect().bottom);
      const bottom = Math.min(window.innerHeight, document.querySelector('.daily-actions')!.getBoundingClientRect().top);
      // 只有開關被固定列遮住或超出畫面時才捲動，保留原本可見的位置。
      if (bounds.top < top || bounds.bottom > bottom) summary.scrollIntoView({ block: 'center', behavior: 'instant' });
    } else if (panel.open && focusOnSummary) {
      const current = panel.querySelector<HTMLButtonElement>('[aria-current="step"]:not(:disabled)');
      const retry = element('retry');
      const target = current ?? (retry.checkVisibility() ? retry : element('question-heading'));
      target.focus({ preventScroll: true });
    }
  });
  const openNext = () => {
    if (readOnly || opening) return;
    opening = true;
    try {
      const today = taipeiDate(new Date());
      const opened = openBooklet(subject, ({ store: latest, attempts }) => {
        const picked = selectDailyQuestions(catalog, attempts, subject, today, Math.random, bookletExclusions(latest, groups));
        return picked.selected.length ? createBooklet({ store: latest, subject, date: today, id: crypto.randomUUID(), selected: picked.selected }) : null;
      });
      if (opened) { location.href = currentUrl(); return; }
      store = readBookletStore()!; clearError(); render();
    } catch (cause) { error(cause, 'open', openNext); displayCards(); render(); }
    finally { opening = false; }
  };
  element('open-first').addEventListener('click', openNext);
  element('open-next').addEventListener('click', openNext);
  const retireCurrent = () => {
    if (!draft || !expected || readOnly) return;
    try { retireBooklet(draft, expected); location.href = currentUrl(); }
    catch (cause) { error(cause, 'retire', retireCurrent); }
  };
  element('retire-book').addEventListener('click', retireCurrent);
  const checkCurrent = () => {
    if (viewing || readOnly) return;
    try {
      if (expected && (draft?.status === 'open' || draft?.status === 'submitting')) store = assertBookletCurrent(expected);
      else {
        const latest = readBookletStore();
        if (!latest || latest.current[subject] !== store.current[subject] || (expected && latest.booklets.find((b) => b.id === expected!.id)?.seq !== expected.seq)) throw new DailyConflictError();
        store = latest;
      }
    } catch (cause) { readOnly = true; started = null; error(cause); displayCards(); render(); }
  };
  window.addEventListener('storage', (event) => { if (!viewing && (event.key === BOOKLET_KEY || event.key === null)) { checkCurrent(); render(); } });
  document.addEventListener('visibilitychange', () => { if (viewing) return; settle(); persist(); if (!document.hidden) checkCurrent(); displayCards(); render(); });
  const startTimer = () => {
    timer = window.setInterval(showTime, 1000);
    // 保存排程與顯示排程分開；只有可見的作答中題本會寫入。
    saveTimer = window.setInterval(() => { if (!document.hidden && editable()) { settle(); persist(); displayCards(); render(); } }, 15_000);
  };
  if (!viewing) startTimer();
  window.addEventListener('pagehide', () => { if (viewing) return; settle(); persist(); window.clearInterval(timer); window.clearInterval(saveTimer); });
  window.addEventListener('pageshow', (event) => { if (!viewing && event.persisted) { checkCurrent(); started = editable() && !document.hidden ? performance.now() : null; startTimer(); } });
}
