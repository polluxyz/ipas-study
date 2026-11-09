/** 每日流程組裝狀態與互動；保存一律透過 attempts，題卡及導覽沿用共用函式。 */
import { assertBookletCurrent, DailyConflictError, BOOKLET_KEY, STORAGE_KEY, getAttempts, readBookletStore, openBooklet, saveBooklet, submitBooklet, retireBooklet, discardBooklet, type Choice, type Booklet, type BookletRef, type BookletStore } from './attempts';
import { dailyFreeCount, selectDailyQuestions, taipeiDate, type DailyQuestion, type DailySubject, type DuplicateGroups } from './daily';
import { availableDailyQuestion, bookletExclusions, bookletPartialNote, bookletProgramNotice, canDiscardBooklet, catalogSection, createBooklet, dailyCounts, dailyNext, dailyNumbers, dailyNumberState, dailyPosition, dailyRoute, legacyRecords, prepareBookletSubmission, reconcileBooklet } from './daily-exam';
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
  let route: ReturnType<typeof dailyRoute> = { kind: 'catalog' };
  let viewing = false;
  let store: BookletStore;
  const container = element('cards');
  // 題卡保留於記憶體，只有目前題本的卡片會進入作答區。
  const allCards = new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-question]')).map((card) => [card.dataset.qid!, card]));
  container.replaceChildren();
  const submit = element<HTMLButtonElement>('submit');
  const unsure = element<HTMLButtonElement>('unsure');
  const dialog = element<HTMLDialogElement>('dialog');
  const discard = element<HTMLButtonElement>('discard');
  const discardDialog = element<HTMLDialogElement>('discard-dialog');
  let draft: Booklet | undefined;
  let expected: BookletRef | undefined;
  let savedContent: string | undefined;
  let skippedNotice = '';
  let pending: Booklet | undefined;
  let readOnly = false;
  let retryAction: (() => void) | undefined;
  let opening = false;
  let failed = false;
  let started: number | null = null;
  let navigation: ReturnType<typeof initQuestionNavigation> | undefined;
  let cards: HTMLElement[] = [];
  let timer: number | undefined;
  let saveTimer: number | undefined;
  // 放棄後頁面仍可能收到離頁事件；鎖住所有保存入口，避免復活已刪題本。
  let stopped = false;
  const error = (cause: unknown, action: 'save' | 'open' | 'retire' | 'discard' = 'save', retry?: () => void) => {
    failed = true;
    retryAction = retry;
    if (cause instanceof DailyConflictError) {
      readOnly = true; started = null;
      for (const id of ['retire-book', 'discard', 'discard-confirm']) element<HTMLButtonElement>(id).disabled = true;
      for (const button of document.querySelectorAll<HTMLButtonElement>('[data-open-subject]')) button.disabled = true;
      if (discardDialog.open) discardDialog.close();
    }
    const lead = action === 'open' ? '題本尚未建立，原本的題本不變。' : action === 'retire' ? '這本尚未結束。' : action === 'discard' ? '這本尚未放棄。' : '尚未保存，畫面上的答案仍保留。';
    text('error-message', readOnly ? String(cause instanceof Error ? cause.message : cause) : lead + String(cause instanceof Error ? cause.message : cause));
    text('retry', action === 'save' ? '重試保存' : '重試');
    element('save-error').hidden = false; element('retry').hidden = readOnly; element('reload').hidden = !readOnly;
    if (action === 'open') element('save-error').scrollIntoView({ block: 'center', behavior: 'instant' });
  };
  const clearError = () => { failed = false; retryAction = undefined; element('save-error').hidden = true; };
  const editable = () => route.kind === 'resume' && draft?.status === 'open' && cards.length > 0 && !pending && !readOnly && !stopped;
  const discardable = () => {
    if (!draft || !expected || viewing || !editable() || failed || !canDiscardBooklet(draft)) return false;
    const current = store.booklets.find((booklet) => booklet.id === store.current[subject]);
    return current?.id === draft.id && current.seq === draft.seq && current.subject === subject &&
      expected.id === draft.id && expected.seq === draft.seq && expected.subject === subject;
  };
  const canVisit = (target: number, current: number) => Boolean(draft && (!pending || target === current) && dailyNumbers(draft).includes(target) && (draft.status === 'submitted' || Boolean(draft.questions[current]?.choice) || target <= current));
  const settle = () => {
    if (!draft) return;
    const now = performance.now(); const q = draft.questions[draft.position];
    if (started !== null && editable() && q && !q.legacyAttemptId) q.ms += Math.max(0, Math.round(now - started));
    started = editable() && !document.hidden ? now : null;
  };
  const persist = () => {
    // 確認框不寫草稿，取消時資料逐字不變；用時可在回到作答後繼續保存。
    if (!draft || !expected || !editable() || discardDialog.open) return;
    if (JSON.stringify(draft) === savedContent) return;
    // 保存後 draft 與 expected 共用物件；另存字串才能辨識後續原地修改，失敗時仍可重試。
    try { draft = saveBooklet(draft, expected); expected = draft; savedContent = JSON.stringify(draft); store = readBookletStore()!; clearError(); }
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
  // 作答損壞只阻擋抽新題；既有題本的答案與檢討不依賴作答紀錄。
  const readAttempts = () => { try { return getAttempts(); } catch { return null; } };
  const freeCount = (target: DailySubject) => {
    const attempts = readAttempts();
    return attempts === null ? null : dailyFreeCount(catalog, attempts, target, bookletExclusions(store, groups));
  };
  const renderCatalog = () => {
    // 目錄只在記憶體略過失效題，不能因顯示狀態而保存或恢復交卷。
    const displayStore = { ...store, booklets: store.booklets.map((booklet) => reconcileBooklet(booklet, catalog).booklet) };
    element('directory').hidden = false;
    element('footer').hidden = false;
    text('status', '');
    for (const target of [1, 3] as const) {
      const section = element('directory-' + target);
      const data = catalogSection(displayStore, target, taipeiDate(new Date()), freeCount(target));
      section.replaceChildren();
      const head = document.createElement('div'); head.className = 'booklet-section-head';
      const title = document.createElement('div');
      title.append(Object.assign(document.createElement('span'), { className: 'booklet-kicker', textContent: '科目 ' + target }));
      title.append(Object.assign(document.createElement('h2'), { id: 'daily-directory-heading-' + target, textContent: target === 1 ? '人工智慧技術應用與規劃' : '機器學習技術與應用' }));
      head.append(title);
      if (data.open.kind === 'button') {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'button primary';
        button.dataset.openSubject = String(target); button.textContent = data.open.label; button.disabled = readOnly || opening;
        button.addEventListener('click', () => openSubject(target)); head.append(button);
      }
      section.append(head);
      const metrics = document.createElement('dl'); metrics.className = 'booklet-catalog-metrics';
      const freeLabel = data.fullBooks === null ? '無法更新' : data.fullBooks + ' 本' + (data.lastBook ? '，另 1 本 ' + data.lastBook + ' 題' : '');
      for (const [label, value] of [['今日交卷', data.todaySubmitted + ' 題'], ['可再開', freeLabel]]) {
        const metric = document.createElement('div');
        metric.append(Object.assign(document.createElement('dt'), { textContent: label }), Object.assign(document.createElement('dd'), { textContent: value })); metrics.append(metric);
      }
      section.append(metrics);
      if (!data.rows.length) section.append(Object.assign(document.createElement('p'), { className: 'booklet-catalog-empty', textContent: '還沒有題本。' + (data.open.kind === 'button' ? '按下開本按鈕才會建立，重新整理不會換題。' : '') }));
      else {
        const rows = document.createElement('div'); rows.className = 'booklet-table'; rows.setAttribute('role', 'table'); rows.setAttribute('aria-label', '科目 ' + target + ' 題本');
        const appendRow = (values: (string | HTMLElement)[], header = false) => {
          const row = document.createElement('div'); row.className = 'booklet-row' + (header ? ' booklet-table-head' : ''); row.setAttribute('role', 'row');
          for (const value of values) { const cell = document.createElement('div'); cell.setAttribute('role', header ? 'columnheader' : 'cell'); cell.append(value); row.append(cell); } rows.append(row);
        };
        appendRow(['題本／建立日期', '狀態', '題數', '作答結果', '操作'], true);
        for (const row of data.rows) {
          const name = document.createElement('div'); name.append(Object.assign(document.createElement('strong'), { textContent: '第 ' + row.number + ' 本' }), Object.assign(document.createElement('time'), { textContent: row.createdDate, dateTime: row.createdDate }));
          const status = document.createElement('span'); status.className = 'booklet-status' + (row.action === 'resume' ? ' is-open' : ''); status.textContent = row.statusLabel;
          let action: string | HTMLElement = '';
          if (row.action) {
            const link = document.createElement('a'); link.className = 'booklet-row-action'; link.dataset.bookletId = row.id;
            link.href = '/daily/?subject=' + target + '&book=' + encodeURIComponent(row.id);
            link.textContent = { resume: '繼續作答 →', retire: '前往結束題本 →', review: '回看檢討 →' }[row.action]; action = link;
          }
          appendRow([name, status, row.total + ' 題', row.correct !== undefined ? '答對 ' + row.correct + '／' + row.total : row.answered !== undefined ? '已答 ' + row.answered + '／' + row.total : '', action]);
        }
        section.append(rows);
      }
      if (data.fullBooks === null || (data.open.kind === 'none' && data.open.reason === 'exhausted')) {
        section.append(Object.assign(document.createElement('p'), { className: 'booklet-catalog-note', textContent: data.fullBooks === null ? '作答紀錄無法辨識，暫時不能開新題本。' : '未做題已用完。已交卷的題本仍可回看，也可以到錯題本複習。' }));
      }
    }
    const records = legacyRecords(store, readAttempts() ?? []);
    element('legacy-records').hidden = records.length === 0;
    element('legacy-rows').replaceChildren(...records.map((record) => { const row = document.createElement('div'); row.className = 'booklet-legacy-row'; for (const label of [record.date, '科目 ' + record.subject, '已答 ' + record.answered + ' 題', '答對 ' + record.correct + ' 題']) row.append(Object.assign(document.createElement('span'), { textContent: label })); return row; }));
  };
  const openSubject = (target: DailySubject) => {
    if (readOnly || opening) return;
    opening = true;
    try {
      const today = taipeiDate(new Date());
      const opened = openBooklet(target, ({ store: latest, attempts }) => {
        const picked = selectDailyQuestions(catalog, attempts, target, today, Math.random, bookletExclusions(latest, groups));
        return picked.selected.length ? createBooklet({ store: latest, subject: target, date: today, id: crypto.randomUUID(), selected: picked.selected }) : null;
      });
      if (opened) { location.href = '/daily/?subject=' + target + '&book=' + encodeURIComponent(opened.id); return; }
      store = readBookletStore()!; clearError();
    } catch (cause) { error(cause, 'open', () => openSubject(target)); }
    finally { opening = false; renderCatalog(); }
  };
  const renderOverview = () => {
    for (const id of ['score', 'retire', 'partial-note', 'code-note']) element(id).hidden = true;
    element('readonly').hidden = !viewing;
    if (!draft) return;
    if (route.kind === 'retire') element('retire').hidden = false;
    if (viewing) text('readonly-title', '科目 ' + subject + '・第 ' + draft.number + ' 本');
    const partialNote = bookletPartialNote(draft);
    if (partialNote) { element('partial-note').hidden = false; text('partial-note', partialNote); }
    const notice = bookletProgramNotice(draft, catalog);
    if (notice) { element('code-note').hidden = false; text('code-note', notice.message); }
    if (draft.status === 'submitted') {
      element('score').hidden = false; text('result-number', '第 ' + draft.number + ' 本・已交卷');
      text('score-heading', '答對 ' + draft.submission!.correct + '／' + draft.submission!.total + ' 題');
      text('score-points', draft.submission!.correct * 2 + ' 分／' + draft.submission!.total * 2 + ' 分' + (draft.submission!.total === 50 ? '・每題 2 分' : '・不是正式考試換算'));
    }
  };
  const render = () => {
    renderOverview();
    discard.hidden = !discardable();
    if (!draft) return;
    const { answered, unsure: count, total } = dailyCounts(draft); const submitted = draft.status === 'submitted';
    text('position', `第 ${draft.position + 1}／${total} 題`); text('question-heading', `第 ${draft.position + 1} 題`);
    text('progress', `${submitted ? '已答' : '這本已答'} ${answered}／${total}`); text('unsure-count', `不確定 ${count}`);
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
      if (draft.questions.length === 0) { store = readBookletStore()!; route = dailyRoute(store, subject, bookId, catalog); element('practice').hidden = true; cards = []; render(); return; }
      pending ??= draft.status === 'submitting' ? draft : prepareBookletSubmission(draft, new Map(cards.map((card) => [card.dataset.qid!, card.dataset.answer!])), new Date().toISOString(), () => crypto.randomUUID());
      const result = submitBooklet(draft, pending); draft = result.booklet; expected = draft;
      store = readBookletStore()!;
      if (result.error) { error(result.error); displayCards(); render(); return; }
      pending = undefined; clearError(); displayCards(); render();
      // 同一本只加 hash 不會重載；先放入一次性標記，再載入唯讀檢討。
      history.replaceState(history.state, '', currentUrl(draft.id) + '#daily-score');
      location.reload();
    } catch (cause) { error(cause); displayCards(); render(); }
  };
  const recoverSubmissions = () => {
    const results = new Map<DailySubject, ReturnType<typeof submitBooklet>>();
    // 各科獨立恢復，讓一科寫入失敗時仍能完成另一科並接續作答。
    for (const b of store.booklets.filter((item) => item.status === 'submitting')) {
      const result = submitBooklet(b, b);
      results.set(b.subject, result);
    }
    store = readBookletStore()!;
    return results;
  };
  const panel = element<HTMLDetailsElement>('panel');
  const desktopPanel = window.matchMedia('(min-width: 1100px)');
  element('retry').addEventListener('click', () => { const action = retryAction; retryAction = undefined; if (action) { action(); return; } if (pending || draft?.status === 'submitting') finishSubmission(); else { settle(); persist(); displayCards(); render(); } });
  if (bookId !== null) { element('back').hidden = false; element<HTMLAnchorElement>('back').href = currentUrl(); }
  try {
    if (bookId === null) {
      const outcome = await ensureBookletStore({ catalog, groups, now: () => new Date(), locks: navigator.locks });
      if (outcome.status === 'error') { text('status', outcome.message); return; }
      store = outcome.store;
    } else {
      // 先讀指定題本再決定生命週期；回看、結束說明與錯誤網址都不遷移。
      store = readBookletStore() ?? { version: 2, migratedAt: null, current: { '1': null, '3': null }, booklets: [] };
    }
    route = dailyRoute(store, subject, bookId, catalog);
    if (route.kind === 'catalog') {
      renderCatalog();
      if (new URL(location.href).searchParams.has('subject')) element('directory-' + subject).scrollIntoView({ block: 'start', behavior: 'instant' });
      window.addEventListener('storage', (event) => {
        if (event.key !== BOOKLET_KEY && event.key !== STORAGE_KEY && event.key !== null) return;
        try {
          // storage 重畫只讀新鍵，不以遷移補回另一頁已清除的題本。
          store = readBookletStore() ?? { version: 2, migratedAt: null, current: { '1': null, '3': null }, booklets: [] };
          renderCatalog();
        } catch (cause) {
          element('directory').hidden = true; text('status', '無法載入每日題本：' + String(cause instanceof Error ? cause.message : cause));
        }
      });
      return;
    }
    text('status', '');
    if (route.kind === 'missing' || route.kind === 'retired') {
      element('unavailable').hidden = false;
      text('unavailable-title', route.kind === 'missing' ? '找不到這本題本' : '這本已結束'); return;
    }
    if (route.kind === 'resume') {
      const recoveryError = recoverSubmissions().get(subject)?.error;
      route = dailyRoute(store, subject, bookId, catalog);
      if (recoveryError) { error(recoveryError); text('status', '交卷尚未完成，請重試。'); }
    }
    if (!('booklet' in route)) { location.reload(); return; }
    draft = route.booklet;
    viewing = route.kind === 'review'; readOnly ||= viewing;
    if (route.kind === 'resume' || route.kind === 'retire') {
      const resolved = reconcileBooklet(draft, catalog);
      // 結束頁只顯示有效題數，明確按「結束這本」之前不保存。
      if (resolved.skipped && route.kind === 'resume') {
        draft = saveBooklet(resolved.booklet, draft); store = readBookletStore()!;
      } else draft = resolved.booklet;
      skippedNotice = resolved.skipped ? resolved.skipped + ' 題已移除或改版，已略過，不補題。' : '';
      if (!failed) text('status', skippedNotice);
    }
    const heading = document.querySelector('h1');
    const title = '科目 ' + subject + '・第 ' + draft.number + ' 本';
    if (heading) heading.textContent = title;
    document.title = title + '｜每日題本';
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
    // 網址指定的位置只影響初始畫面；開頁本身不應寫入或使其他分頁失效。
    savedContent = draft ? JSON.stringify(draft) : undefined;
    element('practice').hidden = cards.length === 0;
    if (cards.length && draft) navigation = initQuestionNavigation({ prefix: 'daily', cards, position: draft.position, heading: element('question-heading'), canVisit,
      nextPosition: (current) => dailyNext(draft!, current), onLeave: settle,
      onShow: (position) => { draft!.position = position; persist(); started = editable() && !document.hidden ? performance.now() : null; displayCards(); render(); } });
    else render();
    // 交卷重載後才聚焦成績；移除一次性標記，避免重載或回看再次搶焦點。
    if (viewing && location.hash === '#daily-score') {
      element('score').focus();
      const url = new URL(location.href); url.hash = '';
      history.replaceState(history.state, '', url);
    }
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
  const requestDiscard = () => {
    if (!discardable()) return;
    discardDialog.showModal(); element('discard-cancel').focus();
  };
  discard.addEventListener('click', requestDiscard);
  discardDialog.addEventListener('close', () => { if (!discard.hidden && !stopped) discard.focus({ preventScroll: true }); });
  element('discard-cancel').addEventListener('click', () => discardDialog.close());
  element('discard-confirm').addEventListener('click', () => {
    if (!discardable() || !expected) return;
    try {
      discardBooklet(expected);
      stopped = true; started = null;
      window.clearInterval(timer); window.clearInterval(saveTimer);
      discardDialog.close(); location.href = currentUrl();
    } catch (cause) {
      discardDialog.close();
      error(cause, 'discard', () => { clearError(); render(); requestDiscard(); });
      displayCards(); render();
    }
  });
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
  const retireCurrent = () => {
    if (!draft || !expected || readOnly) return;
    try { retireBooklet(draft, expected); location.href = currentUrl(); }
    catch (cause) { error(cause, 'retire', retireCurrent); }
  };
  element('retire-book').addEventListener('click', retireCurrent);
  const checkCurrent = () => {
    if (route.kind !== 'resume' || viewing || readOnly || stopped) return;
    try {
      if (expected && (draft?.status === 'open' || draft?.status === 'submitting')) store = assertBookletCurrent(expected);
      else {
        const latest = readBookletStore();
        if (!latest || latest.current[subject] !== store.current[subject] || (expected && latest.booklets.find((b) => b.id === expected!.id)?.seq !== expected.seq)) throw new DailyConflictError();
        store = latest;
      }
    } catch (cause) { readOnly = true; started = null; error(cause); displayCards(); render(); }
  };
  window.addEventListener('storage', (event) => {
    // 作答頁只檢查本題本衝突；其他進度留到目錄再更新。
    if (route.kind === 'resume' && (event.key === BOOKLET_KEY || event.key === null)) { checkCurrent(); render(); }
  });
  document.addEventListener('visibilitychange', () => { if (route.kind !== 'resume' || viewing || stopped) return; settle(); persist(); if (!document.hidden) checkCurrent(); displayCards(); render(); });
  const startTimer = () => {
    timer = window.setInterval(showTime, 1000);
    // 保存排程與顯示排程分開；只有可見的作答中題本會寫入。
    saveTimer = window.setInterval(() => { if (!document.hidden && editable()) { settle(); persist(); displayCards(); render(); } }, 15_000);
  };
  if (route.kind === 'resume') startTimer();
  window.addEventListener('pagehide', () => { if (route.kind !== 'resume' || viewing || stopped) return; settle(); persist(); window.clearInterval(timer); window.clearInterval(saveTimer); });
  window.addEventListener('pageshow', (event) => { if (route.kind === 'resume' && !viewing && !stopped && event.persisted) { checkCurrent(); started = editable() && !document.hidden ? performance.now() : null; startTimer(); } });
}
