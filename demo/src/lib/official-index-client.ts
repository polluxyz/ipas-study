/** 目錄只讀輪次與作答紀錄；分開處理讀取錯誤，避免一份資料損壞遮住其他進度。 */
import { getAttempts, readOfficialRounds, type Attempt } from './attempts';
import { officialProgress } from './official';
import { officialRoundCard, type OfficialRoundSetSource, type OfficialRoundSource } from './official-round';

export interface OfficialIndexSet extends OfficialRoundSetSource { mode: string; }
export interface OfficialIndexCard {
  id: string;
  progressText: string | null;
  historyText: string | null;
  legacyText: string | null;
  errorText: string | null;
  action: { label: string; href: string } | null;
}

/** null 表示讀取失敗；空陣列才表示還沒有紀錄，不把損壞資料當成新題組。 */
export function buildOfficialIndexCards(
  sets: readonly OfficialIndexSet[], rounds: readonly OfficialRoundSource[] | null, attempts: readonly Attempt[] | null,
): OfficialIndexCard[] {
  return sets.map((set) => {
    const href = `/official/${set.id}/`;
    const base = { id: set.id, progressText: null, historyText: null, legacyText: null, errorText: null };
    if (set.session === 'guide') {
      const progress = attempts === null ? null : officialProgress(set.questions, attempts, set.mode);
      return { ...base,
        progressText: progress ? `已答 ${progress.done}／${progress.total} 題・答對 ${progress.correct} 題` : null,
        errorText: progress ? null : '無法讀取作答進度，已保留原資料。',
        action: { label: '開啟題組 →', href } };
    }
    if (rounds === null) return { ...base, errorText: '無法讀取輪次，已保留原資料。請確認瀏覽器儲存狀態後重新載入。', action: null };
    const card = officialRoundCard(set, rounds, attempts ?? []);
    return { ...base, progressText: card.progressText, historyText: card.historyText, legacyText: card.legacyText,
      errorText: attempts === null ? '無法讀取舊作答紀錄，已保留原資料。' : null,
      action: card.action.kind === 'resume'
        ? { label: '繼續作答 →', href: `${href}?round=${encodeURIComponent(card.action.roundId)}` }
        : { label: card.action.label, href } };
  });
}

/** 只呼叫讀取介面；交卷中斷的恢復留給該輪次頁面處理。 */
export function readOfficialIndexCards(sets: readonly OfficialIndexSet[]): OfficialIndexCard[] {
  let rounds: OfficialRoundSource[] | null = null;
  let attempts: Attempt[] | null = null;
  try { rounds = readOfficialRounds().rounds; } catch { /* 輪次錯誤不阻止讀取指引進度。 */ }
  try { attempts = getAttempts(); } catch { /* 作答錯誤不阻止讀取輪次。 */ }
  return buildOfficialIndexCards(sets, rounds, attempts);
}

export function initOfficialIndex(): void {
  const status = document.getElementById('official-status');
  const catalog = document.getElementById('official-catalog');
  if (!status || !catalog) return;
  try {
    const sets: OfficialIndexSet[] = JSON.parse(catalog.textContent ?? '[]');
    const cards = readOfficialIndexCards(sets);
    for (const card of cards) {
      for (const [field, text] of Object.entries({ progress: card.progressText, history: card.historyText, legacy: card.legacyText, error: card.errorText })) {
        const element = document.getElementById(`${field}-${card.id}`);
        if (element) { element.textContent = text; element.hidden = !text; }
      }
      const action = document.getElementById(`action-${card.id}`);
      if (action instanceof HTMLAnchorElement) {
        action.hidden = card.action === null;
        if (card.action) { action.textContent = card.action.label; action.href = card.action.href; }
        else action.removeAttribute('href');
      }
    }
    status.textContent = cards.some((card) => card.errorText)
      ? '部分紀錄無法讀取，請查看各題組的提示。'
      : '各份題組分開記錄。選一份開始，或繼續未交卷的輪次。';
  } catch { status.textContent = '無法讀取題組目錄，請重新載入。'; }
}
