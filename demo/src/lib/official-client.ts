/** 考古題交由輪次流程處理；指引練習只還原同份題組的即時作答。 */
import { getAttempts } from './attempts';
import { officialProgress, type OfficialQuestion } from './official';
import { initQuestionSet } from './question-set-client';
import { initOfficialRound } from './official-round-client';

interface CatalogSet { id: string; mode: string; session: string; questions: Pick<OfficialQuestion, 'id'>[]; }
export function initOfficial(): void {
  const status = document.getElementById('official-status')!;
  try {
    const set: CatalogSet = JSON.parse(document.getElementById('official-catalog')!.textContent ?? '{}');
    if (set.session !== 'guide') { initOfficialRound(); return; }
    const progress = officialProgress(set.questions, getAttempts(), set.mode);
    const cards = Array.from(document.querySelectorAll<HTMLElement>('#official-cards [data-question]'));
    document.getElementById('official-practice')!.hidden = !cards.length;
    status.textContent = `本份共 ${cards.length} 題，作答後立即顯示解析。重新整理會保留已儲存的作答與目前位置。`;
    initQuestionSet({ prefix: 'official', cards, answered: progress.answered, mode: set.mode, elapsed: progress.elapsed });
  } catch (cause) { status.textContent = `無法載入官方題組：${cause instanceof Error ? cause.message : '請確認瀏覽器允許本機儲存。'}`; }
}
