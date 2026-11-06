/** 題卡共用呈現：先收起結果，再按明確狀態勾選、鎖定與揭露，讓還原與首次作答一致。 */
import type { Choice } from './attempts';
export interface CardDisplay { choice: Choice | null; locked: boolean; reveal: boolean; correct?: boolean | null; saved?: boolean; }
export function displayQuestionCard(card: HTMLElement, state: CardDisplay): void {
  if (state.reveal) card.dataset.answered = 'true'; else delete card.dataset.answered;
  if (state.saved) card.dataset.saved = 'true'; else delete card.dataset.saved;
  for (const input of card.querySelectorAll<HTMLInputElement>('input[type="radio"]')) { input.checked = input.value === state.choice; input.disabled = state.locked; }
  const submit = card.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) { submit.disabled = state.locked; if (state.locked) submit.textContent = '已提交'; }
  for (const option of card.querySelectorAll<HTMLElement>('[data-option]')) {
    const isAnswer = state.reveal && option.dataset.option === card.dataset.answer;
    const isWrong = state.reveal && option.dataset.option === state.choice && !state.correct;
    option.classList.toggle('is-correct', isAnswer); option.classList.toggle('is-wrong', isWrong);
    const status = option.querySelector('.option-status'); if (status) status.textContent = isAnswer ? '✓ 正解' : isWrong ? '✕ 你的答案' : '';
  }
  card.querySelector('.answer-result')?.classList.toggle('incorrect', state.reveal && !state.correct);
  const label = card.querySelector('[data-result-label]'); if (label) label.textContent = state.reveal ? state.correct ? '答對了，繼續保持！' : '這個觀念值得再看一次' : '';
  const symbol = card.querySelector('[data-result-symbol]'); if (symbol) symbol.textContent = state.reveal ? state.correct ? '✓' : '↺' : '';
  const chosen = card.querySelector('[data-chosen]'); if (chosen) chosen.textContent = state.reveal ? `・你的答案 ${state.choice}` : '';
  const explanation = card.querySelector<HTMLElement>('[data-explanation]'); if (explanation) explanation.hidden = !state.reveal;
  for (const item of card.querySelectorAll<HTMLElement>('[data-after-only]')) item.hidden = !state.reveal;
  for (const item of card.querySelectorAll<HTMLElement>('[data-before-only]')) item.hidden = state.reveal;
}
