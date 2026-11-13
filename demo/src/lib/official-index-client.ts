/** 目錄只讀輪次與作答紀錄；分開處理讀取錯誤，避免一份資料損壞遮住其他進度。 */
import { getAttempts, readOfficialRounds, type Attempt } from './attempts';
import { officialProgress } from './official';
import { officialRoundCard, type OfficialRoundSetSource, type OfficialRoundSource } from './official-round';
import { startOfficialRound } from './official-start';

export interface OfficialIndexSet extends OfficialRoundSetSource { mode: string; }
interface OfficialIndexLink { label: string; href: string; }
export interface OfficialIndexCard {
  id: string;
  progressText: string | null;
  historyText: string | null;
  legacyText: string | null;
  errorText: string | null;
  action: ({ kind: 'start'; label: string } | ({ kind: 'link' } & OfficialIndexLink)) | null;
  latestSubmittedLink: OfficialIndexLink | null;
  allRecordsLink: OfficialIndexLink | null;
}

/** null 表示讀取失敗；空陣列才表示還沒有紀錄，不把損壞資料當成新題組。 */
export function buildOfficialIndexCards(
  sets: readonly OfficialIndexSet[], rounds: readonly OfficialRoundSource[] | null, attempts: readonly Attempt[] | null,
): OfficialIndexCard[] {
  return sets.map((set) => {
    const href = `/official/${set.id}/`;
    const base = { id: set.id, progressText: null, historyText: null, legacyText: null, errorText: null,
      latestSubmittedLink: null, allRecordsLink: null };
    if (set.session === 'guide') {
      const progress = attempts === null ? null : officialProgress(set.questions, attempts, set.mode);
      return { ...base,
        progressText: progress ? `已答 ${progress.done}／${progress.total} 題・答對 ${progress.correct} 題` : null,
        errorText: progress ? null : '無法讀取作答進度，已保留原資料。',
        action: { kind: 'link', label: '開啟題組 →', href } };
    }
    if (rounds === null) return { ...base, errorText: '無法讀取作答紀錄，已保留原資料。請確認瀏覽器儲存狀態後重新載入。', action: null };
    const card = officialRoundCard(set, rounds, attempts ?? []);
    return { ...base, progressText: card.progressText, historyText: card.historyText, legacyText: card.legacyText,
      errorText: attempts === null ? '無法讀取舊作答紀錄，已保留原資料。' : null,
      latestSubmittedLink: card.latestSubmittedId
        ? { label: '查看上次作答 →', href: `${href}?round=${encodeURIComponent(card.latestSubmittedId)}` } : null,
      allRecordsLink: card.rows.length ? { label: '全部紀錄 →', href } : null,
      action: card.action.kind === 'resume'
        ? { kind: 'link', label: card.action.label, href: `${href}?round=${encodeURIComponent(card.action.roundId)}` }
        : { kind: 'start', label: card.action.label } };
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

/** 成功後維持停用直到離頁；失敗才恢復按鈕，讓使用者修正儲存問題後重試。 */
export function createOfficialStartHandler(
  set: OfficialIndexSet,
  button: Pick<HTMLButtonElement, 'disabled'>,
  errorElement: Pick<HTMLElement, 'textContent' | 'hidden'>,
  dependencies: { start: () => ReturnType<typeof startOfficialRound>; assign: (href: string) => void },
): () => void {
  return () => {
    if (button.disabled) return;
    button.disabled = true;
    errorElement.textContent = '';
    errorElement.hidden = true;
    try {
      const result = dependencies.start();
      dependencies.assign(`/official/${set.id}/?round=${encodeURIComponent(result.roundId)}`);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error))
        .replace(/\u8f2a次/g, '作答紀錄').replace(/\u8f2a/g, '次');
      errorElement.textContent = `尚未開始作答，原資料已保留。${message}`;
      errorElement.hidden = false;
      button.disabled = false;
    }
  };
}

function applyLink(id: string, link: OfficialIndexLink | null): void {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLAnchorElement)) return;
  element.hidden = link === null;
  if (link) { element.textContent = link.label; element.href = link.href; }
  else element.removeAttribute('href');
}

export function initOfficialIndex(): void {
  const status = document.getElementById('official-status');
  const catalog = document.getElementById('official-catalog');
  if (!status || !catalog) return;
  // 返回快取會保留已停用的開始按鈕與舊卡片；重新載入才會重讀紀錄，顯示剛建立那一次的「繼續作答」。
  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
  }
  try {
    const sets: OfficialIndexSet[] = JSON.parse(catalog.textContent ?? '[]');
    const cards = readOfficialIndexCards(sets);
    for (const card of cards) {
      for (const [field, text] of Object.entries({ progress: card.progressText, history: card.historyText, legacy: card.legacyText, error: card.errorText })) {
        const element = document.getElementById(`${field}-${card.id}`);
        if (element) { element.textContent = text; element.hidden = !text; }
      }
      applyLink(`action-${card.id}`, card.action?.kind === 'link' ? card.action : null);
      applyLink(`latest-${card.id}`, card.latestSubmittedLink);
      applyLink(`records-${card.id}`, card.allRecordsLink);
      const button = document.getElementById(`start-${card.id}`);
      const errorElement = document.getElementById(`error-${card.id}`);
      const set = sets.find((set) => set.id === card.id);
      if (button instanceof HTMLButtonElement) {
        button.hidden = card.action?.kind !== 'start';
        if (card.action?.kind === 'start' && set && errorElement) {
          button.textContent = card.action.label;
          button.addEventListener('click', createOfficialStartHandler(set, button, errorElement, {
            start: () => startOfficialRound(set, () => crypto.randomUUID(), () => new Date().toISOString()),
            assign: (href) => location.assign(href),
          }));
        }
      }
    }
    status.textContent = cards.some((card) => card.errorText)
      ? '部分紀錄無法讀取，請查看各題組的提示。'
      : '各份題組分開記錄。選一份開始，或繼續作答中的那一次。';
  } catch { status.textContent = '無法讀取題組目錄，請重新載入。'; }
}
