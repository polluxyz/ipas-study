/** 每日流程組裝狀態與互動；保存一律透過 attempts，題卡及導覽沿用共用函式。 */
import { assertDailyDraftCurrent, DailyConflictError, DRAFT_KEY, getAttempts, getDailyDrafts, getDailySet, saveDailyDraft, saveDailySet, submitDailyDraft, type Choice, type DailyDraft } from './attempts';
import { migrateDailySet, selectDailyQuestions, taipeiDate, unseenDailyQuestions, type DailyQuestion, type DailySubject } from './daily';
import { availableDailyQuestion, availableDailySet, canOpenToday, createDailyDraft, dailyCounts, dailyNext, dailyNumbers, dailyNumberState, dailyPosition, dailySource, prepareDailySubmission, reconcileDailyDraft } from './daily-exam';
import { displayQuestionCard } from './question-card-display';
import { initQuestionNavigation } from './question-set-client';

export function initDaily(): void {
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById('daily-' + id) as T;
  const text = (id: string, value: string) => { element(id).textContent = value; };
  const subject: DailySubject = new URL(location.href).searchParams.get('subject') === '3' ? 3 : 1;
  const catalog: DailyQuestion[] = JSON.parse(element('catalog').textContent ?? '[]');
  const container = element('cards');
  const submit = element<HTMLButtonElement>('submit');
  const unsure = element<HTMLButtonElement>('unsure');
  const dialog = element<HTMLDialogElement>('dialog');
  let draft: DailyDraft;
  let expected: DailyDraft | null = null;
  let pending: DailyDraft | undefined;
  let readOnly = false;
  let failed = false;
  let started: number | null = null;
  let navigation: ReturnType<typeof initQuestionNavigation> | undefined;
  let cards: HTMLElement[] = [];
  let timer: number | undefined;
  let saveTimer: number | undefined;
  const error = (cause: unknown) => {
    failed = true;
    if (cause instanceof DailyConflictError) readOnly = true;
    text('error-message', readOnly ? String(cause instanceof Error ? cause.message : cause) : '尚未保存，畫面上的答案仍保留。' + String(cause instanceof Error ? cause.message : cause));
    element('save-error').hidden = false; element('retry').hidden = readOnly; element('reload').hidden = !readOnly;
  };
  const clearError = () => { failed = false; element('save-error').hidden = true; };
  const editable = () => draft.status === 'open' && cards.length > 0 && !pending && !readOnly;
  const settle = () => {
    const now = performance.now(); const q = draft.questions[draft.position];
    if (started !== null && editable() && q && !q.legacyAttemptId) q.ms += Math.max(0, Math.round(now - started));
    started = editable() && !document.hidden ? now : null;
  };
  const persist = () => {
    if (readOnly || pending || draft.status === 'submitting' || !cards.length) return;
    try { draft = saveDailyDraft(draft, expected); expected = draft; clearError(); }
    catch (cause) { error(cause); }
  };
  const showTime = () => {
    const q = draft.questions[draft.position];
    const ms = draft.questions.reduce((sum, item) => sum + item.ms, 0) + (started !== null && editable() && q && !q.legacyAttemptId ? performance.now() - started : 0);
    const seconds = Math.floor(ms / 1000); text('time', `累計用時 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  };
  const displayCards = () => cards.forEach((card, index) => {
    const q = draft.questions[index]; if (!availableDailyQuestion(q, catalog, subject)) return;
    displayQuestionCard(card, { choice: q.choice, locked: !editable() || Boolean(q.legacyAttemptId), reveal: draft.status === 'submitted', correct: q.correct, saved: draft.status === 'submitted' });
  });
  const render = () => {
    const { answered, unsure: count, total } = dailyCounts(draft); const submitted = draft.status === 'submitted';
    const subjectProgress = document.querySelector(`[data-daily-subject="${subject}"] [data-subject-progress]`);
    if (subjectProgress) subjectProgress.textContent = `${submitted ? '已交卷' : '作答中'}・已答 ${answered}／${total}`;
    text('position', `第 ${draft.position + 1}／${total} 題`); text('question-heading', `第 ${draft.position + 1} 題`);
    text('progress', `已答 ${answered}／${total}`); text('unsure-count', `不確定 ${count}`);
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
      button.addEventListener('click', () => navigation?.go(index)); numbers.append(button);
    }
    const legend = element('legend'); legend.replaceChildren();
    for (const [state, label] of submitted ? [['correct', '答對'], ['wrong', '答錯'], ['outlined', '曾標不確定'], ['unavailable', '解析不可用']] : [['unanswered', '未答'], ['answered', '已答'], ['unsure', '不確定']]) {
      const span = document.createElement('span'); const swatch = document.createElement('i'); swatch.dataset.status = state; swatch.setAttribute('aria-hidden', 'true'); span.append(swatch, label); legend.append(span);
    }
    element('score').hidden = !submitted; element('legacy').hidden = !draft.questions.some((item) => item.legacyAttemptId);
    if (submitted && draft.submission) {
      text('score-heading', `答對 ${draft.submission.correct}／${draft.submission.total} 題`);
      text('score-points', `${draft.submission.correct * 2} 分／${draft.submission.total * 2} 分${draft.submission.total === 50 ? '・每題 2 分' : '・不是正式考試換算'}`);
    }
    const old = draft.date !== taipeiDate(new Date());
    const exhausted = draft.status === 'open' && canOpenToday(draft, catalog, taipeiDate(new Date()));
    element('today').hidden = !canOpenToday(draft, catalog, taipeiDate(new Date())); element<HTMLButtonElement>('today').disabled = readOnly;
    element('today-note').hidden = !submitted && !exhausted;
    text('today-note', exhausted ? '這份題組已沒有可作答的題目。可開啟今日題組。' : old ? '本份題組已交卷。可開啟今日題組。' : '今日題組已交卷，明天才有新題組。'); showTime();
  };
  const finishSubmission = () => {
    if (readOnly) return; settle(); started = null;
    try { pending ??= draft.status === 'submitting' ? draft : prepareDailySubmission(draft, new Map(cards.map((card) => [card.dataset.qid!, card.dataset.answer!])), new Date().toISOString(), () => crypto.randomUUID()); }
    catch (cause) { error(cause); return; }
    const result = submitDailyDraft(draft, pending); draft = result.draft; expected = draft;
    if (result.error) { error(result.error); displayCards(); render(); return; }
    pending = undefined; clearError(); displayCards(); render();
    try { text('remaining', `該科剩餘未做的已驗證非官方題：${unseenDailyQuestions(catalog, getAttempts(), subject).length} 題。`); } catch (cause) { error(cause); }
    element('score').focus({ preventScroll: true }); element('score').scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  try {
    const drafts = getDailyDrafts(); const stored = drafts.find((item) => item.subject === subject);
    const existing = stored?.questions.length ? stored : undefined; expected = stored ?? null;
    const today = taipeiDate(new Date()); const attempts = existing ? [] : getAttempts();
    const cached = existing ? undefined : getDailySet(today, subject);
    const todaySet = availableDailySet(cached, catalog);
    let skipped = 0;
    if (dailySource(existing, todaySet) === 'draft') { draft = existing!; expected = existing!; }
    else {
      let set = todaySet;
      if (!set) { const result = selectDailyQuestions(catalog, attempts, subject, today, Math.random); set = { date: today, subject, questions: result.selected.map(({ id, rev }) => ({ id, rev })) }; if (set.questions.length) set = saveDailySet(set, Boolean(cached)); }
      const migration = migrateDailySet(set, catalog, attempts, Math.random); if (migration.replaced) set = saveDailySet(migration.set, true);
      draft = createDailyDraft(set, attempts, Boolean(todaySet), crypto.randomUUID());
      const initial = reconcileDailyDraft(draft, catalog); skipped = initial.skipped;
      draft = initial.draft;
      if (draft.questions.length) { draft = saveDailyDraft(draft, expected); expected = draft; }
    }
    const resolved = reconcileDailyDraft(draft, catalog);
    skipped += resolved.skipped;
    // 全部失效時保留原草稿，直到使用者明確開啟今日題組。
    if (resolved.skipped && resolved.draft.questions.length) { draft = saveDailyDraft(resolved.draft, expected); expected = draft; }
    const allCards = new Map(Array.from(container.querySelectorAll<HTMLElement>('[data-question]')).map((card) => [card.dataset.qid!, card]));
    cards = (draft.status === 'open' && !resolved.draft.questions.length ? [] : draft.questions).map((q) => {
      if (availableDailyQuestion(q, catalog, subject)) return allCards.get(q.id)!;
      const missing = document.createElement('article'); missing.className = 'daily-unavailable'; missing.textContent = '已移除或改版，解析目前不可用。本次成績維持交卷時的紀錄。'; missing.hidden = true; return missing;
    });
    container.replaceChildren(...cards); text('date', `${draft.date} 題組・科目 ${subject}`);
    text('status', [draft.date !== today ? `正在續作 ${draft.date} 題組。` : '今日題組已固定。', draft.questions.length < 50 ? `可練 ${draft.questions.length} 題，距離 50 題缺 ${50 - draft.questions.length} 題。` : '完成全部題目後再一起檢討。', skipped ? `${skipped} 題已移除或改版，已略過，不補題。` : ''].join(' '));
    if (!draft.questions.length) text('status', '目前沒有可做的題目。題庫恢復後重新開頁即可建立題組。');
    else if (draft.status === 'open' && !cards.length) text('status', `這份題組已沒有可作答的題目。${skipped} 題已移除或改版，不能交卷。`);
    try {
      text('remaining', `該科剩餘未做的已驗證非官方題：${unseenDailyQuestions(catalog, existing ? getAttempts() : attempts, subject).length} 題（含本份未交卷題目）。`);
    } catch { text('remaining', '無法更新剩餘題數；草稿仍可繼續作答與檢討。'); }
    for (const link of document.querySelectorAll<HTMLElement>('[data-daily-subject]')) {
      const item = link.dataset.dailySubject === String(subject) ? draft : drafts.find((d) => String(d.subject) === link.dataset.dailySubject);
      if (link.dataset.dailySubject === String(subject)) link.setAttribute('aria-current', 'page');
      link.querySelector('[data-subject-progress]')!.textContent = item ? `${item.status === 'submitted' ? '已交卷' : '作答中'}・已答 ${dailyCounts(item).answered}／${item.questions.length}` : '尚未開啟';
    }
    element('practice').hidden = !cards.length;
    draft.position = dailyPosition(draft, Number(new URL(location.href).searchParams.get('position')) - 1); displayCards();
    if (cards.length) navigation = initQuestionNavigation({ prefix: 'daily', cards, position: draft.position, heading: element('question-heading'),
      canVisit: (target, current) => (!pending || target === current) && dailyNumbers(draft).includes(target) && (draft.status === 'submitted' || Boolean(draft.questions[current]?.choice) || target <= current),
      nextPosition: (current) => dailyNext(draft, current), onLeave: settle,
      onShow: (position) => { draft.position = position; if (draft.status !== 'submitting') persist(); started = editable() && !document.hidden ? performance.now() : null; displayCards(); render(); } });
    else render();
    if (draft.status === 'submitting') finishSubmission();
  } catch (cause) {
    text('status', '無法載入每日題組：' + String(cause instanceof Error ? cause.message : cause) + ' 題組尚未開放作答，避免重新整理後換題。'); element('practice').hidden = true; return;
  }
  container.addEventListener('change', (event) => {
    const input = event.target; if (!(input instanceof HTMLInputElement) || !editable()) return;
    const q = draft.questions[draft.position]; if (q.legacyAttemptId) return;
    settle(); q.choice = input.value as Choice; persist(); displayCards(); render();
  });
  unsure.addEventListener('click', () => { const q = draft.questions[draft.position]; if (!editable() || !q?.choice) return; settle(); q.unsure = !q.unsure; persist(); render(); });
  submit.addEventListener('click', () => {
    const count = dailyCounts(draft); if (!editable() || count.answered !== count.total || !count.total || failed) return;
    text('dialog-count', `不確定 ${count.unsure} 題`); dialog.showModal(); element('cancel').focus();
  });
  dialog.addEventListener('close', () => { if (draft.status !== 'submitted') submit.focus({ preventScroll: true }); });
  element('cancel').addEventListener('click', () => dialog.close());
  element('confirm').addEventListener('click', () => { submit.disabled = true; dialog.close(); finishSubmission(); });
  element('retry').addEventListener('click', () => { if (pending || draft.status === 'submitting') finishSubmission(); else { settle(); persist(); displayCards(); render(); } });
  const panel = element<HTMLDetailsElement>('panel');
  panel.addEventListener('toggle', () => { panel.querySelector('summary')!.setAttribute('aria-expanded', String(panel.open)); text('panel-toggle', panel.open ? '收合' : '展開'); });
  const desktopPanel = window.matchMedia('(min-width: 1100px)');
  panel.open = desktopPanel.matches;
  desktopPanel.addEventListener('change', () => { panel.open = desktopPanel.matches; });
  element('today').addEventListener('click', () => {
    if (!canOpenToday(draft, catalog, taipeiDate(new Date())) || readOnly) return;
    try {
      assertDailyDraftCurrent(expected, subject); const date = taipeiDate(new Date()); const result = selectDailyQuestions(catalog, getAttempts(), subject, date, Math.random);
      if (!result.selected.length) { text('today-note', '目前沒有可做的題目。題庫恢復後可再開啟今日題組。'); return; }
      const set = saveDailySet({ date, subject, questions: result.selected.map(({ id, rev }) => ({ id, rev })) }, draft.status === 'open');
      saveDailyDraft(createDailyDraft(set, [], false, crypto.randomUUID()), expected); location.href = `/daily/?subject=${subject}`;
    } catch (cause) { error(cause); displayCards(); render(); }
  });
  const checkCurrent = () => {
    try { assertDailyDraftCurrent(expected, subject); }
    catch (cause) { readOnly = true; started = null; error(cause); displayCards(); render(); }
  };
  window.addEventListener('storage', (event) => { if (event.key === DRAFT_KEY || event.key === null) checkCurrent(); });
  document.addEventListener('visibilitychange', () => { settle(); if (draft.status === 'open') persist(); if (!document.hidden) checkCurrent(); displayCards(); render(); });
  const startTimer = () => { timer = window.setInterval(() => {
    showTime(); if (draft.status === 'submitted') {
      const today = draft.date === taipeiDate(new Date()); element('today').hidden = today;
      text('today-note', today ? '今日題組已交卷，明天才有新題組。' : '本份題組已交卷。可開啟今日題組。');
    }
  }, 1000);
    // 保存排程與顯示排程分開；計時仍只使用草稿與目前可見區段。
    saveTimer = window.setInterval(() => { if (!document.hidden && editable()) { settle(); persist(); displayCards(); render(); } }, 15_000);
  };
  startTimer(); window.addEventListener('pagehide', () => { settle(); persist(); window.clearInterval(timer); window.clearInterval(saveTimer); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) { checkCurrent(); started = editable() && !document.hidden ? performance.now() : null; startTimer(); } });
}
